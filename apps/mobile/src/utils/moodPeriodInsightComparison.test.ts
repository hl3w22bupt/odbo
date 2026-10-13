import { describe, expect, it } from 'vitest'
import type { PeriodInsightComparisonResult } from '../types'
import { periodInsightComparisonViewState } from './moodPeriodInsightComparison'

function result(overrides: Partial<PeriodInsightComparisonResult> = {}): PeriodInsightComparisonResult {
  return {
    conversationId: 'scope_1',
    available: true,
    degraded: false,
    degradedReason: null,
    granularity: 'NATURAL_WEEK',
    timezone: 'UTC+8',
    targetPeriodId: '2026-10-05',
    requestedPeriods: 3,
    periodIds: ['2026-09-21', '2026-09-28', '2026-10-05'],
    periods: [
      { periodId: '2026-09-21', available: true, degraded: false, empty: false, insights: [] },
      { periodId: '2026-09-28', available: true, degraded: false, empty: false, insights: [] },
      { periodId: '2026-10-05', available: true, degraded: false, empty: false, insights: [] },
    ],
    insights: [{
      type: 'PERIOD_TREND',
      status: 'READY',
      reason: null,
      value: {
        direction: 'UP', rate: 0.062, fromPeriodId: '2026-09-21', toPeriodId: '2026-10-05',
        fromValue: 0.5, toValue: 0.531,
      },
      evidence: {
        fromPeriodId: '2026-09-21', toPeriodId: '2026-10-05',
        fromSampleSize: 2, toSampleSize: 2, source: 'moodPeriodInsightComparison.trend',
      },
      message: '周期 2026-09-21 vs 2026-10-05：平均分上升趋势 +6.2%。',
    }],
    ...overrides,
  }
}

describe('period insight comparison view state', () => {
  it('accepts a ready value with cross-period direction and rate', () => {
    const view = periodInsightComparisonViewState(result())
    expect(view.mode).toBe('ready')
    if (view.mode === 'ready') {
      expect(view.value.insights[0]?.value).toMatchObject({ direction: 'UP', rate: 0.062 })
      expect(view.value.insights[0]?.message).toContain('周期 2026-09-21 vs 2026-10-05')
    }
  })

  it('separates legal empty from degraded states', () => {
    const empty = result({ insights: [] })
    expect(periodInsightComparisonViewState(empty).mode).toBe('empty')
    const degraded = result({ available: false, degraded: true, degradedReason: 'AGGREGATION_FAILED', insights: [] })
    const view = periodInsightComparisonViewState(degraded)
    expect(view.mode).toBe('degraded')
    if (view.mode === 'degraded') expect(view.reason).toBe('AGGREGATION_FAILED')
  })

  it('rejects an unknown fourth insight type', () => {
    const forged = result()
    const payload = forged.insights[0] as any
    payload.type = 'NEW_INSIGHT_TYPE'
    expect(periodInsightComparisonViewState(forged).mode).toBe('degraded')
  })
})
