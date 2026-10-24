/**
 * events —— 事件库聚合（spec entity id: data-event-library，≥18 事件 × 2~3 分支）。
 * 落位事件（events-placed）13 + 条件事件（events-conditional）5 = 18。
 */
import { PLACED_EVENTS } from './events-placed.mjs';
import { CONDITIONAL_EVENTS, HIDDEN_EVENT_ID } from './events-conditional.mjs';

export { HIDDEN_EVENT_ID };

export const ALL_EVENTS = [...PLACED_EVENTS, ...CONDITIONAL_EVENTS];

/** 每章落位事件数（不含条件事件；prologue 为教程章，finale 补写 1 个以满足 2~3 区间） */
export function placedCountByChapter() {
  const counts = {};
  for (const ev of PLACED_EVENTS) {
    counts[ev.chapter] = (counts[ev.chapter] || 0) + 1;
  }
  return counts;
}
