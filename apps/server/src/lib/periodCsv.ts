import {
  moodPeriodCompleteness,
  type MoodPeriodReport,
} from './moodPeriodReport.js'

/** v0.9 周期 CSV：表头列序冻结；不输出 row_count 或其他行数元信息。 */
export const PERIOD_CSV_COLUMNS = [
  'period_id',
  'date',
  'available',
  'degraded',
  'from',
  'to',
  'positive',
  'neutral',
  'negative',
  'sample_size',
  'average_score',
  'coverage_days',
  'total_days',
  'completeness',
] as const

function escapeCsv(value: string | number | boolean): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function moodPeriodReportCsv(report: MoodPeriodReport): string {
  const common: Array<string | number | boolean> = [
    report.period?.id ?? '',
    '',
    report.available,
    report.degraded,
    report.period?.from ?? '',
    report.period?.to ?? '',
    report.summary?.counts.positive ?? 0,
    report.summary?.counts.neutral ?? 0,
    report.summary?.counts.negative ?? 0,
    report.summary?.sampleSize ?? 0,
    report.moods.length ? report.moods.reduce((sum, day) => sum + day.averageScore * day.count, 0) / (report.summary?.sampleSize || 1) : 0,
    report.coverageDays,
    report.totalDays,
    moodPeriodCompleteness(report),
  ]

  const rows = report.moods.map((day) => {
    const values = [...common]
    values[1] = day.date
    values[6] = day.positive
    values[7] = day.neutral
    values[8] = day.negative
    values[10] = day.averageScore
    return values.map(escapeCsv).join(',')
  })
  return [PERIOD_CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}
