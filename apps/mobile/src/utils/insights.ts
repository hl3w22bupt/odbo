import type { MemoryReadResult } from '../types';

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
