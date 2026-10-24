/**
 * event-engine —— 互动事件引擎（spec entity id: sys-event-engine）。
 * 契约（acc-event-branch / acc-resource-guard）：
 *   每章 2~3 个事件（含隐藏事件「巨星的深夜」）；每事件 2~3 个互斥选项；
 *   选择后立即按效果表改值并锁定（irreversible），不可回退重选；
 *   同一事件永不重复触发（fired 集合）；
 *   核心六维单条作者 |delta| ≤ choiceEffectClamp(30) 由 validateEventLibrary 校验。
 */
import { EVENT_RULES } from '../numeric.mjs';
import { normalizeIdol } from '../entities/idol.mjs';
import { ALL_EVENTS } from '../data/events.mjs';

/** 本周应触发的事件（落位事件按周；条件事件按 when 谓词），只返回未触发过的 */
export function dueEvents(state) {
  const due = [];
  for (const ev of ALL_EVENTS) {
    if (state.firedEvents.has(ev.id)) continue;
    if (typeof ev.week === 'number') {
      if (ev.week === state.week) due.push(ev);
    } else if (ev.when && ev.when(state)) {
      due.push(ev);
    }
  }
  return due;
}

/**
 * 应用一个选项。同一事件只允许生效一次（幂等防护：连点/重放都返回 no-op）。
 * 返回 { ok, effects?, reason? }。
 */
export function chooseEventOption(state, eventId, choiceId) {
  const ev = ALL_EVENTS.find((e) => e.id === eventId);
  if (!ev) return { ok: false, reason: 'unknown-event' };
  if (state.firedEvents.has(eventId)) return { ok: false, reason: 'already-resolved' };
  const choice = ev.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: 'unknown-choice' };

  state.firedEvents.add(eventId);
  const effects = applyEffects(state, choice.effects);
  if (choice.flag) state.flags[choice.flag] = true;
  if (choice.resolve) choice.resolve(state);
  normalizeIdol(state.idol);
  return { ok: true, effects };
}

const NUMERIC_KEYS = ['vocal', 'dance', 'stamina', 'mood', 'stress', 'fans'];

/**
 * 效果表应用：逐字按事件效果表修改数值（acc-event-branch「按事件效果表修改数值」为强契约，
 * fans 类大额变动是 spec 作者表原值，如直播救场 fans:+80），写入后统一 normalize 收敛定义域。
 * EVENT_RULES.choiceEffectClamp(30) 作为【库校验规则】约束核心六维的作者上限，
 * 由 validateEventLibrary / 契约测试断言（fans 为成长货币，作者上限 80）。
 */
export function applyEffects(state, effects = {}) {
  const applied = {};
  for (const [key, rawDelta] of Object.entries(effects)) {
    const delta = Math.round(rawDelta);
    if (NUMERIC_KEYS.includes(key)) {
      state.idol[key] += delta;
    } else {
      state.idol[key] = (state.idol[key] || 0) + delta;
    }
    applied[key] = delta;
  }
  normalizeIdol(state.idol);
  return applied;
}

/** 事件库作者规则校验：每事件 2~3 选项；核心六维单条 |delta| ≤ 30；fans 单条 |delta| ≤ 80 */
export function validateEventLibrary(events = ALL_EVENTS) {
  const problems = [];
  for (const ev of events) {
    if (ev.choices.length < EVENT_RULES.choicesPerEvent[0] || ev.choices.length > EVENT_RULES.choicesPerEvent[1]) {
      problems.push(`${ev.id}: choices ${ev.choices.length} out of range`);
    }
    for (const c of ev.choices) {
      for (const [k, v] of Object.entries(c.effects || {})) {
        if (k === 'fans') {
          if (Math.abs(v) > 80) problems.push(`${ev.id}/${c.id}: fans delta ${v} > 80`);
        } else if (Math.abs(v) > EVENT_RULES.choiceEffectClamp) {
          problems.push(`${ev.id}/${c.id}: ${k} delta ${v} > ${EVENT_RULES.choiceEffectClamp}`);
        }
      }
    }
  }
  return { ok: problems.length === 0, problems };
}
