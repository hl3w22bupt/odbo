/**
 * numeric —— 数值唯一来源（与 .myrd/spec/design-spec.json 的 numeric 段一一对应）。
 * 运行时数值只从这里读；改数值 = 改 spec numeric 段 → 同步本文件（同一提交）。
 */

export const CYCLE = {
  actionsPerWeek: 5,
  weeksTotal: 12,
};

export const PLAYER_INIT = {
  vocal: 10,
  dance: 10,
  stamina: 100,
  staminaMax: 100,
  mood: 70,
  moodMin: 0,
  moodMax: 100,
  stress: 0,
  stressMax: 100,
  fans: 0,
  fansMax: 9999,
};

export const TRAINING = {
  gainBase: 6,
  gainVariance: 3,
  softCapStart: 60,
  softCapFactor: 0.5,
  staminaCost: 18,
  stressGain: 8,
  mentorAffinityGain: 5,
};

export const RECOVERY = {
  restStamina: 45,
  restStress: 25,
  restMood: 6,
  weeklyMoodDecay: 4,
  weeklyStressDecay: 3,
};

export const SOCIAL = {
  fansGain: 15,
  moodGain: 8,
  staminaCost: 10,
};

export const REHEARSAL = {
  scorePreview: true,
  staminaCost: 10,
  weightScale: 0.5,
};

export const STAGE = {
  vocalWeight: 0.5,
  danceWeight: 0.35,
  moodWeight: 0.15,
  passThreshold: 55,
  goodThreshold: 70,
  perfectThreshold: 85,
  staminaCost: 25,
  stressGain: 12,
  fansGainPerPoint: 15,
  fansGainVariance: 0.2,
};

export const RIVAL = {
  scoreBattle1: 50,
  scoreBattle2: 62,
  scoreBattle3: 70,
  scoreFinale: 72,
};

export const GUARD = {
  forcedRestStress: 70,
  stageMinStamina: 25,
  statCap: 100,
  zeroMoodTrainingFactor: 0.5,
};

export const EVENT_RULES = {
  perChapterRange: [2, 3],
  choicesPerEvent: [2, 3],
  choiceSkillGain: 8,
  choiceEffectClamp: 30,
  irreversible: true,
};

export const ENDING_RULES = {
  debutPass: 55,
  dualElite: 80,
  specialist: 80,
  legendScore: 85,
  legendFans: 1800,
  judgeOrder: ['legend-dual', 'vocal-specialist', 'dance-specialist', 'normal-debut', 'fail-return'],
};

export const SKILL_RANK = [
  { min: 0, rank: 'D' },
  { min: 25, rank: 'C' },
  { min: 45, rank: 'B' },
  { min: 65, rank: 'A' },
  { min: 85, rank: 'S' },
];

/**
 * TUNING_META —— 调参桥契约（§3C）：壳页把 ?tuning=<JSON> 解析进 window.__GAME_TUNING__，
 * 本表声明允许覆盖的键与 min/max；applyTuning 只认声明键并按区间钳制。
 */
export const TUNING_META = {
  gainBase: { min: 1, max: 12, get: () => TRAINING.gainBase, set: (v) => { TRAINING.gainBase = v; } },
  gainVariance: { min: 0, max: 6, get: () => TRAINING.gainVariance, set: (v) => { TRAINING.gainVariance = v; } },
  softCapStart: { min: 30, max: 95, get: () => TRAINING.softCapStart, set: (v) => { TRAINING.softCapStart = v; } },
  restStamina: { min: 10, max: 60, get: () => RECOVERY.restStamina, set: (v) => { RECOVERY.restStamina = v; } },
  stageVocalWeight: { min: 0.1, max: 0.9, get: () => STAGE.vocalWeight, set: (v) => { STAGE.vocalWeight = v; } },
  stageDanceWeight: { min: 0.05, max: 0.9, get: () => STAGE.danceWeight, set: (v) => { STAGE.danceWeight = v; } },
  stageMoodWeight: { min: 0.05, max: 0.9, get: () => STAGE.moodWeight, set: (v) => { STAGE.moodWeight = v; } },
  passThreshold: { min: 30, max: 90, get: () => STAGE.passThreshold, set: (v) => { STAGE.passThreshold = v; } },
  forcedRestStress: { min: 40, max: 95, get: () => GUARD.forcedRestStress, set: (v) => { GUARD.forcedRestStress = v; } },
  fansGainPerPoint: { min: 5, max: 40, get: () => STAGE.fansGainPerPoint, set: (v) => { STAGE.fansGainPerPoint = v; } },
};
