import { prisma } from '../db.js'
import { authenticate, type HttpHandler, type HttpRouteContext, type HttpRouter } from '../http.js'
import { ok } from '../lib/response.js'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { readableMemories, readableMoodTimeline } from '../lib/conversationInsights.js'
import {
  MAX_COMPARISON_PERIODS,
  moodPeriodComparisonDegraded,
  readableMoodPeriodComparison,
  type MoodPeriodComparison,
} from '../lib/moodPeriodComparison.js'
import { periodBoundsFromPeriodId } from '../lib/moodPeriodReport.js'
import { encodeCsv, encodeCsvCell } from '../lib/csvExport.js'
import {
  CSV_IMPORT_ROW_LIMIT,
  parsePeriodCsvImport,
  periodCsvImportFileError,
  type PeriodCsvImportRow,
  type WritablePeriodGroup,
} from '../lib/periodCsvImport.js'

type MemoryRow = Parameters<typeof readableMemories>[1][number]
type MoodRow = Parameters<typeof readableMoodTimeline>[1][number]
type CorrectionRow = NonNullable<Parameters<typeof readableMoodTimeline>[3]>[number]

interface ComparisonSource {
  memoryRows: MemoryRow[]
  moodRows: MoodRow[]
  correctionRows: CorrectionRow[]
  failedPeriodIndexes?: number[]
}

type ComparisonSourceLoader = () => Promise<ComparisonSource>
const CSV_EXPORT_ROW_LIMIT = 1000
export const COMPARISON_DIMENSION_COUNT = 5
let injectedSourceLoader: ComparisonSourceLoader | null = null

type PeriodImportTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
let injectedPeriodImportPersistenceHook: ((tx: PeriodImportTx) => Promise<void>) | null = null

/** v0.12 测试基建点：注入点在事务样本写入之后，用于验证整体回滚；生产默认关闭。 */
export function __setPeriodImportPersistenceForTests(hook: ((tx: PeriodImportTx) => Promise<void>) | null): void {
  injectedPeriodImportPersistenceHook = hook
}

/** v0.9 唯一新增测试基建点：只在读数据源边界注入重试、全量失败或部分失败。 */
export function __setMoodComparisonSourceForTests(loader: ComparisonSourceLoader): void {
  injectedSourceLoader = loader
}

export function __resetMoodComparisonSourceForTests(): void {
  injectedSourceLoader = null
}

class SourceUnavailableError extends Error {
  constructor() {
    super('mood comparison source unavailable')
  }
}

function parsePeriods(query: Record<string, string>): number {
  const raw = query.periods ?? String(MAX_COMPARISON_PERIODS)
  const value = Number.parseInt(raw, 10)
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 1 || value > MAX_COMPARISON_PERIODS) {
    throw new AppError(
      400,
      'PERIOD_COUNT_REJECTED',
      `periods 必须是 1-${MAX_COMPARISON_PERIODS} 的整数`,
      { maxPeriods: MAX_COMPARISON_PERIODS },
    )
  }
  return value
}

async function loadSource(conversationId: string, userId: string): Promise<ComparisonSource> {
  if (injectedSourceLoader) return injectedSourceLoader()
  const [memoryRows, moodRows, correctionRows] = await Promise.all([
    prisma.conversationMemory.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    }),
    prisma.moodSnapshot.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      // 多取一行使第 1001 行可见：否则 length 恒 ≤1000，413 超限判定生产不可达（VERIFICATION AC-13 修复）
      take: CSV_EXPORT_ROW_LIMIT + 1,
    }),
    prisma.moodCorrection.findMany({
      where: { conversationId, userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 1000,
    }),
  ])
  return { memoryRows, moodRows, correctionRows }
}

async function loadSourceWithRetry(
  conversationId: string,
  userId: string,
): Promise<ComparisonSource> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await loadSource(conversationId, userId)
    } catch (err) {
      lastError = err
      logger.warn('[chat] mood comparison source read retry', {
        conversationId,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  logger.error('[chat] mood comparison source unavailable', {
    conversationId,
    attempts: 2,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  })
  throw new SourceUnavailableError()
}

async function buildComparison(
  ctx: HttpRouteContext,
  exportMode = false,
): Promise<MoodPeriodComparison> {
  const requestedPeriods = parsePeriods(ctx.query)
  const user = await authenticate(ctx)
  const conversationId = ctx.params.id
  if (!conversationId) throw AppError.badRequest('缺少会话 id')
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
  })
  if (!conversation) throw AppError.notFound('会话不存在')

  const source = await loadSourceWithRetry(conversationId, user.id)
  if (exportMode && source.moodRows.length > CSV_EXPORT_ROW_LIMIT) {
    throw new AppError(
      413,
      'CSV_EXPORT_TOO_LARGE',
      `源数据超限：limit=${CSV_EXPORT_ROW_LIMIT}`,
      { limit: CSV_EXPORT_ROW_LIMIT },
    )
  }

  return readableMoodPeriodComparison(
    conversationId,
    readableMemories(conversationId, source.memoryRows),
    readableMoodTimeline(conversationId, source.moodRows, false, source.correctionRows),
    requestedPeriods,
    new Date(),
    source.failedPeriodIndexes ?? [],
  )
}

