import { describe, expect, it } from 'vitest'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'
import {
  moodInsightDegraded,
  moodInsightEmpty,
  readableMoodInsightSummary,
} from './moodInsight.js'

const memoryView: MemoryReadContract = {
  conversationId: 'conv_1',
  available: true,
  degraded: false,
  items: [
    {
      id: 'mem_1',
      conversationId: 'conv_1',
      characterId: 'char_1',
      sourceMessageId: 'msg_1',
      content: '女儿下周生日',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
}

function timelineWith(
  points: MoodTimelineContract['points'],
  overrides: Partial<MoodTimelineContract> = {},
): MoodTimelineContract {
  return {
    conversationId: 'conv_1',
    available: true,
    degraded: false,
    points,
    ...overrides,
  }
}

function point(id: string, createdAt: string, score: -1 | 0 | 1, mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE', keywords: string[] = []) {
  return {
    id,
    conversationId: 'conv_1',
    characterId: 'char_1',
    sourceMessageId: 'msg_1',
    memoryId: 'mem_1',
    mood: mood as const,
    score,
    keywords,
    createdAt,
  }
}

describe('mood insight summary', () => {
  it('returns an explicit empty insight before any valid mood point', () => {
    expect(readableMoodInsightSummary('conv_1', memoryView, timelineWith([]))).toEqual(
      moodInsightEmpty('conv_1'),
    )
    expect(moodInsightEmpty('conv_1')).toEqual({
      conversationId: 'conv_1',
      available: true,
      degraded: false,
      summary: null,
    })
  })

  it('aggregates an explainable trend from active memory-backed snapshots', () => {
    const view = readableMoodInsightSummary(
      'conv_1',
      memoryView,
      timelineWith([
        point('mood_1', '2026-01-01T00:00:00.000Z', -1, 'NEGATIVE', ['孤独']),
        point('mood_2', '2026-01-02T00:00:00.000Z', 0, 'NEUTRAL'),
        point('mood_3', '2026-01-03T00:00:00.000Z', 1, 'POSITIVE', ['开心']),
        point('mood_4', '2026-01-04T00:00:00.000Z', 1, 'POSITIVE', ['开心']),
      ]),
    )

    expect(view.available).toBe(true)
    expect(view.degraded).toBe(false)
    expect(view.summary).toMatchObject({
      sampleSize: 4,
      counts: { positive: 2, neutral: 1, negative: 1 },
      trend: 'IMPROVING',
      headline: '最近情绪有所好转',
      keywords: ['开心', '孤独'],
      window: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-04T00:00:00.000Z',
      },
    })
    expect(view.summary?.reason).toContain('前半段均分 -0.5')
    expect(view.summary?.reason).toContain('后半段均分 1')
  })

  it('skips dirty points that are not backed by an active memory', () => {
    const view = readableMoodInsightSummary(
      'conv_1',
      memoryView,
      timelineWith([
        { ...point('mood_dirty', '2026-01-02T00:00:00.000Z', 1, 'POSITIVE', ['半写']), memoryId: 'mem_missing' },
        point('mood_1', '2026-01-01T00:00:00.000Z', 1, 'POSITIVE', ['开心']),
      ]),
    )

    expect(view.summary).toMatchObject({
      sampleSize: 1,
      trend: 'STABLE',
      keywords: ['开心'],
      window: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
    })
  })

  it('degrades when either source read is degraded', () => {
    const dirtyMemory: MemoryReadContract = { ...memoryView, available: false, degraded: true }
    const dirtyTimeline = timelineWith([], { available: false, degraded: true })

    expect(readableMoodInsightSummary('conv_1', dirtyMemory, timelineWith([]))).toEqual(
      moodInsightDegraded('conv_1'),
    )
    expect(readableMoodInsightSummary('conv_1', memoryView, dirtyTimeline)).toEqual(
      moodInsightDegraded('conv_1'),
    )
    expect(moodInsightDegraded('conv_1')).toEqual({
      conversationId: 'conv_1',
      available: false,
      degraded: true,
      summary: null,
    })
  })
})
