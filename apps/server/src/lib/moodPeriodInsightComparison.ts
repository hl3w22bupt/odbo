import type {
  MemoryReadContract,
  MoodTimelineContract,
} from './conversationInsights.js'
import { correctedSamplesInPeriod, PERIOD_INSIGHT_TYPES, type MoodPeriodInsightContract, type PeriodInsightType } from './moodPeriodInsight.js'
import { comparisonRelativeTrend } from './moodPeriodComparison.js'
import type { MoodPeriodReport } from './moodPeriodReport.js'

/**
 * v0.11 跨周期情绪洞察：只读拼装 v0.8 周期报告、v0.10 单周期洞察与 v0.9 ±5% 趋势口径。
 * 洞察 type 仍封顶三类；这里只扩展 A→C 的周期维度，不新增洞察类型、不触库、无时钟。
 */

export type InsightComparisonDirection = 'UP' | 'STABLE' | 'DOWN'
export type InsightComparisonDegradedReason = 'SOURCE_DEGRADED' | 'AGGREGATION_FAILED'
export type InsightComparisonEmptyReason = 'PERIOD_EMPTY' | 'METRIC_MISSING' | 'ZERO_BASE'

export interface InsightComparisonValue {
  direction: InsightComparisonDirection
  rate: number
  fromPeriodId: string
  toPeriodId: string
  fromValue: number
  toValue: number
}

export interface InsightComparisonEvidence {
  fromPeriodId: string
  toPeriodId: string
  fromSampleSize: number
  toSampleSize: number
  source: string
}

export interface MoodPeriodInsightComparisonItem {
  type: PeriodInsightType
  status: 'READY' | 'EMPTY'
  reason: InsightComparisonEmptyReason | null
  value: InsightComparisonValue | null
  evidence: InsightComparisonEvidence
  message: string
}

export interface MoodPeriodInsightComparisonPeriod {
  periodId: string
  available: boolean
  degraded: boolean
  empty: boolean
  insights: MoodPeriodInsightContract['insights']
}

export interface MoodPeriodInsightComparisonContract {
  conversationId: string
  available: boolean
  degraded: boolean
  degradedReason: InsightComparisonDegradedReason | null
  granularity: 'NATURAL_WEEK'
  timezone: 'UTC+8'
  targetPeriodId: string
  requestedPeriods: number
  periodIds: string[]
  periods: Array<MoodPeriodInsightComparisonPeriod>
  insights: Array<MoodPeriodInsightComparisonItem>
}

const SCALE = 10_000
const DIRECTION_LABELS: Record<InsightComparisonDirection, string> = {
  UP: '上升趋势',
  STABLE: '持平',
  DOWN: '下降趋势',
}
const COMPARISON_SOURCE_BY_TYPE: Record<PeriodInsightType, string> = {
  DOMINANT_MOOD: 'moodPeriodInsightComparison.dominant',
  PERIOD_TREND: 'moodPeriodInsightComparison.trend',
  ANNOTATION_CORRELATION: 'moodPeriodInsightComparison.annotation',
}

const METRIC_LABELS: Record<PeriodInsightType, string> = {
  DOMINANT_MOOD: '主导情绪记录数',
  PERIOD_TREND: '平均分',
  ANNOTATION_CORRELATION: '修正标注数',
}

function round4(value: number): number {
  return Math.round(value * SCALE) / SCALE
}

function formatPercent(rate: number): string {
  const value = Number((rate * 100).toFixed(1)).toString()
  return `${rate >= 0 ? '+' : ''}${value}%`
}

export function moodPeriodInsightComparisonDegraded(
  conversationId: string,
  targetPeriodId: string,
  periodIds: readonly string[],
  requestedPeriods: number,
  reason: InsightComparisonDegradedReason,
): MoodPeriodInsightComparisonContract {
  return {
    conversationId,
    available: false,
    degraded: true,
    degradedReason: reason,
    granularity: 'NATURAL_WEEK',
    timezone: 'UTC+8',
    targetPeriodId,
    requestedPeriods,
    periodIds: [...periodIds],
    periods: [],
    insights: [],
  }
}

function metricOf(type: PeriodInsightType, insight: MoodPeriodInsightContract): number | null {
  const item = insight.insights.find((candidate) => candidate.type === type)
  if (!item) return null
  if (type === 'DOMINANT_MOOD' && 'count' in item.value) return item.value.count
  if (type === 'PERIOD_TREND' && 'averageScore' in item.value) return item.value.averageScore
  if (type === 'ANNOTATION_CORRELATION' && 'correctedSamples' in item.value) return item.value.correctedSamples
  return null
}

function emptyItem(
  type: PeriodInsightType,
  fromPeriodId: string,
  toPeriodId: string,
  fromSampleSize: number,
  toSampleSize: number,
  reason: InsightComparisonEmptyReason,
): MoodPeriodInsightComparisonItem {
  return {
    type,
    status: 'EMPTY',
    reason,
    value: null,
    evidence: {
      fromPeriodId,
      toPeriodId,
      fromSampleSize,
      toSampleSize,
      source: COMPARISON_SOURCE_BY_TYPE[type],
    },
    message: `周期 ${fromPeriodId} vs ${toPeriodId}：对比数据不足，${METRIC_LABELS[type]}趋势未计算。`,
  }
}

