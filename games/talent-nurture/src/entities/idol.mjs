/**
 * idol —— 主角练习生「小星」实体（spec entity id: idol-player）。
 * 职责：状态创建 / 完全重置（无残留）/ 统一 clamp / 技能评级。
 */
import { PLAYER_INIT, SKILL_RANK } from '../numeric.mjs';

export function clampStat(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** 新建一局玩家状态（每次开局/重开都从这里创建全新对象，保证无残留） */
export function createIdol() {
  return {
    name: '小星',
    vocal: PLAYER_INIT.vocal,
    dance: PLAYER_INIT.dance,
    stamina: PLAYER_INIT.stamina,
    mood: PLAYER_INIT.mood,
    stress: PLAYER_INIT.stress,
    fans: PLAYER_INIT.fans,
    mentorVocalAffinity: 0,
    mentorDanceAffinity: 0,
    nextStageScoreBuff: 0,
  };
}

/** 全量 clamp 到定义域（任何写入路径收敛到这一个函数，杜绝越界/负数） */
export function normalizeIdol(idol) {
  idol.vocal = clampStat(idol.vocal, 0, 100);
  idol.dance = clampStat(idol.dance, 0, 100);
  idol.stamina = clampStat(idol.stamina, 0, PLAYER_INIT.staminaMax);
  idol.mood = clampStat(idol.mood, PLAYER_INIT.moodMin, PLAYER_INIT.moodMax);
  idol.stress = clampStat(idol.stress, 0, PLAYER_INIT.stressMax);
  idol.fans = clampStat(idol.fans, 0, PLAYER_INIT.fansMax);
  idol.mentorVocalAffinity = clampStat(idol.mentorVocalAffinity, 0, 100);
  idol.mentorDanceAffinity = clampStat(idol.mentorDanceAffinity, 0, 100);
  return idol;
}

export function skillRank(value) {
  let rank = SKILL_RANK[0].rank;
  for (const r of SKILL_RANK) {
    if (value >= r.min) rank = r.rank;
  }
  return rank;
}

export function idolSnapshot(idol) {
  return {
    vocal: idol.vocal,
    dance: idol.dance,
    stamina: idol.stamina,
    mood: idol.mood,
    stress: idol.stress,
    fans: idol.fans,
  };
}
