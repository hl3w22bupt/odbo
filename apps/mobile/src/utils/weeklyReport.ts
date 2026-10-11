import type { MoodWeeklyReport, MoodWeeklyReportResult, MoodWeeklyTrend } from '../types';

export type MoodWeeklyReportViewState =
  | { mode: 'empty'; report: null }
  | { mode: 'degraded'; report: null }
  | { mode: 'ready'; report: MoodWeeklyReport };

const TRENDS: MoodWeeklyTrend[] = ['IMPROVING', 'STABLE', 'WORSENING'];

export function weeklyTrendLabel(trend: MoodWeeklyTrend): string {
  if (trend === 'IMPROVING') return '好转';
  if (trend === 'WORSENING') return '需要关注';
  return '平稳';
}

export function moodWeeklyReportViewState(
  value: MoodWeeklyReportResult | null | undefined,
): MoodWeeklyReportViewState {
  if (!value || value.degraded || !value.available) return { mode: 'degraded', report: null };
  const report = value.report;
  if (
    !report ||
    report.sampleSize < 2 ||
    !report.headline ||
    !report.reason ||
    !TRENDS.includes(report.trend) ||
    !Array.isArray(report.keywords) ||
    !report.window?.from ||
    !report.window?.to
  ) {
    return { mode: 'empty', report: null };
  }
  return { mode: 'ready', report };
}
