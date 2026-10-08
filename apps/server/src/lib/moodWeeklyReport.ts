import type {
  MemoryReadContract,
  MoodSnapshotContract,
  MoodTimelineContract,
} from './conversationInsights.js'

export type MoodWeeklyTrend = 'IMPROVING' | 'STABLE' | 'WORSENING'

export interface MoodWeeklyReport {
  sampleSize: number
  counts: { positive: number; neutral: number; negative: number }
  trend: MoodWeeklyTrend
  headline: string
  reason: string
  keywords: string[]
  window: { from: string; to: string }
}

export interface MoodWeeklyReportContract {
  conversationId: string
  available: boolean
  degraded: boolean
  report: MoodWeeklyReport | null
}

export const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const KEYWORD_LIMIT = 3

function formatScore(value: number): string {
  return Number(value.toFixed(2)).toString()
}

function isValidDate(value: string): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function moodWeeklyReportEmpty(conversationId: string, now = new Date()): MoodWeeklyReportContract {
  return {
    conversationId,
    available: true,
    degraded: false,
    report: null,
  }
}

export function moodWeeklyReportDegraded(conversationId: string): MoodWeeklyReportContract {
  return { conversationId, available: false, degraded: true, report: null }
}

function pickKeywords(points: MoodSnapshotContract[]): string[] {
  const counts = new Map<string, { count: number; order: number }>()
  for (const point of points) {
    for (const keyword of point.keywords) {
      if (typeof keyword !== 'string' || keyword.trim() === '') continue
      const current = counts.get(keyword) ?? { count: 0, order: counts.size }
      current.count += 1
      counts.set(keyword, current)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].order - b[1].order)
    .slice(0, KEYWORD_LIMIT)
    .map(([keyword]) => keyword)
}

function explain(
  trend: MoodWeeklyTrend,
  sampleSize: number,
  previousAverage: number,
  recentAverage: number,
): { headline: string; reason: string } {
  if (trend === 'IMPROVING') {
    return {
      headline: '近7日情绪有所好转',
      reason: `近7日样本${sampleSize}条，前半段均分 ${formatScore(previousAverage)}，后半段均分 ${formatScore(recentAverage)}，情绪有所好转。`,
    }
  }
  if (trend === 'WORSENING') {
    return {
      headline: '近7日情绪转弱，值得关注',
      reason: `近7日样本${sampleSize}条，前半段均分 ${formatScore(previousAverage)}，后半段均分 ${formatScore(recentAverage)}，情绪转弱。`,
    }
  }
  return {
    headline: '近7日情绪比较平稳',
    reason: `近7日样本${sampleSize}条，前后两段均分接近，情绪平稳。`,
  }
}

/**
 * v0.7 周报读侧派生器：输入必须先经 memory / timeline 契约序列化和 latest-wins 修正。
 * 这里保持纯函数；now 由 HTTP 层注入，便于确定性测试。
 */
export function readableMoodWeeklyReport(
  conversationId: string,
  memory: MemoryReadContract,
  timeline: MoodTimelineContract,
  now = new Date(),
): MoodWeeklyReportContract {
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN
  if (
    !memory.available ||
    memory.degraded ||
    !timeline.available ||
    timeline.degraded ||
    !Number.isFinite(nowMs)
  ) {
    return moodWeeklyReportDegraded(conversationId)
  }

  const toDate = new Date(nowMs)
  const fromDate = new Date(nowMs - WEEKLY_WINDOW_MS)
  const fromIso = fromDate.toISOString()
  const toIso = toDate.toISOString()
  const activeMemoryIds = new Set(
    memory.items.filter((item) => item.status === 'ACTIVE' && item.id).map((item) => item.id),
  )

  const validPoints = timeline.points
    .filter((point) => {
      const time = point.createdAt
      return Boolean(
        point.id &&
          activeMemoryIds.has(point.memoryId ?? '') &&
          isValidDate(time) &&
          Date.parse(time) >= fromDate.getTime() &&
          Date.parse(time) <= toDate.getTime() &&
          (point.mood === 'POSITIVE' || point.mood === 'NEUTRAL' || point.mood === 'NEGATIVE') &&
          (point.score === -1 || point.score === 0 || point.score === 1),
      )
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  if (validPoints.length < 2) return moodWeeklyReportEmpty(conversationId, toDate)

  const counts = validPoints.reduce(
    (acc, point) => {
      if (point.mood === 'POSITIVE') acc.positive += 1
      else if (point.mood === 'NEGATIVE') acc.negative += 1
      else acc.neutral += 1
      return acc
    },
    { positive: 0, neutral: 0, negative: 0 },
  )

  const split = Math.floor(validPoints.length / 2)
  const previous = validPoints.slice(0, split)
  const recent = validPoints.slice(validPoints.length - split)
  const average = (rows: MoodSnapshotContract[]) =>
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.score, 0) / rows.length
  const previousAverage = average(previous)
  const recentAverage = average(recent)
  const trend: MoodWeeklyTrend =
    recentAverage > previousAverage ? 'IMPROVING' : recentAverage < previousAverage ? 'WORSENING' : 'STABLE'
  const { headline, reason } = explain(trend, validPoints.length, previousAverage, recentAverage)

  return {
    conversationId,
    available: true,
    degraded: false,
    report: {
      sampleSize: validPoints.length,
      counts,
      trend,
      headline,
      reason,
      keywords: pickKeywords(validPoints),
      window: { from: fromIso, to: toIso },
    },
  }
}
