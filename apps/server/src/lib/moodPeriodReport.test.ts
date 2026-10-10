import { describe, expect, it } from 'vitest'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'
import { readableMoodPeriodReport } from './moodPeriodReport.js'

// 2026-10-05（周一）为东八区自然周首日：周一 00:00+08:00 == 2026-10-04T16:00:00.000Z
const NOW = new Date('2026-10-07T02:00:00.000Z') // 东八区 2026-10-07 10:00，周三
const WEEK_FROM = '2026-10-04T16:00:00.000Z'
const WEEK_TO = '2026-10-11T16:00:00.000Z'
const WEEK_ID = '2026-10-05'

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
      createdAt: WEEK_FROM,
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

describe('natural week period mood report', () => {
  it('aggregates a natural week with per-day coverage and excludes missing days without zero fill', () => {
    const view = readableMoodPeriodReport(
      'conv_1',
      memoryView,
      timelineWith([
        // 恰为周期起点（周一 00:00+08:00）→ 计入周一（东八区 2026-10-05）
        point('mood_from', WEEK_FROM, 1, 'POSITIVE'),
        // 东八区周二 2026-10-06 两条
        point('mood_tue_a', '2026-10-05T23:00:00.000Z', 0, 'NEUTRAL'),
        point('mood_tue_b', '2026-10-05T23:30:00.000Z', -1, 'NEGATIVE'),
        // 东八区周三 2026-10-07（16:00 CST）
        point('mood_wed', '2026-10-07T08:00:00.000Z', 1, 'POSITIVE'),
        // 东八区周四 2026-10-08
        point('mood_thu', '2026-10-08T08:00:00.000Z', -1, 'NEGATIVE'),
        // 东八区周日 2026-10-11
        point('mood_sun', '2026-10-11T02:00:00.000Z', 1, 'POSITIVE', { keywords: ['开心'] }),
        // 恰为周期终点（下周一 00:00+08:00）→ 左闭右开，不计入
        point('mood_to', WEEK_TO, 1, 'POSITIVE'),
        // 上周点 → 剔除
        point('mood_lastweek', '2026-10-01T08:00:00.000Z', 1, 'POSITIVE'),
        // 无 ACTIVE 归因 → 剔除
        point('mood_orphan', '2026-10-06T09:00:00.000Z', 1, 'POSITIVE', { memoryId: 'mem_gone' }),
        // 脏点 → 剔除
        point('mood_dirty', '2026-10-06T10:00:00.000Z', 2 as never, 'POSITIVE'),
      ]),
      NOW,
    )

    expect(view.available).toBe(true)
    expect(view.degraded).toBe(false)
    expect(view.period).toEqual({ id: WEEK_ID, from: WEEK_FROM, to: WEEK_TO })
    expect(view.totalDays).toBe(7)
    expect(view.coverageDays).toBe(5)
    // 缺省剔除不零填充：恰好 5 项（05/06/07/08/11），无零值占位天
    expect(view.moods).toEqual([
      { date: '2026-10-05', count: 1, positive: 1, neutral: 0, negative: 0, averageScore: 1 },
      { date: '2026-10-06', count: 2, positive: 0, neutral: 1, negative: 1, averageScore: -0.5 },
      { date: '2026-10-07', count: 1, positive: 1, neutral: 0, negative: 0, averageScore: 1 },
      { date: '2026-10-08', count: 1, positive: 0, neutral: 0, negative: 1, averageScore: -1 },
      { date: '2026-10-11', count: 1, positive: 1, neutral: 0, negative: 0, averageScore: 1 },
    ])
    expect(view.summary).toMatchObject({
      sampleSize: 6,
      counts: { positive: 3, neutral: 1, negative: 2 },
      trend: 'IMPROVING',
    })
  })

  it('returns the legal empty period structure field by field when the week has no valid points', () => {
    const view = readableMoodPeriodReport('conv_1', memoryView, timelineWith([]), NOW)

    // 空周期是合法空结构而非错误：逐字段断言，禁止 404/500 语义或字段缺失
    expect(view).toEqual({
      conversationId: 'conv_1',
      available: true,
      degraded: false,
      period: { id: WEEK_ID, from: WEEK_FROM, to: WEEK_TO },
      coverageDays: 0,
      totalDays: 7,
      moods: [],
      summary: null,
    })
  })
})
