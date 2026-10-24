/**
 * scheduler —— 周计划行动系统（spec entity id: sys-week-scheduler）。
 * 契约（acc-week-loop / acc-resource-guard）：
 *   每周 5 行动槽；结束本周结算 weeklyMoodDecay -4 / weeklyStressDecay -3（clamp [0,100]）；
 *   stress ≥ forcedRestStress(70) 时强制休息并跳过本周剩余行动（每周至多触发一次）；
 *   第 12 周结算后强制进入结局判定并禁止任何行动。
 */
import { CYCLE, RECOVERY, GUARD } from '../numeric.mjs';
import { normalizeIdol } from '../entities/idol.mjs';
import { ACTIONS } from './stat-growth.mjs';

export function isCampaignOver(state) {
  return state.phase === 'ended' || state.week >= CYCLE.weeksTotal && state.weekSettled;
}

/** 进入新的一周：重置行动槽，返回本周计划（事件/舞台由 level 配置提供） */
export function beginWeek(state, weekPlan) {
  state.week += 1;
  state.actionsLeft = CYCLE.actionsPerWeek;
  state.forcedRestDone = false;
  state.weekSettled = false;
  state.weekPlan = weekPlan;
  return state.weekPlan;
}

/**
 * 执行一次行动。返回 { ok, log, forcedRest?, reason? }。
 * 禁止在行动槽耗尽 / 周已结算 / 战役结束后执行。
 */
export function doAction(state, actionId, focus) {
  const def = ACTIONS[actionId];
  if (!def) return { ok: false, reason: 'unknown-action' };
  if (state.phase !== 'week') return { ok: false, reason: 'not-in-week' };
  if (state.actionsLeft <= 0) return { ok: false, reason: 'no-actions' };

  const log = def.run(state, focus);
  state.actionsLeft -= 1;
  state.weekLog.push(log);

  let forcedRest = null;
  if (state.idol.stress >= GUARD.forcedRestStress && !state.forcedRestDone) {
    state.forcedRestDone = true;
    forcedRest = ACTIONS.rest.run(state);
    state.weekLog.push({ action: 'forced-rest', delta: forcedRest.delta });
    state.actionsLeft = 0; // 跳过本周剩余行动
  }
  normalizeIdol(state.idol);
  return { ok: true, log, forcedRest };
}

/** 结束本周：周期衰减结算；第 12 周结算后战役结束（进入结局判定） */
export function settleWeek(state) {
  if (state.weekSettled) return { ok: false, reason: 'already-settled' };
  state.idol.mood -= RECOVERY.weeklyMoodDecay;
  state.idol.stress -= RECOVERY.weeklyStressDecay;
  normalizeIdol(state.idol);
  state.weekSettled = true;
  if (state.week >= CYCLE.weeksTotal) {
    state.phase = 'judgement';
  }
  return { ok: true };
}
