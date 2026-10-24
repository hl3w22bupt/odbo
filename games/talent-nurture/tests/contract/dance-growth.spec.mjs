/** acc-dance-growth：舞蹈特训与唱功完全同一公式（含 60 软上限减半）与消耗（stamina -18、stress +8） */
import { newTestState, assertEq, assertInRange } from '../helpers.mjs';
import { trainDance, trainVocal } from '../../src/systems/stat-growth.mjs';

export const tests = [
  {
    name: 'dance<60 增益 [3,9]，消耗与唱功一致',
    fn: () => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = newTestState(seed);
        s.idol.dance = 10;
        const before = { dance: s.idol.dance, stamina: s.idol.stamina, stress: s.idol.stress };
        trainDance(s);
        assertInRange(s.idol.dance - before.dance, 3, 9, `seed=${seed} dance gain`);
        assertEq(s.idol.stamina, before.stamina - 18, `seed=${seed} stamina`);
        assertEq(s.idol.stress, before.stress + 8, `seed=${seed} stress`);
      }
    },
  },
  {
    name: '同一 seed 下舞蹈与唱功增益序列完全一致（同公式）',
    fn: () => {
      for (let seed = 1; seed <= 30; seed++) {
        const a = newTestState(seed);
        const b = newTestState(seed);
        a.idol.vocal = 10;
        b.idol.dance = 10;
        trainVocal(a);
        trainDance(b);
        assertEq(a.idol.vocal - 10, b.idol.dance - 10, `seed=${seed} same formula`);
      }
    },
  },
];
