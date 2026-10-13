import { describe, expect, it } from 'vitest';
import {
  periodComparisonHeadline,
  periodComparisonViewState,
} from './periodComparison';
import type { PeriodComparisonResult } from '../types';

const ready: PeriodComparisonResult = {
  available: true,
  degraded: false,
  periodId: '2026-10-05',
  previousPeriodId: '2026-09-28',
  current: { periodId: '2026-10-05', from: 'from', to: 'to', sampleSize: 2, coverageDays: 2, totalDays: 7, averageScore: 0, completeness: 'PARTIAL' },
  previous: { periodId: '2026-09-28', from: 'from', to: 'to', sampleSize: 1, coverageDays: 1, totalDays: 7, averageScore: -1, completeness: 'PARTIAL' },
  trend: { currentAverage: 0, previousAverage: -1, deltaScore: 1 },
  completeness: { current: 'PARTIAL', previous: 'PARTIAL', overall: 'PARTIAL' },
};

describe('period comparison view state', () => {
  it('accepts a structurally complete ready comparison', () => {
    expect(periodComparisonViewState(ready)).toEqual({ mode: 'ready', value: ready });
    expect(periodComparisonHeadline(ready)).toBe('较上周提升 1.00');
  });

  it('maps null and degraded reads to the safe degraded state', () => {
    expect(periodComparisonViewState(null)).toEqual({ mode: 'degraded' });
    expect(periodComparisonViewState({ ...ready, available: false, degraded: true })).toEqual({ mode: 'degraded' });
  });

  it('maps an all-empty or dirty contract to empty without rendering fabricated values', () => {
    const empty: PeriodComparisonResult = {
      ...ready,
      current: { ...ready.current, sampleSize: 0, coverageDays: 0, completeness: 'EMPTY' },
      previous: { ...ready.previous, sampleSize: 0, coverageDays: 0, completeness: 'EMPTY' },
      completeness: { ...ready.completeness, overall: 'EMPTY' },
    };
    expect(periodComparisonViewState(empty)).toEqual({ mode: 'empty' });
    expect(periodComparisonViewState({ ...ready, current: { ...ready.current, coverageDays: 8 } })).toEqual({ mode: 'empty' });
  });
});
