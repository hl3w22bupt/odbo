import type { MemoryReadResult, MoodInsightSummaryResult, MoodTimelineResult } from '../types';

export type MemoryViewState =
  | { mode: 'empty'; items: [] }
  | { mode: 'degraded'; items: [] }
  | { mode: 'ready'; items: NonNullable<MemoryReadResult['items']>[number][] };

export function memoryViewState(view: MemoryReadResult | null | undefined): MemoryViewState {
  if (!view || view.degraded || !view.available) return { mode: 'degraded', items: [] };
  const items = (view.items ?? []).filter(
    (item) => item.status === 'ACTIVE' && item.content.trim().length > 0,
  );
  return items.length > 0 ? { mode: 'ready', items } : { mode: 'empty', items: [] };
}

export type MoodViewState =
  | { mode: 'empty'; points: [] }
  | { mode: 'degraded'; points: [] }
  | { mode: 'ready'; points: NonNullable<MoodTimelineResult['points']>[number][] };

export function moodViewState(view: MoodTimelineResult | null | undefined): MoodViewState {
  if (!view || view.degraded || !view.available) return { mode: 'degraded', points: [] };
  const points = (view.points ?? []).filter((point) => point.id && point.createdAt);
  return points.length > 0 ? { mode: 'ready', points } : { mode: 'empty', points: [] };
}

export type MoodInsightViewState =
  | { mode: 'empty'; summary: null }
  | { mode: 'degraded'; summary: null }
  | { mode: 'ready'; summary: NonNullable<MoodInsightSummaryResult['summary']> };

export function moodInsightViewState(
  view: MoodInsightSummaryResult | null | undefined,
): MoodInsightViewState {
  if (!view || view.degraded || !view.available) return { mode: 'degraded', summary: null };
  const summary = view.summary;
  return summary && summary.sampleSize > 0 && summary.headline && summary.reason
    ? { mode: 'ready', summary }
    : { mode: 'empty', summary: null };
}
