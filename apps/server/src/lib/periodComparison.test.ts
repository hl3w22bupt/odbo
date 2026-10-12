import { describe, expect, it } from 'vitest'
import { readableMoodPeriodReport } from './moodPeriodReport.js'
import { compareMoodPeriods } from './periodComparison.js'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'

const memory: MemoryReadContract = {
  conversationId: 'scope_1',
  available: true,
  degraded: false,
  items: [{ id: 'mem_1', conversationId: 'conv_1', characterId: null, sourceMessageId: null, content: '有效', status: 'ACTIVE', createdAt: '2026-10-05T00:00:00.000Z' }],
}

function point(id: string, createdAt: string, score: -1 | 0 | 1, mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') {
  return { id, conversationId: 'conv_1', characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood, score, keywords: [], createdAt }
}

function timeline(points: ReturnType<typeof point>[]): MoodTimelineContract {
  return { conversationId: 'scope_1', available: true, degraded: false, points }
}

function report(periodId: string, points: ReturnType<typeof point>[]) {
  return readableMoodPeriodReport('scope_1', memory, timeline(points), new Date('2026-10-13T01:00:00.000Z'), periodId)
}

describe('v0.9 multi-period comparison', () => {
  it('exposes three deterministic trend values and per-period completeness marks', () => {
    const current = report('2026-10-05', [
      point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE'),
      point('c2', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
      point('c3', '2026-10-07T00:00:00.000Z', 1, 'POSITIVE'),
    ])
    const previous = report('2026-09-28', [point('p1', '2026-09-28T00:00:00.000Z', -1, 'NEGATIVE')])
    const view = compareMoodPeriods('2026-10-05', current, previous)

    expect(view.available).toBe(true)
    expect(view.degraded).toBe(false)
    expect(view.current).toEqual({
      periodId: '2026-10-05', from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z',
      sampleSize: 3, coverageDays: 3, totalDays: 7, averageScore: 0.3333, completeness: 'PARTIAL',
    })
    expect(view.previous).toEqual({
      periodId: '2026-09-28', from: '2026-09-27T16:00:00.000Z', to: '2026-10-04T16:00:00.000Z',
      sampleSize: 1, coverageDays: 1, totalDays: 7, averageScore: -1, completeness: 'PARTIAL',
    })
    expect(view.trend).toEqual({ currentAverage: 0.3333, previousAverage: -1, deltaScore: 1.3333 })
    expect(view.completeness).toEqual({ current: 'PARTIAL', previous: 'PARTIAL', overall: 'PARTIAL' })
  })

  it('is stable when the same aggregate inputs are compared repeatedly', () => {
    const current = report('2026-10-05', [
      point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE'),
      point('c2', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
    ])
    const previous = report('2026-09-28', [point('p1', '2026-09-28T00:00:00.000Z', -1, 'NEGATIVE')])
    expect(compareMoodPeriods('2026-10-05', current, previous)).toEqual(
      compareMoodPeriods('2026-10-05', current, previous),
    )
  })

  it('returns the legal all-empty comparison without inventing samples', () => {
    const view = compareMoodPeriods('2026-10-05', report('2026-10-05', []), report('2026-09-28', []))
    expect(view.available).toBe(true)
    expect(view.degraded).toBe(false)
    expect(view.current.sampleSize).toBe(0)
    expect(view.current.averageScore).toBe(0)
    expect(view.current.completeness).toBe('EMPTY')
    expect(view.previous.sampleSize).toBe(0)
    expect(view.previous.completeness).toBe('EMPTY')
    expect(view.trend).toEqual({ currentAverage: 0, previousAverage: 0, deltaScore: 0 })
    expect(view.completeness.overall).toBe('EMPTY')
  })
})
