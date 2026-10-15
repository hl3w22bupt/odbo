/**
 * 心伴 v0.9 · 多周期对比与周期 CSV 导出（additive）。
 * 输入复用 v0.8 周期聚合口径；查询始终以 Bearer 用户自身会话为边界。
 */
import { prisma } from '../db.js'
import { authenticate, type HttpRouteContext, type HttpRouter } from '../http.js'
import { AppError } from '../lib/errors.js'
import {
  moodPeriodReportDegraded,
  periodBoundsFromPeriodId,
  readableMoodPeriodReport,
  type MoodPeriodReport,
} from '../lib/moodPeriodReport.js'
import { compareMoodPeriods, periodComparisonDegraded } from '../lib/periodComparison.js'
import { moodPeriodReportCsv } from '../lib/periodCsv.js'
import { buildMoodPeriodInsight, moodPeriodInsightDegraded } from '../lib/moodPeriodInsight.js'
import {
  buildMoodPeriodInsightComparison,
  moodPeriodInsightComparisonDegraded,
} from '../lib/moodPeriodInsightComparison.js'
import { logger } from '../lib/logger.js'
import { ok, rawContent } from '../lib/response.js'
import {
  memoryReadEmpty,
  moodTimelineEmpty,
  readableMemories,
  readableMoodTimeline,
  type MemoryReadContract,
  type MoodTimelineContract,
} from '../lib/conversationInsights.js'

/** v0.13 additive 提示位：未知周期标识不参与聚合/洞察，也不升级为新增错误码。 */
interface UnknownPeriodNotice {
  meta: { skippedUnknownPeriodCount: number; unknownPeriodIds: string[] }
  warnings: ['UNKNOWN_PERIOD_SKIPPED']
}

function unknownPeriodNotice(periodIds: readonly (string | undefined)[]): UnknownPeriodNotice | Record<string, never> {
  const unknownPeriodIds = [...new Set(periodIds.filter((id): id is string =>
    Boolean(id) && !periodBoundsFromPeriodId(id!),
  ))]
  if (unknownPeriodIds.length === 0) return {}
  return {
    meta: { skippedUnknownPeriodCount: unknownPeriodIds.length, unknownPeriodIds },
    warnings: ['UNKNOWN_PERIOD_SKIPPED'],
  }
}

function explicitPeriodIds(query: Record<string, string>): string[] | null {
  const raw = query.period_ids
  if (raw === undefined) return null
  const values = raw.split(',').map((value) => value.trim())
  if (values.length < 1 || values.length > 3 || values.some((value) => value === '')) {
    throw new AppError(
      400,
      'PERIOD_INSIGHT_COUNT_REJECTED',
      'period_ids 必须是 1-3 个非空周期标识',
      { maxPeriods: 3 },
    )
  }
  return values
}
function requirePeriodComparisonCount(query: Record<string, string>): number {
  const raw = query.periods ?? '3'
  const value = Number.parseInt(raw, 10)
  if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < 1 || value > 3) {
    throw new AppError(
      400,
      'PERIOD_INSIGHT_COUNT_REJECTED',
      'periods 必须是 1-3 的整数',
      { maxPeriods: 3 },
    )
  }
  return value
}

function previousPeriodIds(periodId: string, count: number): string[] {
  const utcMonday = Date.parse(`${periodId}T00:00:00.000Z`)
  return Array.from({ length: count }, (_, index) =>
    new Date(utcMonday - (count - 1 - index) * 7 * 24 * 3_600_000).toISOString().slice(0, 10),
  )
}

function requirePeriodId(value: string | undefined): string {
  if (!value) throw AppError.badRequest('缺少 periodId')
  if (!periodBoundsFromPeriodId(value)) throw AppError.badRequest('periodId 必须是东八区周一日期 YYYY-MM-DD')
  return value
}

interface ScopedPeriodInput {
  memory: MemoryReadContract
  timeline: MoodTimelineContract
}

