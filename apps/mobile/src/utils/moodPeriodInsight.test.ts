import { describe, expect, it } from 'vitest';
import { currentPeriodId, periodInsightViewState } from './moodPeriodInsight';
import type { PeriodInsightItem, PeriodInsightResult } from '../types';

const evidence = {
  periodId: '2026-10-05',
  from: '2026-10-04T16:00:00.000Z',
  to: '2026-10-11T16:00:00.000Z',
  sampleSize: 3,
  source: 'moodPeriodReport.summary.counts',
};

const dominant: PeriodInsightItem = {
  type: 'DOMINANT_MOOD',
  value: { mood: 'NEGATIVE', count: 2, share: 0.6667 },
  evidence,
  message: '本周期以低落为主：2/3 条记录为低落。',
};

const trend: PeriodInsightItem = {
  type: 'PERIOD_TREND',
  value: { trend: 'IMPROVING', sampleSize: 3, averageScore: -0.3333, coverageDays: 2 },
  evidence: { ...evidence, source: 'moodPeriodReport.summary.trend' },
  message: '样本 3 条、覆盖 2/7 天，平均 -0.33，趋势好转。',
};

const annotation: PeriodInsightItem = {
  type: 'ANNOTATION_CORRELATION',
  value: { correctedSamples: 1, sampleSize: 3 },
  evidence: { ...evidence, source: 'moodTimeline.points[correctionId]' },
  message: '本周期 1/3 条记录应用了你的修正标注。',
};

function result(overrides: Partial<PeriodInsightResult> = {}, insights: PeriodInsightItem[] = [dominant, trend]): PeriodInsightResult {
  return {
    conversationId: 'user_1',
    available: true,
    degraded: false,
    periodId: '2026-10-05',
    insights,
    ...overrides,
  };
}

describe('periodInsightViewState 三层', () => {
  it('正常层：合法载荷 → ready 且原样携带', () => {
    const view = periodInsightViewState(result());
    expect(view.mode).toBe('ready');
    expect(view.mode === 'ready' && view.value.insights).toHaveLength(2);
  });

  it('空态层：available=true + insights=[] 仍是合法 ready（面板自渲染空文案）', () => {
    const view = periodInsightViewState(result({}, []));
    expect(view.mode).toBe('ready');
    expect(view.mode === 'ready' && view.value.insights).toEqual([]);
  });

  it('降级层：degraded / available=false / 未取到 → degraded', () => {
    expect(periodInsightViewState(result({ degraded: true })).mode).toBe('degraded');
    expect(periodInsightViewState(result({ available: false })).mode).toBe('degraded');
    expect(periodInsightViewState(null).mode).toBe('degraded');
    expect(periodInsightViewState(undefined).mode).toBe('degraded');
  });

  it('第 4 类判红：未知洞察类型使整个载荷不可信 → empty', () => {
    const forged = { ...annotation, type: 'FUTURE_MOOD_TYPE' } as unknown as PeriodInsightItem;
    const view = periodInsightViewState(result({}, [dominant, forged]));
    expect(view.mode).toBe('empty');
  });

  it('schema 违例判红：主导情绪越界枚举 / share 越界 / periodId 非法 / evidence 缺失', () => {
    const badMood = { ...dominant, value: { mood: 'ANGRY', count: 1, share: 1 } } as unknown as PeriodInsightItem;
    expect(periodInsightViewState(result({}, [badMood])).mode).toBe('empty');

    const badShare = { ...dominant, value: { mood: 'NEGATIVE' as const, count: 2, share: 1.5 } };
    expect(periodInsightViewState(result({}, [badShare])).mode).toBe('empty');

    expect(periodInsightViewState(result({ periodId: '20261005' })).mode).toBe('empty');

    const noEvidence = { ...dominant, evidence: { ...evidence, source: '' } };
    expect(periodInsightViewState(result({}, [noEvidence])).mode).toBe('empty');
  });

  it('类型枚举闭合：三值全部可过校验', () => {
    const view = periodInsightViewState(result({}, [dominant, trend, annotation]));
    expect(view.mode).toBe('ready');
  });
});

describe('currentPeriodId（UTC+8 自然周周一，时钟注入）', () => {
  it('周日 23:59:59（CST）属上周周期', () => {
    expect(currentPeriodId(new Date('2026-10-11T15:59:59.000Z'))).toBe('2026-10-05');
  });

  it('周一 00:00:00（CST）属本周周期', () => {
    expect(currentPeriodId(new Date('2026-10-11T16:00:00.000Z'))).toBe('2026-10-12');
  });

  it('周中任意时刻归当前自然周', () => {
    expect(currentPeriodId(new Date('2026-10-13T01:00:00.000Z'))).toBe('2026-10-12');
    expect(currentPeriodId(new Date('2026-10-05T00:00:00.000Z'))).toBe('2026-10-05');
  });

  it('同一时刻多次调用输出稳定', () => {
    const now = new Date('2026-10-11T15:59:59.000Z');
    expect(currentPeriodId(now)).toBe(currentPeriodId(now));
  });
});
