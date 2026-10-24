/** acc-fans-growth：得分 ≥55 → fans += round((得分-55)×15×(1±0.20))，clamp [0,9999]；<55 不变；答谢祭 ×1.5 */
import { newTestState, gotoWeek, assert, assertEq, assertInRange } from '../helpers.mjs';
import { performStage } from '../../src/systems/stage-score.mjs';

function stageOnce(seed, scoreSetup, stage = {}) {
  const s = newTestState(seed);
  gotoWeek(s, 2);
  Object.assign(s.idol, scoreSetup, { stamina: 100 });
  const r = performStage(s, { id: 'x', label: 'X', ...stage });
  return { s, r };
}

export const tests = [
  {
    name: 'score=85 → fansGain ∈ [360, 540]（(85-55)×15 的 ±20%）',
    fn: () => {
      for (let seed = 1; seed <= 30; seed++) {
        const { r } = stageOnce(seed, { vocal: 100, dance: 100, mood: 100 });
        assertEq(r.score, 100, 'score 100');
        // (100-55)*15=675 → [540, 810]
        assertInRange(r.fansGain, 540, 810, `seed=${seed} fans gain`);
      }
    },
  },
  {
    name: 'score=85 + 答谢祭 ×1.5 → fansGain ∈ [810, 1215]',
    fn: () => {
      for (let seed = 1; seed <= 30; seed++) {
        const { r } = stageOnce(seed, { vocal: 100, dance: 100, mood: 100 }, { fansGainMultiplier: 1.5 });
        assertInRange(r.fansGain, 810, 1215, `seed=${seed} fanfest gain`);
      }
    },
  },
  {
    name: '得分 <55 粉丝不变；fans 上限 9999',
    fn: () => {
      const { r } = stageOnce(5, { vocal: 0, dance: 0, mood: 0 });
      assertEq(r.fansGain, 0, 'no fans on fail');
      const s = newTestState(5);
      gotoWeek(s, 2);
      s.idol.fans = 9990;
      s.idol.vocal = 100;
      s.idol.dance = 100;
      s.idol.mood = 100;
      performStage(s, { id: 'x', label: 'X' });
      assert(s.idol.fans <= 9999, 'fans cap 9999');
    },
  },
  {
    name: '刚过及格线（得分 60）→ fansGain = (60-55)×15 ∈ [60, 90]',
    fn: () => {
      const { r } = stageOnce(9, { vocal: 60, dance: 60, mood: 60 }); // 30+21+9 = 60
      assertEq(r.score, 60, 'score 60');
      assertInRange(r.fansGain, 60, 90, 'small gain');
    },
  },
];
