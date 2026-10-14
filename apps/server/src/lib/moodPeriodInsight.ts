import type {
  MemoryReadContract,
  MoodSnapshotContract,
  MoodTimelineContract,
} from './conversationInsights.js'
import type { CorrectedMoodPoint } from './moodCorrections.js'
import {
  moodPeriodAverageScore,
  type MoodPeriodReport,
  type MoodPeriodSummary,
} from './moodPeriodReport.js'

/**
 * v0.10 情绪洞察最小版读侧派生器（单周期起步）。
 * 输入 = 既有聚合输出：v0.8 周期报告 + v0.7 修正应用后的 timeline；零新采集、零写侧、零跨用户。
 * 周期口径（UTC+8 / ISO 周一 / 左闭右开）复用 moodPeriodReport 冻结模块，引用非复制。
 * 三类封顶：DOMINANT_MOOD / PERIOD_TREND / ANNOTATION_CORRELATION；每条洞察 =
 * { type, value, evidence, message } 四元组。确定性纯函数：无 ML、无随机、时钟不入本模块。
 */

export const PERIOD_INSIGHT_TYPES = [
  'DOMINANT_MOOD',
  'PERIOD_TREND',
  'ANNOTATION_CORRELATION',
] as const

export type PeriodInsightType = (typeof PERIOD_INSIGHT_TYPES)[number]
export type InsightMood = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type InsightTrend = MoodPeriodSummary['trend']

export interface InsightEvidence {
  periodId: string
  from: string
  to: string
  sampleSize: number
  source: string
}

export interface MoodPeriodInsightItem {
  type: PeriodInsightType
  value:
    | { mood: InsightMood; count: number; share: number }
    | { trend: InsightTrend; sampleSize: number; averageScore: number; coverageDays: number }
    | { correctedSamples: number; sampleSize: number }
  evidence: InsightEvidence
  message: string
}

export interface MoodPeriodInsightContract {
  conversationId: string
  available: boolean
  degraded: boolean
  periodId: string
  insights: MoodPeriodInsightItem[]
}

const SCALE = 10_000
const MOOD_PRIORITY = ['NEGATIVE', 'NEUTRAL', 'POSITIVE'] as const
const MOOD_LABELS: Record<InsightMood, string> = { POSITIVE: '积极', NEUTRAL: '平稳', NEGATIVE: '低落' }
const TREND_LABELS: Record<InsightTrend, string> = { IMPROVING: '好转', STABLE: '平稳', WORSENING: '需要关注' }

function round4(value: number): number {
  return Math.round(value * SCALE) / SCALE
}

function formatScore(value: number): string {
  return Number(value.toFixed(2)).toString()
}

export function moodPeriodInsightDegraded(conversationId: string, periodId: string): MoodPeriodInsightContract {
  return { conversationId, available: false, degraded: true, periodId, insights: [] }
}

/** 修正标注关联：timeline 点位在 v0.7 修正应用后携带 correctionId（number | null）；契约类型未收窄，这里做运行时防御。 */
function correctionIdOf(point: MoodSnapshotContract): number | string | null {
  const raw: unknown = (point as CorrectedMoodPoint).correctionId
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null
  if (typeof raw === 'string') return raw.trim() !== '' ? raw : null
  return null
}

/**
 * 标注关联计数：与 v0.8 周期报告同口径（有效 id + ACTIVE 记忆 + 可解析时间 +
 * 周期窗口 [from, to) + 合法 mood/score），在此之上要求带 correctionId，保证 correctedSamples ≤ sampleSize。
 */
export function correctedSamplesInPeriod(
  timeline: MoodTimelineContract,
  memory: MemoryReadContract,
  fromMs: number,
  toMs: number,
): number {
  const activeMemoryIds = new Set(
    memory.items.filter((item) => item.status === 'ACTIVE' && item.id).map((item) => item.id),
  )
  return timeline.points.filter((point) => {
    const at = Date.parse(point.createdAt)
    return Boolean(
      point.id &&
        activeMemoryIds.has(point.memoryId ?? '') &&
        Number.isFinite(at) &&
        at >= fromMs &&
        at < toMs &&
        (point.mood === 'POSITIVE' || point.mood === 'NEUTRAL' || point.mood === 'NEGATIVE') &&
        (point.score === -1 || point.score === 0 || point.score === 1) &&
        correctionIdOf(point) !== null,
    )
  }).length
}

export function buildMoodPeriodInsight(
  report: MoodPeriodReport,
  timeline: MoodTimelineContract,
  memory: MemoryReadContract,
  periodId: string,
): MoodPeriodInsightContract {
  if (report.degraded || !report.available || !report.period || report.period.id !== periodId) {
    return moodPeriodInsightDegraded(report.conversationId, periodId)
  }
  const summary = report.summary
  if (!summary || summary.sampleSize === 0) {
    return { conversationId: report.conversationId, available: true, degraded: false, periodId, insights: [] }
  }

  const base = {
    periodId,
    from: report.period.from,
    to: report.period.to,
    sampleSize: summary.sampleSize,
  }
  const insights: MoodPeriodInsightItem[] = []

  const countByMood: Record<InsightMood, number> = {
    POSITIVE: summary.counts.positive,
    NEUTRAL: summary.counts.neutral,
    NEGATIVE: summary.counts.negative,
  }
  const dominant = MOOD_PRIORITY.reduce(
    (best, mood) => (countByMood[mood] > countByMood[best] ? mood : best),
    MOOD_PRIORITY[0],
  )
  const dominantCount = countByMood[dominant]
  insights.push({
    type: 'DOMINANT_MOOD',
    value: { mood: dominant, count: dominantCount, share: round4(dominantCount / summary.sampleSize) },
    evidence: { ...base, source: 'moodPeriodReport.summary.counts' },
    message: `本周期以${MOOD_LABELS[dominant]}为主：${dominantCount}/${summary.sampleSize} 条记录为${MOOD_LABELS[dominant]}。`,
  })

  const averageScore = round4(moodPeriodAverageScore(report) ?? 0)
  insights.push({
    type: 'PERIOD_TREND',
    value: { trend: summary.trend, sampleSize: summary.sampleSize, averageScore, coverageDays: report.coverageDays },
    evidence: { ...base, source: 'moodPeriodReport.summary.trend' },
    message: `样本 ${summary.sampleSize} 条、覆盖 ${report.coverageDays}/7 天，平均 ${formatScore(averageScore)}，趋势${TREND_LABELS[summary.trend]}。`,
  })

  const corrected = correctedSamplesInPeriod(timeline, memory, Date.parse(report.period.from), Date.parse(report.period.to))
  if (corrected > 0) {
    insights.push({
      type: 'ANNOTATION_CORRELATION',
      value: { correctedSamples: corrected, sampleSize: summary.sampleSize },
      evidence: { ...base, source: 'moodTimeline.points[correctionId]' },
      message: `本周期 ${corrected}/${summary.sampleSize} 条记录应用了你的修正标注。`,
    })
  }

  return {
    conversationId: report.conversationId,
    available: true,
    degraded: false,
    periodId,
    insights,
  }
}
