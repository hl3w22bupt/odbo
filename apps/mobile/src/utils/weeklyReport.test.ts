import { describe, expect, it } from 'vitest';
import { moodWeeklyReportViewState, weeklyTrendLabel } from './weeklyReport';
import type { MoodWeeklyReportResult } from '../types';

const report = {
  sampleSize: 2,
  counts: { positive: 1, neutral: 0, negative: 1 },
  trend: 'WORSENING' as const,
  headline: '近7日情绪转弱，值得关注',
  reason: '近7日样本2条，前半段均分 1，后半段均分 -1，情绪转弱。',
  keywords: ['低落'],
  window: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z' },
};
const view: MoodWeeklyReportResult = {
  conversationId: 'conv_1',
  available: true,
  degraded: false,
  report,
};

describe('moodWeeklyReportViewState', () => {
  it('maps ready empty and degraded weekly report states', () => {
    expect(moodWeeklyReportViewState(view)).toEqual({ mode: 'ready', report });
    expect(moodWeeklyReportViewState({ ...view, report: null })).toEqual({ mode: 'empty', report: null });
    expect(moodWeeklyReportViewState({ ...view, available: false, degraded: true })).toEqual({
      mode: 'degraded',
      report: null,
    });
  });

  it('maps the frozen trend direction labels', () => {
    const state = moodWeeklyReportViewState(view);
    expect(state.mode).toBe('ready');
    if (state.mode === 'ready') {
      expect(weeklyTrendLabel(state.report.trend)).toBe('需要关注');
    }
  });
});
