/** acc-stage-scoring：得分 = vocal×0.5 + dance×0.35 + mood×0.15（clamp 后）；<55 失败 / 55~69 及格 / 70~84 良好 / ≥85 完美；登台前置 stamina≥25，登台后 stamina -25、stress +12 */
import { newTestState, gotoWeek, assert, assertEq } from '../helpers.mjs';
import { calcScore, scoreTier, performStage } from '../../src/systems/stage-score.mjs';

export const tests = [
  {
    name: '得分公式精确（含 buff，四舍五入）',
    fn: () => {
      const s = newTestState(1);
      s.idol.vocal = 60;
      s.idol.dance = 40;
      s.idol.mood = 80;
      assertEq(calcScore(s.idol, 0), 56, '60*.5+40*.35+80*.15=56');
      assertEq(calcScore(s.idol, 5), 61, 'with buff +5');
      s.idol.vocal = 100;
      s.idol.dance = 100;
      s.idol.mood = 100;
      assertEq(calcScore(s.idol, 0), 100, 'full stats');
      s.idol.vocal = 0;
      s.idol.dance = 0;
      s.idol.mood = 0;
      assertEq(calcScore(s.idol, 0), 0, 'zero stats (clamp inputs)');
    },
  },
  {
    name: '评级四档：<55 fail / 55~69 pass / 70~84 good / ≥85 perfect',
    fn: () => {
      assertEq(scoreTier(54), 'fail', '54');
      assertEq(scoreTier(55), 'pass', '55');
      assertEq(scoreTier(69), 'pass', '69');
      assertEq(scoreTier(70), 'good', '70');
      assertEq(scoreTier(84), 'good', '84');
      assertEq(scoreTier(85), 'perfect', '85');
    },
  },
  {
    name: '登台前置 stamina ≥25：不足时弃权且不扣任何资源',
    fn: () => {
      const s = newTestState(1);
      gotoWeek(s, 2);
      s.idol.stamina = 24;
      const before = { stamina: s.idol.stamina, stress: s.idol.stress, fans: s.idol.fans };
      const r = performStage(s, { id: 'x', label: 'X' });
      assertEq(r.missed, true, 'missed');
      assertEq(s.idol.stamina, before.stamina, 'stamina untouched');
      assertEq(s.idol.stress, before.stress, 'stress untouched');
      assertEq(s.idol.fans, before.fans, 'fans untouched');
    },
  },
  {
    name: '登台后 stamina -25、stress +12；一次性 buff 用后清零',
    fn: () => {
      const s = newTestState(1);
      gotoWeek(s, 2);
      s.idol.stamina = 50;
      s.idol.stress = 10;
      s.idol.nextStageScoreBuff = 5;
      performStage(s, { id: 'x', label: 'X' });
      assertEq(s.idol.stamina, 25, 'stamina -25');
      assertEq(s.idol.stress, 22, 'stress +12');
      assertEq(s.idol.nextStageScoreBuff, 0, 'buff consumed');
    },
  },
  {
    name: '得分 <55 粉丝不变（在舞台路径中验证）',
    fn: () => {
      const s = newTestState(1);
      gotoWeek(s, 2);
      s.idol.vocal = 0;
      s.idol.dance = 0;
      s.idol.mood = 0;
      s.idol.stamina = 100;
      const r = performStage(s, { id: 'x', label: 'X' });
      assert(r.score < 55, 'low score');
      assertEq(r.fansGain, 0, 'no fans on fail');
    },
  },
];
