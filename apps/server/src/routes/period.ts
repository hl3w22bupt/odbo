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

async function getPeriodCsv(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const periodId = requirePeriodId(ctx.params.periodId)
  try {
    const input = await scopedUserPeriodInput(user.id)
    const report = readableScopedPeriodReport(user.id, input, periodId)
    return rawContent(
      moodPeriodReportCsv(report),
      'text/csv; charset=utf-8',
      { 'content-disposition': `attachment; filename="xinban-period-${periodId}.csv"` },
    )
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('[period] csv export degraded', { err: String(err), periodId, userId: user.id })
    return rawContent(
      moodPeriodReportCsv(moodPeriodReportDegraded(user.id)),
      'text/csv; charset=utf-8',
      { 'content-disposition': `attachment; filename="xinban-period-${periodId}.csv"` },
    )
  }
}

/** v0.10 单周期情绪洞察：输入 = 既有聚合输出，三类封顶；空态/降级均 200 合法结构。 */
async function getPeriodInsight(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const periodId = requirePeriodId(ctx.params.periodId)
  try {
    const input = await scopedUserPeriodInput(user.id)
    const report = readableScopedPeriodReport(user.id, input, periodId)
    return ok(buildMoodPeriodInsight(report, input.timeline, input.memory, periodId))
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error('[period] insight degraded', { err: String(err), periodId, userId: user.id })
    return ok(moodPeriodInsightDegraded(user.id, periodId))
  }
}

export function registerPeriodRoutes(router: HttpRouter): void {
  router.define('period::comparison', '/api/v1/periods/:periodId/comparison', 'GET', getPeriodComparison)
  router.define('period::csv', '/api/v1/periods/:periodId/report.csv', 'GET', getPeriodCsv)
  router.define('period::insight', '/api/v1/periods/:periodId/insight', 'GET', getPeriodInsight)
}
