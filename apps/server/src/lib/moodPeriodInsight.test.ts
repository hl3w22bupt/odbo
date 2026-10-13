import { describe, expect, it } from 'vitest'
import { readableMoodPeriodReport, moodPeriodAverageScore } from './moodPeriodReport.js'
import type { MoodPeriodReport } from './moodPeriodReport.js'
import {
  PERIOD_INSIGHT_TYPES,
  buildMoodPeriodInsight,
  moodPeriodInsightDegraded,
} from './moodPeriodInsight.js'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'
import type { CorrectedMoodPoint } from './moodCorrections.js'

const NOW = new Date('2026-10-13T01:00:00.000Z') // 固定时钟注入：2026-10-13 为周二（东八区）

function memoryWith(activeIds: string[]): MemoryReadContract {
  return {
    conversationId: 'scope_1',
    available: true,
    degraded: false,
    items: ['mem_1', 'mem_2'].map((id) => ({
      id,
      conversationId: 'conv_1',
      characterId: null,
      sourceMessageId: null,
      content: '有效',
      status: activeIds.includes(id) ? 'ACTIVE' : 'ARCHIVED',
      createdAt: '2026-10-05T00:00:00.000Z',
    })),
  }
}

function point(
  id: string,
  createdAt: string,
  score: -1 | 0 | 1,
  mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
  correctionId: string | null = null,
): CorrectedMoodPoint {
  return {
    id, conversationId: 'conv_1', characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1',
    mood, score, keywords: [], createdAt,
    tags: [], reason: '', originalMood: null, originalScore: null,
    correctionId, correctedAt: correctionId ? createdAt : null,
  }
}

function timeline(points: CorrectedMoodPoint[], degraded = false): MoodTimelineContract {
  return { conversationId: 'scope_1', available: !degraded, degraded, points }
}

function reportFor(points: CorrectedMoodPoint[], periodId: string, activeIds = ['mem_1']) {
  return readableMoodPeriodReport('scope_1', memoryWith(activeIds), timeline(points), NOW, periodId)
}

// builder 需显式接收 memory（活跃记忆过滤口径）与路由已知 periodId（降级回显）；mem_2 恒为 ARCHIVED
const MEMORY = memoryWith(['mem_1'])
function insightOf(report: MoodPeriodReport, tl: MoodTimelineContract, periodId = report.period?.id ?? '2026-10-05') {
  return buildMoodPeriodInsight(report, tl, MEMORY, periodId)
}

