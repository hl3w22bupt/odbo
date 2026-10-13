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
import { encodeCsv, encodeCsvCell } from '../lib/csvExport.js'

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
  return {
    status_code: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="mood-period-comparison.csv"',
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
}
