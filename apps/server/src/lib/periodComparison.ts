import {
  moodPeriodAverageScore,
  moodPeriodCompleteness,
  type MoodPeriodReport,
  type PeriodCompleteness,
} from './moodPeriodReport.js'

/**
 * v0.9 多周期对比读侧派生器。
 * 输入是 v0.8 周期聚合输出；这里只做确定性对比，不触库、不做随机或 ML。
 */

export interface PeriodMetricsContract {
  periodId: string
  from: string
  to: string
  sampleSize: number
  coverageDays: number
  totalDays: number
  averageScore: number
  completeness: PeriodCompleteness
}

export interface PeriodTrendValues {
  currentAverage: number
  previousAverage: number
  deltaScore: number
}

export interface PeriodCompletenessMark {
  current: PeriodCompleteness
  previous: PeriodCompleteness
  overall: PeriodCompleteness
}

export interface PeriodComparisonContract {
  available: boolean
  degraded: boolean
  periodId: string
  previousPeriodId: string
  current: PeriodMetricsContract
  previous: PeriodMetricsContract
  trend: PeriodTrendValues
  completeness: PeriodCompletenessMark
}

const SCALE = 10_000

function round4(value: number): number {
  return Math.round(value * SCALE) / SCALE
}

function previousPeriodId(periodId: string): string {
  const utcDay = Date.parse(`${periodId}T00:00:00.000Z`)
  return new Date(utcDay - 7 * 24 * 3_600_000).toISOString().slice(0, 10)
}

function metrics(report: MoodPeriodReport): PeriodMetricsContract {
  return {
    periodId: report.period?.id ?? '',
    from: report.period?.from ?? '',
    to: report.period?.to ?? '',
    sampleSize: report.summary?.sampleSize ?? 0,
    coverageDays: report.coverageDays,
    totalDays: report.totalDays,
    averageScore: round4(moodPeriodAverageScore(report) ?? 0),
    completeness: moodPeriodCompleteness(report),
  }
}

export function periodComparisonDegraded(periodId: string): PeriodComparisonContract {
  const previousId = previousPeriodId(periodId)
  const empty = (id: string): PeriodMetricsContract => ({
    periodId: id,
    from: '',
    to: '',
    sampleSize: 0,
    coverageDays: 0,
    totalDays: 7,
    averageScore: 0,
    completeness: 'EMPTY',
  })
  return {
    available: false,
    degraded: true,
    periodId,
    previousPeriodId: previousId,
    current: empty(periodId),
    previous: empty(previousId),
    trend: { currentAverage: 0, previousAverage: 0, deltaScore: 0 },
    completeness: { current: 'EMPTY', previous: 'EMPTY', overall: 'EMPTY' },
  }
}

/** v0.13 开放点定案：未知周期返回既有比较信封的合法空结构，不抛 400/404。 */
export function periodComparisonUnknownPeriod(periodId: string): PeriodComparisonContract {
  const empty = (id: string): PeriodMetricsContract => ({
    periodId: id,
    from: '',
    to: '',
    sampleSize: 0,
    coverageDays: 0,
    totalDays: 7,
    averageScore: 0,
    completeness: 'EMPTY',
  })
  return {
    available: false,
    degraded: true,
    periodId,
    previousPeriodId: periodId,
    current: empty(periodId),
    previous: empty(periodId),
    trend: { currentAverage: 0, previousAverage: 0, deltaScore: 0 },
    completeness: { current: 'EMPTY', previous: 'EMPTY', overall: 'EMPTY' },
  }
}

export function compareMoodPeriods(
  periodId: string,
  current: MoodPeriodReport,
  previous: MoodPeriodReport,
): PeriodComparisonContract {
  if (current.degraded || !current.available || previous.degraded || !previous.available) {
    return periodComparisonDegraded(periodId)
  }

  const currentMetrics = metrics(current)
  const previousMetrics = metrics(previous)
  const overall: PeriodCompleteness =
    currentMetrics.completeness === 'FULL' && previousMetrics.completeness === 'FULL'
      ? 'FULL'
      : currentMetrics.completeness === 'EMPTY' && previousMetrics.completeness === 'EMPTY'
        ? 'EMPTY'
        : 'PARTIAL'

  return {
    available: true,
    degraded: false,
    periodId,
    previousPeriodId: previousPeriodId(periodId),
    current: currentMetrics,
    previous: previousMetrics,
    trend: {
      currentAverage: currentMetrics.averageScore,
      previousAverage: previousMetrics.averageScore,
      deltaScore: round4(currentMetrics.averageScore - previousMetrics.averageScore),
    },
    completeness: {
      current: currentMetrics.completeness,
      previous: previousMetrics.completeness,
      overall,
    },
  }
}
