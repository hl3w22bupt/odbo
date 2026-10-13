import type { MemoryReadContract, MoodSnapshotContract, MoodTimelineContract } from './conversationInsights.js'

/**
 * v0.9 多周期对比读侧派生器。输入已经过 latest-wins 修正；
 * 这里保持纯函数，不触库、不写库。冻结口径见 docs/v0.9/REQUIREMENTS.md。
 */

export const COMPARISON_DIMENSIONS = [
  'count',
  'positive',
  'neutral',
  'negative',
  'averageScore',
] as const

export type ComparisonDimension = (typeof COMPARISON_DIMENSIONS)[number]
export type ComparisonTrend = 'UP' | 'STABLE' | 'DOWN' | null

export type ComparisonValue = Record<ComparisonDimension, number | null>

export interface ComparisonCompleteness {
  expectedPoints: number
  actualPoints: number
  ratio: number
  status: 'COMPLETE' | 'PARTIAL' | 'EMPTY'
}

export interface ComparisonPeriod {
  id: string
  from: string
  to: string
  sourceAvailable: boolean
  empty: boolean
  aggregateValues: ComparisonValue
  completeness: ComparisonCompleteness
}

export interface ComparisonTrendPair {
  fromPeriodId: string
  toPeriodId: string
  dimension: ComparisonDimension
  previousValue: number | null
  nextValue: number | null
  rate: number | null
  direction: ComparisonTrend
  empty: boolean
}

export interface OverallComparisonTrend {
  dimension: ComparisonDimension
  rate: number | null
  direction: ComparisonTrend
  empty: boolean
}

export interface MoodPeriodComparison {
  conversationId: string
  available: boolean
  degraded: boolean
  granularity: 'NATURAL_WEEK'
  timezone: 'UTC+8'
  requestedPeriods: number
  failedPeriodIds: string[]
  periods: ComparisonPeriod[]
  completeness: ComparisonCompleteness
  trendPairs: ComparisonTrendPair[]
  overallTrends: OverallComparisonTrend[]
}

const CST_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const POINTS_PER_PERIOD = COMPARISON_DIMENSIONS.length
export const MAX_COMPARISON_PERIODS = 3

function isValidDate(value: string): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

/** 东八区周一 00:00 对应 UTC 瞬间；窗口左闭右开。 */
export function naturalWeekBounds(nowMs: number): { fromMs: number; toMs: number } {
  const shifted = nowMs + CST_OFFSET_MS
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS
  const weekday = new Date(dayStartShifted).getUTCDay()
  const mondayShifted = dayStartShifted - ((weekday + 6) % 7) * DAY_MS
  const fromMs = mondayShifted - CST_OFFSET_MS
  return { fromMs, toMs: fromMs + 7 * DAY_MS }
}

function emptyValues(): ComparisonValue {
  return {
    count: null,
    positive: null,
    neutral: null,
    negative: null,
    averageScore: null,
  }
}

function completenessFor(actualPoints: number, expectedPoints: number): ComparisonCompleteness {
  const ratio = expectedPoints === 0 ? 0 : actualPoints / expectedPoints
  return {
    expectedPoints,
    actualPoints,
    ratio,
    status: actualPoints === expectedPoints ? 'COMPLETE' : actualPoints === 0 ? 'EMPTY' : 'PARTIAL',
  }
}

function emptyPeriod(id: string, fromMs: number, sourceAvailable = true): ComparisonPeriod {
  const toMs = Date.parse(idToFrom(id)) + 7 * DAY_MS
  return {
    id,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    sourceAvailable,
    empty: true,
    aggregateValues: emptyValues(),
    completeness: completenessFor(0, POINTS_PER_PERIOD),
  }
}

/** id 就是东八区周一日期；id 对应的 UTC 周一瞬间可反向确定。 */
function idToFrom(id: string): string {
  return new Date(`${id}T00:00:00.000+08:00`).toISOString()
}

function aggregatePeriod(
  id: string,
  fromMs: number,
  points: MoodSnapshotContract[],
  sourceAvailable: boolean,
): ComparisonPeriod {
  const period = emptyPeriod(id, fromMs, sourceAvailable)
  if (!sourceAvailable) return period

  const counts = { positive: 0, neutral: 0, negative: 0 }
  let scoreSum = 0
  for (const point of points) {
    scoreSum += point.score
    if (point.mood === 'POSITIVE') counts.positive += 1
    else if (point.mood === 'NEGATIVE') counts.negative += 1
    else counts.neutral += 1
  }

  if (points.length === 0) return period
  period.empty = false
  period.aggregateValues = {
    count: points.length,
    positive: counts.positive,
    neutral: counts.neutral,
    negative: counts.negative,
    averageScore: scoreSum / points.length,
  }
  period.completeness = completenessFor(POINTS_PER_PERIOD, POINTS_PER_PERIOD)
  return period
}

