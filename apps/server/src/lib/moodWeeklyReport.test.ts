import { describe, expect, it } from 'vitest'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'
import { moodWeeklyReportEmpty, readableMoodWeeklyReport } from './moodWeeklyReport.js'

const NOW = new Date('2026-10-08T00:00:00.000Z')
const WINDOW_FROM = '2026-10-01T00:00:00.000Z'

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
      createdAt: WINDOW_FROM,
    },
  ],
}

function timelineWith(points: MoodTimelineContract['points']): MoodTimelineContract {
  return { conversationId: 'conv_1', available: true, degraded: false, points }
}

function point(
  id: string,
  createdAt: string,
  score: -1 | 0 | 1,
  mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
  overrides: Partial<MoodTimelineContract['points'][number]> = {},
) {
  return {
    id,
    conversationId: 'conv_1',
    characterId: 'char_1',
    sourceMessageId: 'msg_1',
    memoryId: 'mem_1',
    mood,
    score,
    keywords: [],
    createdAt,
    ...overrides,
  }
}

describe('weekly mood report', () => {
  it('builds a 7 day explainable trend from valid corrected points', () => {
    const view = readableMoodWeeklyReport(
      'conv_1',
      memoryView,
      timelineWith([
        point('mood_1', '2026-10-05T00:00:00.000Z', 1, 'POSITIVE', { keywords: ['开心'] }),
        point('mood_2', '2026-10-07T00:00:00.000Z', -1, 'NEGATIVE', {
          mood: 'NEGATIVE',
          originalMood: 'POSITIVE',
          originalScore: 1,
          correctionId: 12,
        }),
      ]),
      NOW,
    )

    expect(view).toEqual({
      conversationId: 'conv_1',
      available: true,
      degraded: false,
      report: {
        sampleSize: 2,
        counts: { positive: 1, neutral: 0, negative: 1 },
        trend: 'WORSENING',
        headline: '近7日情绪转弱，值得关注',
        reason: '近7日样本2条，前半段均分 1，后半段均分 -1，情绪转弱。',
        keywords: ['开心'],
        window: { from: WINDOW_FROM, to: NOW.toISOString() },
      },
    })
  })

  it('includes exact window boundaries and skips out of window dirty and unattributed points', () => {
    const view = readableMoodWeeklyReport(
      'conv_1',
      memoryView,
      timelineWith([
        point('old', '2026-09-30T23:59:59.999Z', 1, 'POSITIVE'),
        point('boundary', WINDOW_FROM, 1, 'POSITIVE'),
        point('future', '2026-10-08T00:00:00.001Z', 1, 'POSITIVE'),
        point('unattributed', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE', { memoryId: 'missing' }),
        point('dirty', '2026-10-07T00:00:00.000Z', 2 as never, 'NEGATIVE'),
      ]),
      NOW,
    )

    expect(view).toEqual(moodWeeklyReportEmpty('conv_1', NOW))
    expect(view.report).toBeNull()
  })
})
