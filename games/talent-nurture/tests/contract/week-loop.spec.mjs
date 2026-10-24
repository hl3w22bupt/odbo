/** acc-week-loop：每周 5 行动槽；结束本周结算 mood -4 / stress -3（clamp）；休息 +45/-25/+6；第 12 周结算后强制结局判定并禁止行动 */
import { newTestState, gotoWeek, assert, assertEq } from '../helpers.mjs';
import { doAction, settleWeek, beginWeek } from '../../src/systems/scheduler.mjs';
import { CYCLE } from '../../src/numeric.mjs';

export const tests = [
  {
    name: '每周 5 次行动机会，用完后行动被拒',
    fn: () => {
      const s = newTestState(3);
      beginWeek(s, {});
      for (let i = 0; i < 5; i++) {
        assertEq(doAction(s, 'rest').ok, true, `action ${i + 1}`);
      }
      const r = doAction(s, 'rest');
      assertEq(r.ok, false, '6th action rejected');
      assertEq(r.reason, 'no-actions', 'reason');
    },
  },
  {
    name: '结束本周结算 weeklyMoodDecay -4 / weeklyStressDecay -3（clamp [0,100]）',
    fn: () => {
      const s = newTestState(3);
      gotoWeek(s, 5);
      s.idol.mood = 2;
      s.idol.stress = 1;
      settleWeek(s);
      assertEq(s.idol.mood, 0, 'mood clamp at 0');
      assertEq(s.idol.stress, 0, 'stress clamp at 0');
      assertEq(s.weekSettled, true, 'settled flag');
    },
  },
  {
    name: '休息：stamina +45、stress -25、mood +6',
    fn: () => {
      const s = newTestState(3);
      gotoWeek(s, 1);
      s.idol.stamina = 0;
      s.idol.stress = 50;
      s.idol.mood = 50;
      doAction(s, 'rest');
      assertEq(s.idol.stamina, 45, 'stamina');
      assertEq(s.idol.stress, 25, 'stress');
      assertEq(s.idol.mood, 56, 'mood');
    },
  },
  {
    name: '第 12 周结算后强制进入结局判定（phase=judgement）并禁止任何行动',
    fn: () => {
      const s = newTestState(3);
      gotoWeek(s, CYCLE.weeksTotal);
      settleWeek(s);
      assertEq(s.phase, 'judgement', 'phase after week 12 settle');
      const r = doAction(s, 'train-vocal');
      assertEq(r.ok, false, 'action rejected after judgement');
      assertEq(r.reason, 'not-in-week', 'reason');
    },
  },
  {
    name: '未到第 12 周时结算不触发结局判定',
    fn: () => {
      const s = newTestState(3);
      gotoWeek(s, 11);
      settleWeek(s);
      assert(s.phase !== 'judgement', 'not judgement before week 12');
    },
  },
];