function relativeTrend(previous: number | null, next: number | null): { rate: number | null; direction: ComparisonTrend; empty: boolean } {
  if (previous === null || next === null || previous === 0) {
    return { rate: null, direction: null, empty: true }
  }
  const rate = (next - previous) / previous
  return {
    rate,
    direction: rate >= 0.05 ? 'UP' : rate <= -0.05 ? 'DOWN' : 'STABLE',
    empty: false,
  }
}

export function readableMoodPeriodComparison(
  conversationId: string,
  memory: MemoryReadContract,
  timeline: MoodTimelineContract,
  requestedPeriods: number,
  now: Date,
  failedPeriodIndexes: readonly number[] = [],
): MoodPeriodComparison {
  const nowMs = now.getTime()
  const failed = new Set(failedPeriodIndexes)
  const bounds = Array.from({ length: requestedPeriods }, (_, index) => {
    const offset = requestedPeriods - 1 - index
    return naturalWeekBounds(nowMs - offset * 7 * DAY_MS)
  })
  const ids = bounds.map(({ fromMs }) => {
    const shifted = fromMs + CST_OFFSET_MS
    return new Date(shifted).toISOString().slice(0, 10)
  })

  const activeMemoryIds = new Set(
    memory.available && !memory.degraded
      ? memory.items.filter((item) => item.status === 'ACTIVE' && item.id).map((item) => item.id)
      : [],
  )

  const periods = bounds.map(({ fromMs, toMs }, index) => {
    const points = timeline.points
      .filter((point) => {
        const at = Date.parse(point.createdAt)
        return Boolean(
          point.id &&
            activeMemoryIds.has(point.memoryId ?? '') &&
            isValidDate(point.createdAt) &&
            at >= fromMs &&
            at < toMs &&
            (point.mood === 'POSITIVE' || point.mood === 'NEUTRAL' || point.mood === 'NEGATIVE') &&
            (point.score === -1 || point.score === 0 || point.score === 1),
        )
      })
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const id = ids[index]
    if (!id) throw new Error('comparison period id missing')
    return aggregatePeriod(id, fromMs, points, !failed.has(index))
  })

  const actualPoints = periods.reduce((sum, period) => sum + period.completeness.actualPoints, 0)
  const expectedPoints = requestedPeriods * POINTS_PER_PERIOD
  const trendPairs: ComparisonTrendPair[] = []
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1]
    const next = periods[index]
    if (!previous || !next) continue
    for (const dimension of COMPARISON_DIMENSIONS) {
      const previousValue = previous.aggregateValues[dimension]
      const nextValue = next.aggregateValues[dimension]
      const trend = relativeTrend(previousValue, nextValue)
      trendPairs.push({
        fromPeriodId: previous.id,
        toPeriodId: next.id,
        dimension,
        previousValue,
        nextValue,
        ...trend,
      })
    }
  }

  // 任何周期空/源失败都会破坏跨周期语义；整体趋势不做跳空对比。
  const overallTrends = COMPARISON_DIMENSIONS.map((dimension) => {
    const usable = periods.length >= 2 && periods.every((period) => period.sourceAvailable && !period.empty)
    if (!usable) return { dimension, rate: null, direction: null, empty: true }
    const first = periods[0]
    const last = periods[periods.length - 1]
    const trend = relativeTrend(first?.aggregateValues[dimension] ?? null, last?.aggregateValues[dimension] ?? null)
    return { dimension, ...trend }
  })

  return {
    conversationId,
    available: true,
    degraded: failed.size > 0,
    granularity: 'NATURAL_WEEK',
    timezone: 'UTC+8',
    requestedPeriods,
    failedPeriodIds: periods.filter((period) => !period.sourceAvailable).map((period) => period.id),
    periods,
    completeness: completenessFor(actualPoints, expectedPoints),
    trendPairs,
    overallTrends,
  }
}

export function moodPeriodComparisonDegraded(conversationId: string, requestedPeriods: number): MoodPeriodComparison {
  return {
    conversationId,
    available: false,
    degraded: true,
    granularity: 'NATURAL_WEEK',
    timezone: 'UTC+8',
    requestedPeriods,
    failedPeriodIds: [],
    periods: [],
    completeness: completenessFor(0, requestedPeriods * POINTS_PER_PERIOD),
    trendPairs: [],
    overallTrends: COMPARISON_DIMENSIONS.map((dimension) => ({ dimension, rate: null, direction: null, empty: true })),
  }
}
