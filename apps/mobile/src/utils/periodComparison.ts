import type { PeriodComparisonResult } from '../types';

export type PeriodComparisonViewState =
  | { mode: 'empty' }
  | { mode: 'degraded' }
  | { mode: 'ready'; value: PeriodComparisonResult };

const COMPLETENESS = ['FULL', 'PARTIAL', 'EMPTY'] as const;

export function periodComparisonViewState(
  value: PeriodComparisonResult | null | undefined,
): PeriodComparisonViewState {
  if (!value || value.degraded || !value.available) return { mode: 'degraded' };
  const metrics = [value.current, value.previous];
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(value.periodId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.previousPeriodId) &&
    metrics.every((item) =>
      item.totalDays === 7 &&
      item.coverageDays >= 0 &&
      item.coverageDays <= 7 &&
      item.sampleSize >= 0 &&
      COMPLETENESS.includes(item.completeness) &&
      typeof item.averageScore === 'number' &&
      Number.isFinite(item.averageScore),
    ) &&
    [value.trend.currentAverage, value.trend.previousAverage, value.trend.deltaScore]
      .every((score) => typeof score === 'number' && Number.isFinite(score));
  if (!valid) return { mode: 'empty' };
  if (value.completeness.overall === 'EMPTY') return { mode: 'empty' };
  return { mode: 'ready', value };
}

export function periodComparisonHeadline(value: PeriodComparisonResult): string {
  const delta = value.trend.deltaScore;
  if (delta > 0) return `较上周提升 ${delta.toFixed(2)}`;
  if (delta < 0) return `较上周下降 ${Math.abs(delta).toFixed(2)}`;
  return '与上周持平';
}
