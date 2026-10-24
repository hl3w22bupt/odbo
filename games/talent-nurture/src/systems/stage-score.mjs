/**
 * stage-score —— 舞台评分系统（spec entity id: sys-stage-scoring）。
 * 契约（acc-stage-scoring / acc-fans-growth / acc-resource-guard）：
 *   得分 = round(clamp(vocal)*0.5 + clamp(dance)*0.35 + clamp(mood)*0.15 + 舞台增益)
 *   <55 失败 / 55~69 及格 / 70~84 良好 / ≥85 完美
 *   登台前置 stamina ≥25（不足 = 弃权，不扣任何资源）；
 *   登台后 stamina -25、stress +12；
 *   fans：得分 ≥55 时 += round((得分-55)×15×(1±0.20))，clamp [0,9999]；<55 不变；答谢祭 ×1.5。
 */
import { STAGE, GUARD } from '../numeric.mjs';
import { clampStat, normalizeIdol } from '../entities/idol.mjs';

/** 得分公式（含一次性增益 buff，调用方负责传入并清零） */
export function calcScore(idol, scoreBuff = 0) {
  const sum =
    clampStat(idol.vocal, 0, 100) * STAGE.vocalWeight +
    clampStat(idol.dance, 0, 100) * STAGE.danceWeight +
    clampStat(idol.mood, 0, 100) * STAGE.moodWeight +
    scoreBuff;
  return Math.round(sum);
}

export function scoreTier(score, passThreshold = STAGE.passThreshold) {
  if (score < passThreshold) return 'fail';
  if (score < STAGE.goodThreshold) return 'pass';
  if (score < STAGE.perfectThreshold) return 'good';
  return 'perfect';
}

/** 预览（彩排用）：只算分不消耗 */
export function previewScore(state) {
  return calcScore(state.idol, state.idol.nextStageScoreBuff);
}

/**
 * 执行一场舞台。
 * stage: { id, label, passThreshold?, fansGainMultiplier?, rivalStage? }
 * 返回 { missed?, score, tier, fansGain, rivalScore?, win? }
 */
export function performStage(state, stage) {
  const idol = state.idol;
  if (idol.stamina < GUARD.stageMinStamina) {
    return { missed: true, reason: 'stamina' };
  }
  const buff = idol.nextStageScoreBuff;
  idol.nextStageScoreBuff = 0; // 一次性增益：用后即清
  const score = calcScore(idol, buff);
  idol.stamina -= STAGE.staminaCost;
  idol.stress += STAGE.stressGain;

  const passThreshold = stage.passThreshold ?? STAGE.passThreshold;
  const tier = scoreTier(score, passThreshold);

  let fansGain = 0;
  if (score >= STAGE.passThreshold) {
    const variance = 1 + (state.rng() * 2 - 1) * STAGE.fansGainVariance;
    fansGain = Math.round((score - STAGE.passThreshold) * STAGE.fansGainPerPoint * variance);
    if (fansGain < 0) fansGain = 0;
    if (stage.fansGainMultiplier) fansGain = Math.round(fansGain * stage.fansGainMultiplier);
    idol.fans += fansGain;
  }
  normalizeIdol(idol);

  let rivalScore = null;
  let win = null;
  if (stage.rivalStage) {
    rivalScore = stage.rivalScore;
    win = score > rivalScore;
    if (win) {
      state.flags.rivalWins += 1;
    } else {
      state.flags.rivalWins = 0; // 「连续」赢下全部 3 次：中断即清零
    }
  }
  return { score, tier, fansGain, passThreshold, rivalScore, win };
}