export function buildMoodPeriodInsightComparison(
  conversationId: string,
  periodIds: readonly string[],
  reports: readonly MoodPeriodReport[],
  insights: readonly MoodPeriodInsightContract[],
  timeline: MoodTimelineContract,
  memory: MemoryReadContract,
): MoodPeriodInsightComparisonContract {
  const targetPeriodId = periodIds[periodIds.length - 1] ?? ''
  const requestedPeriods = periodIds.length
  if (requestedPeriods === 0 || periodIds.length !== reports.length || reports.length !== insights.length) {
    return moodPeriodInsightComparisonDegraded(
      conversationId,
      targetPeriodId,
      periodIds,
      requestedPeriods,
      'SOURCE_DEGRADED',
    )
  }

  const periods: Array<MoodPeriodInsightComparisonPeriod> = reports.map((report, index) => {
    const periodId = periodIds[index] ?? ''
    const insight = insights[index]
    const available = Boolean(
      report.available && !report.degraded && insight &&
        insight.available && !insight.degraded && insight.periodId === periodId &&
        report.period?.id === periodId,
    )
    return {
      periodId,
      available,
      degraded: !available,
      empty: available && (!report.summary || report.summary.sampleSize === 0),
      insights: available ? [...(insight?.insights ?? [])] : [],
    }
  })

  const sourceDegraded = periods.some((period) => period.degraded)
  if (sourceDegraded) {
    return moodPeriodInsightComparisonDegraded(
      conversationId,
      targetPeriodId,
      periodIds,
      requestedPeriods,
      'SOURCE_DEGRADED',
    )
  }

  if (periods.length < 2) {
    return {
      conversationId,
      available: true,
      degraded: false,
      degradedReason: null,
      granularity: 'NATURAL_WEEK',
      timezone: 'UTC+8',
      targetPeriodId,
      requestedPeriods,
      periodIds: [...periodIds],
      periods,
      insights: [],
    }
  }

  const fromIndex = 0
  const toIndex = periods.length - 1
  const fromPeriodId = periodIds[fromIndex] ?? ''
  const toPeriodId = periodIds[toIndex] ?? ''
  const fromReport = reports[fromIndex]
  const toReport = reports[toIndex]
  const fromSampleSize = fromReport?.summary?.sampleSize ?? 0
  const toSampleSize = toReport?.summary?.sampleSize ?? 0
  const fromInsight = insights[fromIndex]
  const toInsight = insights[toIndex]
  const types = new Set<PeriodInsightType>()
  for (const insight of insights) {
    for (const item of insight.insights) types.add(item.type)
  }

  const comparisonInsights: Array<MoodPeriodInsightComparisonItem> = []
  for (const type of PERIOD_INSIGHT_TYPES) {
    if (!types.has(type)) continue

    if (periods.some((period) => period.empty)) {
      comparisonInsights.push(emptyItem(type, fromPeriodId, toPeriodId, fromSampleSize, toSampleSize, 'PERIOD_EMPTY'))
      continue
    }

    const fromValue = metricOf(type, fromInsight!)
    const toValue = metricOf(type, toInsight!)
    const resolvedFrom = fromValue ?? (
      type === 'ANNOTATION_CORRELATION' && fromReport?.period
        ? correctedSamplesInPeriod(
            timeline,
            memory,
            Date.parse(fromReport.period.from),
            Date.parse(fromReport.period.to),
          )
        : null
    )
    const resolvedTo = toValue ?? (
      type === 'ANNOTATION_CORRELATION' && toReport?.period
        ? correctedSamplesInPeriod(
            timeline,
            memory,
            Date.parse(toReport.period.from),
            Date.parse(toReport.period.to),
          )
        : null
    )

    if (resolvedFrom === null || resolvedTo === null) {
      comparisonInsights.push(emptyItem(type, fromPeriodId, toPeriodId, fromSampleSize, toSampleSize, 'METRIC_MISSING'))
      continue
    }
    if (resolvedFrom === 0) {
      comparisonInsights.push(emptyItem(type, fromPeriodId, toPeriodId, fromSampleSize, toSampleSize, 'ZERO_BASE'))
      continue
    }

    const trend = comparisonRelativeTrend(resolvedFrom, resolvedTo)
    if (trend.empty || trend.direction === null || trend.rate === null) {
      comparisonInsights.push(emptyItem(type, fromPeriodId, toPeriodId, fromSampleSize, toSampleSize, 'ZERO_BASE'))
      continue
    }

    const rate = round4(trend.rate)
    comparisonInsights.push({
      type,
      status: 'READY',
      reason: null,
      value: {
        direction: trend.direction,
        rate,
        fromPeriodId,
        toPeriodId,
        fromValue: resolvedFrom,
        toValue: resolvedTo,
      },
      evidence: {
        fromPeriodId,
        toPeriodId,
        fromSampleSize,
        toSampleSize,
        source: COMPARISON_SOURCE_BY_TYPE[type],
      },
      message: `周期 ${fromPeriodId} vs ${toPeriodId}：${METRIC_LABELS[type]}${DIRECTION_LABELS[trend.direction]} ${formatPercent(rate)}。`,
    })
  }

  return {
    conversationId,
    available: true,
    degraded: false,
    degradedReason: null,
    granularity: 'NATURAL_WEEK',
    timezone: 'UTC+8',
    targetPeriodId,
    requestedPeriods,
    periodIds: [...periodIds],
    periods,
    insights: comparisonInsights,
  }
}