async function conversationPeriodComparison(ctx: HttpRouteContext): Promise<ReturnType<typeof ok>> {
  try {
    return ok(await buildComparison(ctx))
  } catch (err) {
    if (err instanceof SourceUnavailableError) {
      return ok(moodPeriodComparisonDegraded(ctx.params.id ?? '', parsePeriods(ctx.query)))
    }
    throw err
  }
}

function jsonWithHeaders(data: unknown, headers: Record<string, string>): ReturnType<typeof ok> {
  const response = ok(data)
  return { ...response, headers: { ...response.headers, ...headers } }
}

function reportSignals(data: MoodPeriodComparison): Record<string, string> {
  return {
    'x-report-empty': String(data.completeness.actualPoints === 0),
    'x-report-available': String(data.available),
    'x-report-degraded': String(data.degraded),
    'x-report-partial': String(data.degraded),
  }
}

async function conversationPeriodComparisonCsv(
  ctx: HttpRouteContext,
): Promise<ReturnType<typeof ok>> {
  let comparison: MoodPeriodComparison
  try {
    comparison = await buildComparison(ctx, true)
  } catch (err) {
    if (err instanceof SourceUnavailableError) {
      return jsonWithHeaders(
        { available: false, degraded: true, attempts: 2, partial: false },
        {
          'x-report-empty': 'false',
          'x-report-available': 'false',
          'x-report-degraded': 'true',
          'x-report-partial': 'false',
        },
      )
    }
    throw err
  }

  if (comparison.completeness.actualPoints === 0) {
    return {
      ...jsonWithHeaders(null, reportSignals(comparison)),
      status_code: 204,
      body: { code: 'OK', message: 'empty', data: null },
      rawBody: '',
    }
  }

  const rows = comparison.periods.flatMap((period) => {
    if (!period.sourceAvailable || period.empty) return []
    const value = period.aggregateValues
    return [
      [period.id, period.id, 'count', value.count],
      [period.id, period.id, 'positive', value.positive],
      [period.id, period.id, 'neutral', value.neutral],
      [period.id, period.id, 'negative', value.negative],
      [period.id, period.id, 'averageScore', value.averageScore],
    ]
  })

  const csv = encodeCsv(rows)
  const periodId = comparison.periods[comparison.periods.length - 1]?.id ?? ''
  const filename = periodId ? `心伴周期-${periodId}.csv` : '心伴周期对比.csv'
  return {
    status_code: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="xinban-period-${periodId}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'x-report-row-count': String(rows.length),
      'x-report-generated-at': new Date().toISOString(),
      'x-report-empty': 'false',
      'x-report-available': String(comparison.available),
      'x-report-degraded': String(comparison.degraded),
      'x-report-partial': String(comparison.degraded),
    },
    body: { code: 'OK', message: 'ok', data: csv },
    rawBody: csv,
  }
}

export { encodeCsvCell }

function rawCsvOf(ctx: HttpRouteContext): string | Buffer {
  if (ctx.rawBody !== undefined) return ctx.rawBody
  const value = ctx.body.csv
  return typeof value === 'string' ? value : ''
}

function keyOf(row: Pick<PeriodCsvImportRow, 'periodId' | 'date' | 'dimension'>): string {
  return `${row.periodId}\n${row.date}\n${row.dimension}`
}

function mapPeriodImportWriteError(error: unknown): unknown {
  const code: unknown = (error as { code?: unknown } | null)?.code
  if (code === 'P2002') {
    return new AppError(409, 'DUPLICATE', 'CSV 幂等键已被并发导入占用')
  }
  return error
}

async function writePeriodGroups(
  conversationId: string,
  userId: string,
  groups: WritablePeriodGroup[],
): Promise<number> {
  let importedRows = 0
  try {
    await prisma.$transaction(async (tx) => {
      for (const group of groups) {
        const contentBase = `周期导入样本 ${group.periodId}（count=${group.count}）`
        for (const sample of group.samples) {
          const memory = await tx.conversationMemory.create({
            data: {
              conversationId,
              userId,
              content: `${contentBase}：${sample.mood}/${sample.score}`,
              status: 'ACTIVE',
              createdAt: sample.createdAt,
              updatedAt: sample.createdAt,
            },
          })
          await tx.moodSnapshot.create({
            data: {
              conversationId,
              userId,
              memoryId: memory.id,
              mood: sample.mood,
              score: sample.score,
              keywords: 'period-import',
              createdAt: sample.createdAt,
            },
          })
        }
        if (injectedPeriodImportPersistenceHook) await injectedPeriodImportPersistenceHook(tx)
        for (const row of group.rows) {
          await tx.importedPeriodMetric.create({
            data: {
              conversationId,
              userId,
              periodId: row.periodId,
              date: row.date,
              dimension: row.dimension,
              value: row.value,
            },
          })
          importedRows += 1
        }
      }
    })
  } catch (error) {
    throw mapPeriodImportWriteError(error)
  }
  return importedRows
}

