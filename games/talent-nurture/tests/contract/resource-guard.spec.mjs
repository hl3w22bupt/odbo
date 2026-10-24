/** acc-resource-guard：stress≥70 强制休息并跳过本周剩余行动；mood=0 训练增益 ×0.5；任意数值越界 clamp 到定义域 */
import { newTestState, gotoWeek, assert, assertEq, assertInRange } from '../helpers.mjs';
import { doAction } from '../../src/systems/scheduler.mjs';
import { trainVocal } from '../../src/systems/stat-growth.mjs';
import { applyEffects } from '../../src/systems/event-engine.mjs';
import { chooseEventOption } from '../../src/systems/event-engine.mjs';

export const tests = [
  {
    name: 'stress ≥70 强制休息并跳过本周剩余行动（每周一次）',
    fn: () => {
      const s = newTestState(21);
      gotoWeek(s, 3);
      s.idol.stress = 69;
      const r = doAction(s, 'train-vocal');
      assertEq(r.ok, true, 'action applied');
      assert(r.forcedRest, 'forced rest triggered (+8 stress → 77 ≥ 70)');
      assertEq(s.actionsLeft, 0, 'remaining actions skipped');
      const r2 = doAction(s, 'rest');
      assertEq(r2.ok, false, 'no more actions this week');
    },
  },
  {
    name: 'mood=0 时训练增益 ×0.5（且不超无心情上限 4）',
    fn: () => {
      for (let seed = 1; seed <= 30; seed++) {
        const s = newTestState(seed);
        s.idol.mood = 0;
        s.idol.vocal = 10;
        const before = s.idol.vocal;
        trainVocal(s);
        assertInRange(s.idol.vocal - before, 1, 4, `seed=${seed} halved gain`);
      }
    },
  },
  {
    name: '事件效果越界 clamp：任意数值不越定义域、不为负',
    fn: () => {
      const s = newTestState(21);
      applyEffects(s, { stress: 500, vocal: -500, fans: -100, mood: 300, stamina: -1000 });
      assertEq(s.idol.stress, 100, 'stress cap');
      assertEq(s.idol.vocal, 0, 'vocal floor 0');
      assertEq(s.idol.fans, 0, 'fans floor 0');
      assertEq(s.idol.mood, 100, 'mood cap');
      assertEq(s.idol.stamina, 0, 'stamina floor 0');
      applyEffects(s, { vocal: 500, dance: 500, fans: 99999 });
      assertEq(s.idol.vocal, 100, 'vocal cap 100');
      assertEq(s.idol.dance, 100, 'dance cap 100');
      assertEq(s.idol.fans, 9999, 'fans cap 9999');
    },
  },
  {
    name: '事件选择路径同样受 clamp 保护（直播翻车 fans+80 应用后仍在定义域内）',
    fn: () => {
      const s = newTestState(21);
      gotoWeek(s, 7);
      s.idol.fans = 9990;
      const r = chooseEventOption(s, 'el-ch3-ev-live-crash', 'opt-rescue');
      assertEq(r.ok, true, 'applied');
      assertEq(s.idol.fans, 9999, 'fans clamped at 9999');
      assertEq(s.flags.savedLivestream, true, 'flag');
    },
  },
];
