import { describe, expect, it } from 'vitest'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'
import type { CorrectedMoodPoint } from './moodCorrections.js'
import { readableMoodPeriodReport, type MoodPeriodReport } from './moodPeriodReport.js'
import { buildMoodPeriodInsight } from './moodPeriodInsight.js'
import { PERIOD_INSIGHT_TYPES } from './moodPeriodInsight.js'
import {
  buildMoodPeriodInsightComparison,
  moodPeriodInsightComparisonDegraded,
} from './moodPeriodInsightComparison.js'

const NOW = new Date('2026-10-13T01:00:00.000Z')
const PERIOD_IDS = ['2026-09-21', '2026-09-28', '2026-10-05']

const MEMORY: MemoryReadContract = {
  conversationId: 'scope_1',
  available: true,
  degraded: false,
  items: [{
    id: 'mem_1',
    conversationId: 'conv_1',
    characterId: null,
    sourceMessageId: null,
    content: '有效记忆',
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
  }],
}

function timeline(points: CorrectedMoodPoint[], degraded = false): MoodTimelineContract {
  return { conversationId: 'scope_1', available: !degraded, degraded, points }
}

function point(
  id: string,
  createdAt: string,
  score: -1 | 0 | 1,
  mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
  correctionId: number | null = null,
): CorrectedMoodPoint {
  return {
    id,
    conversationId: 'conv_1',
    characterId: null,
    sourceMessageId: 'msg',
    memoryId: 'mem_1',
    mood,
    score,
    keywords: [],
    createdAt,
    tags: correctionId ? ['修正'] : [],
    reason: correctionId ? '用户修正' : '',
    originalMood: correctionId ? mood : null,
    originalScore: correctionId ? score : null,
    correctionId,
    correctedAt: correctionId ? createdAt : null,
  }
}

function reportFor(points: CorrectedMoodPoint[], periodId: string, degraded = false): MoodPeriodReport {
  return readableMoodPeriodReport('scope_1', MEMORY, timeline(points, degraded), NOW, periodId)
}

function sourceFor(periodId: string, points: CorrectedMoodPoint[]) {
  const tl = timeline(points)
  const report = reportFor(points, periodId)
  return { report, insight: buildMoodPeriodInsight(report, tl, MEMORY, periodId), timeline: tl }
}

function build(pointsByPeriod: Record<string, CorrectedMoodPoint[]>, degraded = false) {
  const sources = PERIOD_IDS.map((periodId) => {
    const points = pointsByPeriod[periodId] ?? []
    const tl = timeline(points, degraded)
    const report = reportFor(points, periodId, degraded)
    return { report, insight: buildMoodPeriodInsight(report, tl, MEMORY, periodId) }
  })
  return buildMoodPeriodInsightComparison(
    'scope_1',
    PERIOD_IDS,
    sources.map(({ report }) => report),
    sources.map(({ insight }) => insight),
    timeline(Object.values(pointsByPeriod).flat(), degraded),
    MEMORY,
  )
}

