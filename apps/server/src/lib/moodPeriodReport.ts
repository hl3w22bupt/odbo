import type {
  MemoryReadContract,
  MoodSnapshotContract,
  MoodTimelineContract,
} from './conversationInsights.js'

/**
 * v0.8 周期情绪报告读侧派生器（自然周口径，冻结契约见 docs/v0.8/REQUIREMENTS.md）。
 * 聚合口径四条：东八区自然周周一起算；缺省剔除不零填充；显式披露覆盖率；
 * 空周期返回合法空结构（200，非 404/500）。失败降级由 HTTP 层以 degraded 信封 + 非静默日志呈现。
 * 本文件保持纯函数：memory + timeline + now 入参，不触库、不依赖 Prisma。
 */

export interface MoodPeriodDayBucket {
  date: string
  count: number
  positive: number
  neutral: number
  negative: number
  averageScore: number
}

export interface MoodPeriodSummary {
  sampleSize: number
  counts: { positive: number; neutral: number; negative: number }
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING'
  headline: string
}

export interface MoodPeriodReport {
  conversationId: string
  available: boolean
  degraded: boolean
  period: { id: string; from: string; to: string }
  coverageDays: number
  totalDays: number
  moods: MoodPeriodDayBucket[]
  summary: MoodPeriodSummary | null
}

const CST_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
export const PERIOD_TOTAL_DAYS = 7

function isValidDate(value: string): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

/** 东八区自然日 YYYY-MM-DD（固定 UTC+8，无夏令时） */
function cstDate(ms: number): string {
  return new Date(ms + CST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 东八区周一 00:00 对应的 UTC 瞬间（含 now 所在周的周界 [from, to)） */
function naturalWeekBounds(nowMs: number): { fromMs: number; toMs: number } {
  const shifted = nowMs + CST_OFFSET_MS
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS
  const weekday = new Date(dayStartShifted).getUTCDay() // 0=Sun..6=Sat
  const mondayShifted = dayStartShifted - ((weekday + 6) % 7) * DAY_MS
  const fromMs = mondayShifted - CST_OFFSET_MS
  return { fromMs, toMs: fromMs + PERIOD_TOTAL_DAYS * DAY_MS }
}

function headlineFor(trend: MoodPeriodSummary['trend'], sampleSize: number): string {
  if (trend === 'IMPROVING') return `本周记录${sampleSize}条，情绪有所好转`
  if (trend === 'WORSENING') return `本周记录${sampleSize}条，情绪需要关注`
  return `本周记录${sampleSize}条，情绪平稳`
}

export function moodPeriodReportDegraded(conversationId: string): MoodPeriodReport {
  return {
    conversationId,
    available: false,
    degraded: true,
    period: null,
    coverageDays: 0,
    totalDays: PERIOD_TOTAL_DAYS,
    moods: [],
    summary: null,
  }
}

export function readableMoodPeriodReport(
  conversationId: string,
  memory: MemoryReadContract,
  timeline: MoodTimelineContract,
  now = new Date(),
): MoodPeriodReport {
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN
  if (
    !memory.available ||
    memory.degraded ||
    !timeline.available ||
    timeline.degraded ||
    !Number.isFinite(nowMs)
  ) {
    return moodPeriodReportDegraded(conversationId)
  }

  const { fromMs, toMs } = naturalWeekBounds(nowMs)
  const period = {
    id: cstDate(fromMs),
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
  }

  const activeMemoryIds = new Set(
    memory.items.filter((item) => item.status === 'ACTIVE' && item.id).map((item) => item.id),
  )

  // 有效点判据与 v0.7 周报一致；窗口为左闭右开 [from, to)
  const validPoints = timeline.points
    .filter((point) => {
      const time = point.createdAt
      const at = Date.parse(time)
      return Boolean(
        point.id &&
          activeMemoryIds.has(point.memoryId ?? '') &&
          isValidDate(time) &&
          at >= fromMs &&
          at < toMs &&
          (point.mood === 'POSITIVE' || point.mood === 'NEUTRAL' || point.mood === 'NEGATIVE') &&
          (point.score === -1 || point.score === 0 || point.score === 1),
      )
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  if (validPoints.length === 0) {
    return {
      conversationId,
      available: true,
      degraded: false,
      period,
      coverageDays: 0,
      totalDays: PERIOD_TOTAL_DAYS,
      moods: [],
      summary: null,
    }
  }

  // 缺省剔除不零填充：只为有数据的天建桶
  const buckets = new Map<string, MoodPeriodDayBucket>()
  const counts = { positive: 0, neutral: 0, negative: 0 }
  for (const p of validPoints as MoodSnapshotContract[]) {
    const date = cstDate(Date.parse(p.createdAt))
    const bucket = buckets.get(date) ?? {
      date,
      count: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      averageScore: 0,
    }
    bucket.count += 1
    if (p.mood === 'POSITIVE') {
      bucket.positive += 1
      counts.positive += 1
    } else if (p.mood === 'NEGATIVE') {
      bucket.negative += 1
      counts.negative += 1
    } else {
      bucket.neutral += 1
      counts.neutral += 1
    }
    bucket.averageScore += p.score
    buckets.set(date, bucket)
  }
  const moods = [...buckets.values()]
    .map((b) => ({ ...b, averageScore: b.averageScore / b.count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const split = Math.floor(validPoints.length / 2)
  const average = (rows: MoodSnapshotContract[]) =>
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.score, 0) / rows.length
  const previousAverage = average(validPoints.slice(0, split))
  const recentAverage = average(validPoints.slice(validPoints.length - split))
  const trend: MoodPeriodSummary['trend'] =
    validPoints.length < 2
      ? 'STABLE'
      : recentAverage > previousAverage
        ? 'IMPROVING'
        : recentAverage < previousAverage
          ? 'WORSENING'
          : 'STABLE'

  return {
    conversationId,
    available: true,
    degraded: false,
    period,
    coverageDays: buckets.size,
    totalDays: PERIOD_TOTAL_DAYS,
    moods,
    summary: {
      sampleSize: validPoints.length,
      counts,
      trend,
      headline: headlineFor(trend, validPoints.length),
    },
  }
}
