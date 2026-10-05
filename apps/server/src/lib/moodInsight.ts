import type {
  MemoryReadContract,
  MoodSnapshotContract,
  MoodTimelineContract,
} from './conversationInsights.js'

export type MoodInsightTrend = 'IMPROVING' | 'STABLE' | 'WORSENING'

export interface MoodInsightSummary {
  sampleSize: number
  counts: { positive: number; neutral: number; negative: number }
  trend: MoodInsightTrend
  headline: string
  reason: string
  keywords: string[]
  window: { from: string; to: string }
}

export interface MoodInsightSummaryContract {
  conversationId: string
  available: boolean
  degraded: boolean
  summary: MoodInsightSummary | null
}

const KEYWORD_LIMIT = 3

export function moodInsightEmpty(conversationId: string): MoodInsightSummaryContract {
  return { conversationId, available: true, degraded: false, summary: null }
}

export function moodInsightDegraded(conversationId: string): MoodInsightSummaryContract {
  return { conversationId, available: false, degraded: true, summary: null }
}

function formatScore(value: number): string {
  return Number(value.toFixed(2)).toString()
}

function isValidDate(value: string): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
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

function trendOf(
  sampleSize: number,
  previousAverage: number,
  recentAverage: number,
): MoodInsightTrend {
  if (sampleSize < 3) return 'STABLE'
  if (recentAverage > previousAverage) return 'IMPROVING'
  if (recentAverage < previousAverage) return 'WORSENING'
  return 'STABLE'
}

function explain(
  trend: MoodInsightTrend,
  sampleSize: number,
  previousAverage: number,
  recentAverage: number,
  counts: MoodInsightSummary['counts'],
): { headline: string; reason: string } {
  const trendLabel =
    counts.positive >= counts.negative && counts.positive >= counts.neutral
      ? '积极'
      : counts.negative >= counts.positive && counts.negative >= counts.neutral
        ? '低落'
        : '平稳'
  const headline =
    trend === 'IMPROVING'
      ? '最近情绪有所好转'
      : trend === 'WORSENING'
        ? '最近情绪偏低，值得关注'
        : '整体情绪比较平稳'
  const reason =
    sampleSize < 3
      ? `样本 ${sampleSize} 条，暂时以观察为主，最近情绪偏${trendLabel}。`
      : trend === 'IMPROVING'
        ? `前半段均分 ${formatScore(previousAverage)}，后半段均分 ${formatScore(recentAverage)}，情绪有所好转。`
        : trend === 'WORSENING'
          ? `前半段均分 ${formatScore(previousAverage)}，后半段均分 ${formatScore(recentAverage)}，建议多关注近期状态。`
          : `前后两段均分接近，最近情绪以${trendLabel}为主。`
  return { headline, reason }
}

/**
 * v0.4 读侧派生器：只聚合能归因到 ACTIVE 会话记忆的情绪快照。
 * 输入已经由读契约过滤，这里继续防御脏点；无有效点时返回显式空态。
 */
export function readableMoodInsightSummary(
  conversationId: string,
  memory: MemoryReadContract,
  timeline: MoodTimelineContract,
): MoodInsightSummaryContract {
  if (!memory.available || memory.degraded || !timeline.available || timeline.degraded) {
    return moodInsightDegraded(conversationId)
  }

  const activeMemoryIds = new Set(
    memory.items.filter((item) => item.status === 'ACTIVE' && item.id).map((item) => item.id),
  )
  const validPoints = timeline.points
    .filter((point) => {
      const time = point.createdAt
      return Boolean(
        point.id &&
          activeMemoryIds.has(point.memoryId ?? '') &&
          typeof time === 'string' &&
          isValidDate(time) &&
          (point.mood === 'POSITIVE' || point.mood === 'NEUTRAL' || point.mood === 'NEGATIVE') &&
          (point.score === -1 || point.score === 0 || point.score === 1),
      )
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  if (validPoints.length === 0) return moodInsightEmpty(conversationId)

  const counts = validPoints.reduce(
    (acc, point) => {
      if (point.mood === 'POSITIVE') acc.positive += 1
      else if (point.mood === 'NEGATIVE') acc.negative += 1
      else acc.neutral += 1
      return acc
    },
    { positive: 0, neutral: 0, negative: 0 },
  )

  const sampleSize = validPoints.length
  const split = Math.floor(sampleSize / 2)
  const previous = validPoints.slice(0, split)
  const recent = split === 0 ? validPoints : validPoints.slice(sampleSize - split)
  const average = (rows: MoodSnapshotContract[]) =>
    rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.score, 0) / rows.length
  const previousAverage = average(previous)
  const recentAverage = average(recent)
  const trend = trendOf(sampleSize, previousAverage, recentAverage)
  const { headline, reason } = explain(
    trend,
    sampleSize,
    previousAverage,
    recentAverage,
    counts,
  )

  return {
    conversationId,
    available: true,
    degraded: false,
    summary: {
      sampleSize,
      counts,
      trend,
      headline,
      reason,
      keywords: pickKeywords(validPoints),
      window: {
        from: validPoints[0]!.createdAt,
        to: validPoints[sampleSize - 1]!.createdAt,
      },
    },
  }
}