describe('v0.10 period insight · 正常层', () => {
  it('golden：三类洞察全结构值级断言', () => {
    const report = reportFor([
      point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE', 'cor_1'),
      point('c2', '2026-10-05T06:00:00.000Z', -1, 'NEGATIVE'),
      point('c3', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
    ], '2026-10-05')
    const view = insightOf(report, timeline([
      point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE', 'cor_1'),
      point('c2', '2026-10-05T06:00:00.000Z', -1, 'NEGATIVE'),
      point('c3', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
    ]))

    expect(view.available).toBe(true)
    expect(view.degraded).toBe(false)
    expect(view.periodId).toBe('2026-10-05')
    expect(view.insights).toEqual([
      {
        type: 'DOMINANT_MOOD',
        value: { mood: 'NEGATIVE', count: 2, share: 0.6667 },
        evidence: {
          periodId: '2026-10-05', from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z',
          sampleSize: 3, source: 'moodPeriodReport.summary.counts',
        },
        message: '本周期以低落为主：2/3 条记录为低落。',
      },
      {
        type: 'PERIOD_TREND',
        value: { trend: 'IMPROVING', sampleSize: 3, averageScore: -0.3333, coverageDays: 2 },
        evidence: {
          periodId: '2026-10-05', from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z',
          sampleSize: 3, source: 'moodPeriodReport.summary.trend',
        },
        message: '样本 3 条、覆盖 2/7 天，平均 -0.33，趋势好转。',
      },
      {
        type: 'ANNOTATION_CORRELATION',
        value: { correctedSamples: 1, sampleSize: 3 },
        evidence: {
          periodId: '2026-10-05', from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z',
          sampleSize: 3, source: 'moodTimeline.points[correctionId]',
        },
        message: '本周期 1/3 条记录应用了你的修正标注。',
      },
    ])
  })

  it('结论值 = 规则重算值（值级一致，非元素存在）', () => {
    const points = [
      point('c1', '2026-10-07T00:00:00.000Z', 1, 'POSITIVE'),
      point('c2', '2026-10-08T00:00:00.000Z', 1, 'POSITIVE', 'cor_2'),
      point('c3', '2026-10-08T12:00:00.000Z', 0, 'NEUTRAL'),
      point('c4', '2026-10-09T00:00:00.000Z', -1, 'NEGATIVE', 'cor_3'),
    ]
    const report = reportFor(points, '2026-10-05')
    const view = insightOf(report, timeline(points))
    const byType = new Map(view.insights.map((item) => [item.type, item.value]))

    // 独立按规则重算（不复用被测实现内部路径的产出）
    const counts = report.summary!.counts
    const dominant =
      counts.negative >= counts.positive && counts.negative >= counts.neutral ? 'NEGATIVE'
        : counts.neutral >= counts.positive ? 'NEUTRAL' : 'POSITIVE'
    const dominantCount = dominant === 'POSITIVE' ? counts.positive : dominant === 'NEUTRAL' ? counts.neutral : counts.negative
    expect(byType.get('DOMINANT_MOOD')).toEqual({
      mood: dominant, count: dominantCount, share: Math.round((dominantCount / 4) * 10_000) / 10_000,
    })
    expect(byType.get('PERIOD_TREND')).toEqual({
      trend: report.summary!.trend,
      sampleSize: report.summary!.sampleSize,
      averageScore: Math.round(moodPeriodAverageScore(report)! * 10_000) / 10_000,
      coverageDays: report.coverageDays,
    })
    expect(byType.get('ANNOTATION_CORRELATION')).toEqual({ correctedSamples: 2, sampleSize: 4 })
  })

  it('同输入多次调用输出稳定', () => {
    const points = [
      point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE', 'cor_1'),
      point('c2', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
    ]
    const report = reportFor(points, '2026-10-05')
    const tl = timeline(points)
    expect(insightOf(report, tl)).toEqual(insightOf(report, tl))
  })
})

describe('v0.10 period insight · 空态层', () => {
  it('空库/空周期返回 200 合法空结构（insights=[]，非 404/500）', () => {
    const report = reportFor([], '2026-10-05')
    const view = insightOf(report, timeline([]))
    expect(view).toEqual({
      conversationId: 'scope_1', available: true, degraded: false,
      periodId: '2026-10-05', insights: [],
    })
  })

  it('有样本但零修正标注时只产出 2 类（不产出空标注洞察）', () => {
    const points = [
      point('c1', '2026-10-05T00:00:00.000Z', 0, 'NEUTRAL'),
      point('c2', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE'),
    ]
    const view = insightOf(reportFor(points, '2026-10-05'), timeline(points))
    expect(view.insights.map((item) => item.type)).toEqual(['DOMINANT_MOOD', 'PERIOD_TREND'])
  })
})

describe('v0.10 period insight · 降级层', () => {
  it('聚合输入降级时输出完整 degraded 结构', () => {
    const degradedTl = timeline([point('c1', '2026-10-05T00:00:00.000Z', 1, 'POSITIVE')], true)
    const report = readableMoodPeriodReport('scope_1', MEMORY, degradedTl, NOW, '2026-10-05')
    const view = insightOf(report, degradedTl)
    expect(view).toEqual({
      conversationId: 'scope_1', available: false, degraded: true,
      periodId: '2026-10-05', insights: [],
    })
  })

  it('degraded 工厂与 builder 降级输出一致', () => {
    expect(moodPeriodInsightDegraded('scope_1', '2026-10-05')).toEqual({
      conversationId: 'scope_1', available: false, degraded: true,
      periodId: '2026-10-05', insights: [],
    })
  })
})

describe('v0.10 period insight · 规则细节', () => {
  it('平票按 NEGATIVE > NEUTRAL > POSITIVE 固定优先级', () => {
    const points = [
      point('c1', '2026-10-05T00:00:00.000Z', 1, 'POSITIVE'),
      point('c2', '2026-10-06T00:00:00.000Z', -1, 'NEGATIVE'),
    ]
    const view = insightOf(reportFor(points, '2026-10-05'), timeline(points))
    const dominant = view.insights.find((item) => item.type === 'DOMINANT_MOOD')
    expect(dominant?.value).toEqual({ mood: 'NEGATIVE', count: 1, share: 0.5 })

    const neutralTie = [
      point('c1', '2026-10-05T00:00:00.000Z', 1, 'POSITIVE'),
      point('c2', '2026-10-06T00:00:00.000Z', 0, 'NEUTRAL'),
    ]
    const view2 = insightOf(reportFor(neutralTie, '2026-10-05'), timeline(neutralTie))
    expect(view2.insights.find((item) => item.type === 'DOMINANT_MOOD')?.value)
      .toEqual({ mood: 'NEUTRAL', count: 1, share: 0.5 })
  })

  it('类型枚举闭合：集合长度 3，所有产出 type 均在集合内', () => {
    expect(PERIOD_INSIGHT_TYPES).toEqual(['DOMINANT_MOOD', 'PERIOD_TREND', 'ANNOTATION_CORRELATION'])
    const batteries: Array<CorrectedMoodPoint[]> = [
      [],
      [point('c1', '2026-10-05T00:00:00.000Z', 1, 'POSITIVE')],
      [point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE', 'cor_1'), point('c2', '2026-10-06T00:00:00.000Z', 0, 'NEUTRAL', 'cor_2')],
    ]
    for (const points of batteries) {
      const view = insightOf(reportFor(points, '2026-10-05'), timeline(points))
      for (const item of view.insights) {
        expect(PERIOD_INSIGHT_TYPES).toContain(item.type)
      }
    }
  })

  it('UTC+8 周界：周日 23:59（CST）属上周，周一 00:00（CST）属本周', () => {
    // 2026-10-11T15:59:59.000Z = 东八区 2026-10-11（周日）23:59:59 → 属周期 2026-10-05
    const sunday = [point('c1', '2026-10-11T15:59:59.000Z', -1, 'NEGATIVE')]
    const sundayView = insightOf(reportFor(sunday, '2026-10-05'), timeline(sunday))
    expect(sundayView.insights).toHaveLength(2)
    expect(sundayView.insights[0]?.evidence.sampleSize).toBe(1)

    // 同一点位对下周周期 2026-10-12 为窗口外 → 空态
    const nextWeekView = insightOf(reportFor(sunday, '2026-10-12'), timeline(sunday))
    expect(nextWeekView.insights).toEqual([])

    // 2026-10-11T16:00:00.000Z = 东八区 2026-10-12（周一）00:00:00 → 属周期 2026-10-12
    const monday = [point('c2', '2026-10-11T16:00:00.000Z', 1, 'POSITIVE')]
    const mondayPrevView = insightOf(reportFor(monday, '2026-10-05'), timeline(monday))
    expect(mondayPrevView.insights).toEqual([])
    const mondayView = insightOf(reportFor(monday, '2026-10-12'), timeline(monday))
    expect(mondayView.insights).toHaveLength(2)
  })

  it('脏数据防御：修正标注仅在有效窗口内计数，correctedSamples ≤ sampleSize', () => {
    const inWindow = point('c1', '2026-10-05T00:00:00.000Z', -1, 'NEGATIVE', 'cor_1')
    const outsideWindow = point('c9', '2026-09-29T00:00:00.000Z', 1, 'POSITIVE', 'cor_9')
    const archivedMemory = { ...point('c8', '2026-10-06T00:00:00.000Z', 1, 'POSITIVE', 'cor_8'), memoryId: 'mem_2' }
    const badScore = { ...point('c7', '2026-10-07T00:00:00.000Z', 5 as 1, 'POSITIVE', 'cor_7'), score: 5 as -1 | 0 | 1 }
    const report = reportFor([inWindow], '2026-10-05')
    const view = insightOf(report, timeline([inWindow, outsideWindow, archivedMemory, badScore]))
    expect(view.insights.find((item) => item.type === 'ANNOTATION_CORRELATION')?.value)
      .toEqual({ correctedSamples: 1, sampleSize: 1 })
  })
})