describe('v0.11 cross-period insight · 正常层', () => {
  it('golden：A vs C 三类映射与周期趋势值级断言', () => {
    const points = {
      '2026-09-21': [
        point('a1', '2026-09-21T00:00:00.000Z', 1, 'POSITIVE', 101),
        point('a2', '2026-09-22T00:00:00.000Z', 0, 'NEUTRAL'),
      ],
      '2026-09-28': [
        point('b1', '2026-09-28T00:00:00.000Z', 0, 'NEUTRAL'),
        point('b2', '2026-09-29T00:00:00.000Z', 0, 'NEUTRAL'),
      ],
      '2026-10-05': [
        point('c1', '2026-10-05T00:00:00.000Z', 1, 'POSITIVE', 102),
        point('c2', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
      ],
    }
    const result = build(points)
    expect(result.available).toBe(true)
    expect(result.degraded).toBe(false)
    expect(result.degradedReason).toBeNull()
    expect(result.targetPeriodId).toBe('2026-10-05')
    expect(result.periodIds).toEqual(PERIOD_IDS)
    expect(result.periods.map((period) => [period.periodId, period.empty])).toEqual([
      ['2026-09-21', false],
      ['2026-09-28', false],
      ['2026-10-05', false],
    ])

    const byType = new Map(result.insights.map((item) => [item.type, item]))
    expect(result.insights.map((item) => item.type)).toEqual([...PERIOD_INSIGHT_TYPES])

    expect(byType.get('DOMINANT_MOOD')?.status).toBe('READY')
    expect(byType.get('DOMINANT_MOOD')?.value).toEqual({
      direction: 'UP', rate: 1,
      fromPeriodId: '2026-09-21', toPeriodId: '2026-10-05',
      fromValue: 1, toValue: 2,
    })
    expect(byType.get('DOMINANT_MOOD')?.message).toBe('周期 2026-09-21 vs 2026-10-05：主导情绪记录数上升趋势 +100%。')

    expect(byType.get('PERIOD_TREND')?.status).toBe('READY')
    expect(byType.get('PERIOD_TREND')?.value).toEqual({
      direction: 'UP', rate: 1,
      fromPeriodId: '2026-09-21', toPeriodId: '2026-10-05',
      fromValue: 0.5, toValue: 1,
    })
    expect(byType.get('PERIOD_TREND')?.message).toBe('周期 2026-09-21 vs 2026-10-05：平均分上升趋势 +100%。')

    expect(byType.get('ANNOTATION_CORRELATION')?.status).toBe('READY')
    expect(byType.get('ANNOTATION_CORRELATION')?.value).toEqual({
      direction: 'STABLE', rate: 0,
      fromPeriodId: '2026-09-21', toPeriodId: '2026-10-05',
      fromValue: 1, toValue: 1,
    })
    expect(byType.get('ANNOTATION_CORRELATION')?.message).toBe('周期 2026-09-21 vs 2026-10-05：修正标注数持平 +0%。')
  })

  it('±5% 阈值边界：20→20 持平，20→21 上升，20→19 下降', () => {
    const pointsFor = (prefix: string, periodId: string, count: number) =>
      Array.from({ length: count }, (_, index) =>
        point(`${prefix}${index}`, `${periodId}T0${index % 10}:00:00.000Z`, 1, 'POSITIVE'),
      )
    const stable = build({
      '2026-09-21': pointsFor('a', '2026-09-21', 20),
      '2026-09-28': pointsFor('b', '2026-09-28', 20),
      '2026-10-05': pointsFor('c', '2026-10-05', 20),
    })
    expect(stable.insights.find((item) => item.type === 'DOMINANT_MOOD')?.value).toMatchObject({
      direction: 'STABLE', rate: 0, fromValue: 20, toValue: 20,
    })

    const up = build({
      '2026-09-21': pointsFor('a', '2026-09-21', 20),
      '2026-09-28': pointsFor('b', '2026-09-28', 20),
      '2026-10-05': pointsFor('c', '2026-10-05', 21),
    })
    expect(up.insights.find((item) => item.type === 'DOMINANT_MOOD')?.value).toMatchObject({
      direction: 'UP', rate: 0.05, fromValue: 20, toValue: 21,
    })

    const down = build({
      '2026-09-21': pointsFor('a', '2026-09-21', 20),
      '2026-09-28': pointsFor('b', '2026-09-28', 20),
      '2026-10-05': pointsFor('c', '2026-10-05', 19),
    })
    expect(down.insights.find((item) => item.type === 'DOMINANT_MOOD')?.value).toMatchObject({
      direction: 'DOWN', rate: -0.05, fromValue: 20, toValue: 19,
    })
  })

  it('同输入多次调用输出稳定且不存在第 4 类', () => {
    const points = {
      '2026-09-21': [point('a1', '2026-09-21T00:00:00.000Z', 1, 'POSITIVE')],
      '2026-09-28': [point('b1', '2026-09-28T00:00:00.000Z', 0, 'NEUTRAL')],
      '2026-10-05': [point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE')],
    }
    expect(build(points)).toEqual(build(points))
    expect(new Set(PERIOD_INSIGHT_TYPES)).toEqual(new Set(['DOMINANT_MOOD', 'PERIOD_TREND', 'ANNOTATION_CORRELATION']))
    expect(PERIOD_INSIGHT_TYPES).toHaveLength(3)
    for (const item of build(points).insights) {
      expect(PERIOD_INSIGHT_TYPES).toContain(item.type)
    }
  })
})

describe('v0.11 cross-period insight · 空态矩阵', () => {
  it('①目标周期空：输出 PERIOD_EMPTY 空标记，不编造方向', () => {
    const result = build({
      '2026-09-21': [point('a1', '2026-09-21T00:00:00.000Z', 1, 'POSITIVE')],
      '2026-09-28': [point('b1', '2026-09-28T00:00:00.000Z', 0, 'NEUTRAL')],
      '2026-10-05': [],
    })
    expect(result.available).toBe(true)
    expect(result.degraded).toBe(false)
    expect(result.degradedReason).toBeNull()
    expect(result.periods[2]).toMatchObject({ periodId: '2026-10-05', available: true, degraded: false, empty: true })
    for (const item of result.insights) {
      expect(item.status).toBe('EMPTY')
      expect(item.reason).toBe('PERIOD_EMPTY')
      expect(item.value).toBeNull()
      expect(item.toPeriodId ?? item.evidence.toPeriodId).toBe('2026-10-05')
      expect(item.message).toContain('对比数据不足')
    }
    expect(result.insights.length).toBeGreaterThan(0)
  })

  it('②中间周期空：不产出跳空方向，全部空标记', () => {
    const result = build({
      '2026-09-21': [point('a1', '2026-09-21T00:00:00.000Z', 1, 'POSITIVE')],
      '2026-09-28': [],
      '2026-10-05': [point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE')],
    })
    expect(result.periods[1]?.empty).toBe(true)
    expect(result.insights.length).toBeGreaterThan(0)
    for (const item of result.insights) {
      expect(item.status).toBe('EMPTY')
      expect(item.reason).toBe('PERIOD_EMPTY')
      expect(item.value).toBeNull()
    }
  })

  it('③全部周期空：200 语义合法空态', () => {
    const result = build({})
    expect(result).toMatchObject({
      available: true,
      degraded: false,
      degradedReason: null,
      insights: [],
      periodIds: PERIOD_IDS,
    })
    expect(result.periods.map((period) => period.empty)).toEqual([true, true, true])
  })

  it('④聚合源降级：降级原因封闭为 SOURCE_DEGRADED', () => {
    const points = {
      '2026-09-21': [point('a1', '2026-09-21T00:00:00.000Z', 1, 'POSITIVE')],
      '2026-09-28': [point('b1', '2026-09-28T00:00:00.000Z', 0, 'NEUTRAL')],
      '2026-10-05': [point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE')],
    }
    const result = build(points, true)
    expect(result).toEqual(moodPeriodInsightComparisonDegraded(
      'scope_1',
      '2026-10-05',
      PERIOD_IDS,
      3,
      'SOURCE_DEGRADED',
    ))
  })
})