async function scopedUserPeriodInput(userId: string): Promise<ScopedPeriodInput> {
  const conversations = await prisma.conversation.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (conversations.length === 0) {
    return { memory: memoryReadEmpty(userId), timeline: moodTimelineEmpty(userId) }
  }

  const conversationIds = conversations.map((conversation) => conversation.id)
  const [memoryRows, moodRows, correctionRows] = await Promise.all([
    prisma.conversationMemory.findMany({
      where: { conversationId: { in: conversationIds }, userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.moodSnapshot.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.moodCorrection.findMany({
      where: { conversationId: { in: conversationIds }, userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  const memoryItems = memoryRows.flatMap((row) => readableMemories(row.conversationId, [row]).items)
  const moodPoints = moodRows.flatMap((row) => readableMoodTimeline(
    row.conversationId,
    [row],
    false,
    correctionRows.filter((correction) => correction.moodSnapshotId === row.id),
  ).points)

  return {
    memory: { conversationId: userId, available: true, degraded: false, items: memoryItems },
    timeline: { conversationId: userId, available: true, degraded: false, points: moodPoints },
  }
}

function readableScopedPeriodReport(userId: string, input: ScopedPeriodInput, periodId: string): MoodPeriodReport {
  return readableMoodPeriodReport(userId, input.memory, input.timeline, new Date(), periodId)
}

async function getPeriodComparison(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const periodId = requirePeriodId(ctx.params.periodId)
  try {
    const input = await scopedUserPeriodInput(user.id)
    const current = readableScopedPeriodReport(user.id, input, periodId)
    const previous = readableScopedPeriodReport(user.id, input, previousMonday(periodId))
    return ok(compareMoodPeriods(periodId, current, previous))
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('[period] comparison degraded', { err: String(err), periodId, userId: user.id })
    return ok(periodComparisonDegraded(periodId))
  }
}

function previousMonday(periodId: string): string {
  const utcMonday = Date.parse(`${periodId}T00:00:00.000Z`)
  return new Date(utcMonday - 7 * 24 * 3_600_000).toISOString().slice(0, 10)
}

function periodCsvDisposition(periodId: string): Record<string, string> {
  const encodedFilename = encodeURIComponent(`心伴周期-${periodId}.csv`)
  return {
    'content-disposition': `attachment; filename="xinban-period-${periodId}.csv"; filename*=UTF-8''${encodedFilename}`,
  }
}

async function getPeriodCsv(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const periodId = requirePeriodId(ctx.params.periodId)
  const disposition = periodCsvDisposition(periodId)
  try {
    const input = await scopedUserPeriodInput(user.id)
    const report = readableScopedPeriodReport(user.id, input, periodId)
    return rawContent(
      moodPeriodReportCsv(report),
      'text/csv; charset=utf-8',
      disposition,
    )
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('[period] csv export degraded', { err: String(err), periodId, userId: user.id })
    return rawContent(
      moodPeriodReportCsv(moodPeriodReportDegraded(user.id)),
      'text/csv; charset=utf-8',
      disposition,
    )
  }
}

/** v0.10 单周期情绪洞察：输入 = 既有聚合输出，三类封顶；空态/降级均 200 合法结构。 */
/** v0.13 定案：未知周期不抛 400；返回 200 合法降级空态，并只加不改挂 additive 提示位。 */
async function getPeriodInsight(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const periodId = ctx.params.periodId ?? ''
  const notice = unknownPeriodNotice([periodId])
  if ('warnings' in notice) {
    return ok({ ...moodPeriodInsightDegraded(user.id, periodId), ...notice })
  }
  try {
    const input = await scopedUserPeriodInput(user.id)
    const report = readableScopedPeriodReport(user.id, input, periodId)
    const insight = buildMoodPeriodInsight(report, input.timeline, input.memory, periodId)
    return ok({ ...insight, ...notice })
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('[period] insight degraded', { err: String(err), periodId, userId: user.id })
    return ok({ ...moodPeriodInsightDegraded(user.id, periodId), ...notice })
  }
}

/** v0.11 跨周期情绪洞察：新只读端点，不改造既有 comparison/insight handler。 */
async function getPeriodInsightComparison(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const explicitIds = explicitPeriodIds(ctx.query)
  const targetId = ctx.params.periodId ?? ''
  if (!explicitIds && !periodBoundsFromPeriodId(targetId)) {
    const notice = unknownPeriodNotice([targetId])
    return ok({
      ...moodPeriodInsightComparisonDegraded(user.id, targetId, [], requirePeriodComparisonCount(ctx.query), 'SOURCE_DEGRADED'),
      ...notice,
    })
  }
  const requestedPeriods = requirePeriodComparisonCount(ctx.query)
  const periodIds = explicitIds ?? previousPeriodIds(targetId, requestedPeriods)
  const notice = unknownPeriodNotice(periodIds)
  if ('warnings' in notice) {
    return ok({
      ...moodPeriodInsightComparisonDegraded(
        user.id,
        periodIds[periodIds.length - 1] ?? targetId,
        periodIds,
        periodIds.length,
        'SOURCE_DEGRADED',
      ),
      ...notice,
    })
  }
  try {
    const input = await scopedUserPeriodInput(user.id)
    const reports = periodIds.map((id) => readableScopedPeriodReport(user.id, input, id))
    const periodInsights = reports.map((report, index) =>
      buildMoodPeriodInsight(report, input.timeline, input.memory, periodIds[index]!),
    )
    return ok(buildMoodPeriodInsightComparison(
      user.id,
      periodIds,
      reports,
      periodInsights,
      input.timeline,
      input.memory,
    ))
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('[period] insight comparison degraded', {
      err: String(err),
      targetPeriodId: targetId,
      requestedPeriods,
      userId: user.id,
    })
    return ok({
      ...moodPeriodInsightComparisonDegraded(
        user.id,
        periodIds[periodIds.length - 1] ?? targetId,
        periodIds,
        requestedPeriods,
        'AGGREGATION_FAILED',
      ),
      ...notice,
    })
  }
}

export function registerPeriodRoutes(router: HttpRouter): void {
  router.define('period::comparison', '/api/v1/periods/:periodId/comparison', 'GET', getPeriodComparison)
  router.define('period::csv', '/api/v1/periods/:periodId/report.csv', 'GET', getPeriodCsv)
  router.define('period::insight', '/api/v1/periods/:periodId/insight', 'GET', getPeriodInsight)
  router.define('period::insight-comparison', '/api/v1/periods/:periodId/insight/comparison', 'GET', getPeriodInsightComparison)
}
