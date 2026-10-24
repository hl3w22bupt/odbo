/**
 * stat-growth —— 唱舞数值成长系统（spec entity id: sys-stat-growth）。
 * 契约（acc-vocal-growth / acc-dance-growth / acc-resource-guard）：
 *   增益 = randint(gainBase-gainVariance, gainBase+gainVariance)（即 3~9）；
 *   技能 ≥ softCapStart(60) 后增益 ×softCapFactor(0.5) 向下取整；
 *   mood=0 时全部训练增益 ×zeroMoodTrainingFactor(0.5)；
 *   同时 stamina -18、stress +8；结果统一 normalizeIdol 收敛定义域。
 */
import { TRAINING, GUARD, RECOVERY, SOCIAL, REHEARSAL } from '../numeric.mjs';
import { normalizeIdol } from '../entities/idol.mjs';
import { gainRoll } from './rng.mjs';

function skillGain(rng, skill) {
  let gain = gainRoll(rng, TRAINING.gainBase, TRAINING.gainVariance);
  if (skill >= TRAINING.softCapStart) {
    gain = Math.floor(gain * TRAINING.softCapFactor);
  }
  if (gain < 0) gain = 0;
  return gain;
}

/** 唱功特训：返回本条行动的日志记录 */
export function trainVocal(state) {
  const idol = state.idol;
  let gain = skillGain(state.rng, idol.vocal);
  if (idol.mood === 0) gain = Math.floor(gain * GUARD.zeroMoodTrainingFactor);
  idol.vocal += gain;
  idol.stamina -= TRAINING.staminaCost;
  idol.stress += TRAINING.stressGain;
  idol.mentorVocalAffinity += TRAINING.mentorAffinityGain;
  normalizeIdol(idol);
  return { action: 'train-vocal', delta: { vocal: gain, stamina: -TRAINING.staminaCost, stress: TRAINING.stressGain } };
}

/** 舞蹈特训：与唱功完全同一公式与消耗 */
export function trainDance(state) {
  const idol = state.idol;
  let gain = skillGain(state.rng, idol.dance);
  if (idol.mood === 0) gain = Math.floor(gain * GUARD.zeroMoodTrainingFactor);
  idol.dance += gain;
  idol.stamina -= TRAINING.staminaCost;
  idol.stress += TRAINING.stressGain;
  idol.mentorDanceAffinity += TRAINING.mentorAffinityGain;
  normalizeIdol(idol);
  return { action: 'train-dance', delta: { dance: gain, stamina: -TRAINING.staminaCost, stress: TRAINING.stressGain } };
}

/** 休息：stamina +45、stress -25、mood +6 */
export function rest(state) {
  const idol = state.idol;
  idol.stamina += RECOVERY.restStamina;
  idol.stress -= RECOVERY.restStress;
  idol.mood += RECOVERY.restMood;
  normalizeIdol(idol);
  return { action: 'rest', delta: { stamina: RECOVERY.restStamina, stress: -RECOVERY.restStress, mood: RECOVERY.restMood } };
}

/** 社交：fans +15、mood +8、stamina -10 */
export function social(state) {
  const idol = state.idol;
  idol.fans += SOCIAL.fansGain;
  idol.mood += SOCIAL.moodGain;
  idol.stamina -= SOCIAL.staminaCost;
  normalizeIdol(idol);
  return { action: 'social', delta: { fans: SOCIAL.fansGain, mood: SOCIAL.moodGain, stamina: -SOCIAL.staminaCost } };
}

/** 彩排：半价训练（weightScale 0.5）作用于主方向，并给出舞台得分预览 */
export function rehearsal(state, focus) {
  const idol = state.idol;
  const key = focus === 'dance' ? 'dance' : 'vocal';
  const full = gainRoll(state.rng, TRAINING.gainBase, TRAINING.gainVariance);
  let gain = Math.floor(full * REHEARSAL.weightScale);
  if (idol[key] >= TRAINING.softCapStart) gain = Math.floor(gain * TRAINING.softCapFactor);
  if (gain < 0) gain = 0;
  idol[key] += gain;
  idol.stamina -= REHEARSAL.staminaCost;
  normalizeIdol(idol);
  return { action: 'rehearsal', delta: { [key]: gain, stamina: -REHEARSAL.staminaCost }, preview: true };
}

export const ACTIONS = {
  'train-vocal': { label: '唱功特训', emoji: '🎤', run: trainVocal },
  'train-dance': { label: '舞蹈特训', emoji: '🕺', run: trainDance },
  'rest': { label: '休息', emoji: '😴', run: rest },
  'social': { label: '社交', emoji: '💬', run: social },
  'rehearsal': { label: '彩排', emoji: '🎭', run: rehearsal },
};
