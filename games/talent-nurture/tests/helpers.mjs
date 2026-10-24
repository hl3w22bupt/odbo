/** helpers —— 契约测试公共件：无头状态构造 + 断言原语（零依赖）。 */
import { newGame } from '../src/main.mjs';
import { beginWeek } from '../src/systems/scheduler.mjs';

export function newTestState(seed = 42) {
  const state = newGame(seed);
  state.phase = 'week';
  return state;
}

/** 进入第 n 周（含周计划），并跳过事件队列 */
export function gotoWeek(state, week, plan = {}) {
  state.week = week - 1;
  beginWeek(state, plan);
  state.pendingEvents = [];
  state.phase = 'week';
  return state;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

export function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`assertEq failed: ${msg} (actual=${actual}, expected=${expected})`);
}

export function assertInRange(v, lo, hi, msg) {
  if (v < lo || v > hi) throw new Error(`assertInRange failed: ${msg} (value=${v}, range=[${lo},${hi}])`);
}