async function conversationPeriodComparisonImportCsv(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const conversation = await prisma.conversation.findFirst({
    where: { id: ctx.params.id ?? '', userId: user.id },
    select: { id: true },
  })
  if (!conversation) throw AppError.notFound('会话不存在')

  const parsed = parsePeriodCsvImport(rawCsvOf(ctx), CSV_IMPORT_ROW_LIMIT)
  if (parsed.kind === 'empty' || (parsed.kind === 'ok' && parsed.received === 0)) {
    return ok({
      received: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      failures_total: 0,
      failures: [],
      result_code: 'EMPTY_FILE',
    }, 'CSV 导入完成')
  }
  if (parsed.kind !== 'ok') throw periodCsvImportFileError(parsed)

  const ledgerRows = await prisma.importedPeriodMetric.findMany({
    where: { conversationId: conversation.id, userId: user.id },
    select: { periodId: true, date: true, dimension: true },
  })
  const existingKeys = new Set(ledgerRows.map(keyOf))
  const importRows = new Map<string, PeriodCsvImportRow>()
  const skippedRows = new Set<string>()
  for (const group of parsed.writableGroups) {
    if (group.rows.some((row) => existingKeys.has(keyOf(row)))) {
      for (const row of group.rows) skippedRows.add(keyOf(row))
      continue
    }
    for (const row of group.rows) importRows.set(keyOf(row), row)
  }

  // v0.12 review fix：组级校验失败的行（缺维度组/无损违反组）同时出现在 records 与 failures 中，
  // 只允许计入 failed 一个桶；若混入 skipped 将触发下方不变量断言，把已提交的事务误报成 500。
  const failedRowKeys = new Set(
    parsed.failures.map((failure) => `${failure.periodId ?? ''}\n${failure.date ?? ''}\n${failure.dimension ?? ''}`),
  )
  const importedKeys = new Set(importRows.keys())
  for (const row of parsed.records) {
    const key = keyOf(row)
    if (failedRowKeys.has(key)) continue
    if (existingKeys.has(key) || skippedRows.has(key) || importedKeys.has(key)) continue
    skippedRows.add(key)
  }
  const groupsToWrite = parsed.writableGroups
    .filter((group) => group.rows.every((row) => importedKeys.has(keyOf(row))))
  const importedCount = await writePeriodGroups(conversation.id, user.id, groupsToWrite)
  const skippedCount = parsed.records.filter(
    (row) =>
      !failedRowKeys.has(keyOf(row)) &&
      (existingKeys.has(keyOf(row)) || skippedRows.has(keyOf(row))) &&
      !importedKeys.has(keyOf(row)),
  ).length
  if (importedCount + skippedCount + parsed.failures.length !== parsed.received) {
    throw AppError.internal('CSV import count invariant failed', {
      received: parsed.received,
      imported: importedCount,
      skipped: skippedCount,
      failed: parsed.failures.length,
    })
  }

  // v0.13 只加不改：未知周期已在 parser 中失败并排除写侧；这里追加既有信封外的提示位。
  const unknownPeriodIds = [...new Set(parsed.failures
    .filter((failure) => failure.code === 'INVALID_DATE' &&
      Boolean(failure.periodId) && !periodBoundsFromPeriodId(failure.periodId!))
    .map((failure) => failure.periodId)
    .filter((periodId): periodId is string => Boolean(periodId)))]
  const unknownPeriodNotice = unknownPeriodIds.length === 0 ? {} : {
    meta: { skippedUnknownPeriodCount: unknownPeriodIds.length, unknownPeriodIds },
    warnings: ['UNKNOWN_PERIOD_SKIPPED'] as const,
  }

  return ok({
    received: parsed.received,
    imported: importedCount,
    skipped: skippedCount,
    failed: parsed.failures.length,
    failures_total: parsed.failures.length,
    failures: parsed.failures.slice(0, 20),
    result_code: 'OK',
    ...unknownPeriodNotice,
  }, 'CSV 导入完成')
}

export function registerMoodComparisonRoutes(router: HttpRouter): void {
  const comparisonHandler: HttpHandler = conversationPeriodComparison
  const csvHandler: HttpHandler = conversationPeriodComparisonCsv
  router.define(
    'chat::conversation-period-comparison',
    '/api/v1/conversations/:id/mood-period-comparison',
    'GET',
    comparisonHandler,
  )
  router.define(
    'chat::conversation-period-comparison-csv',
    '/api/v1/conversations/:id/mood-period-comparison/export.csv',
    'GET',
    csvHandler,
  )
  router.define(
    'chat::conversation-period-comparison-import-csv',
    '/api/v1/conversations/:id/mood-period-comparison/import.csv',
    'POST',
    conversationPeriodComparisonImportCsv,
  )
}
