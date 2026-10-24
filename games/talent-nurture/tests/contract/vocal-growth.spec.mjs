/** acc-vocal-growth：唱功特训增益公式（randint(3,9)、60 软上限减半、stamina -18、stress +8、clamp [0,100]） */
import { newTestState } from '../helpers.mjs';
import { trainVocal } from '../../src/systems/stat-growth.mjs';
import { assert, assertEq, assertInRange } from '../helpers.mjs';

export const tests = [
  {
    name: 'vocal<60 时增益在 [3,9]，stamina -18，stress +8',
    fn: () => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = newTestState(seed);
        s.idol.vocal = 10;
        const before = { vocal: s.idol.vocal, stamina: s.idol.stamina, stress: s.idol.stress };
        trainVocal(s);
        assertInRange(s.idol.vocal - before.vocal, 3, 9, `seed=${seed} vocal gain`);
        assertEq(s.idol.stamina, before.stamina - 18, `seed=${seed} stamina`);
        assertEq(s.idol.stress, before.stress + 8, `seed=${seed} stress`);
      }
    },
  },
  {
    name: 'vocal>=60 软上限：增益 = floor(randint(3,9)*0.5) ∈ [1,4]',
    fn: () => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = newTestState(seed);
        s.idol.vocal = 65;
        const before = s.idol.vocal;
        trainVocal(s);
        assertInRange(s.idol.vocal - before, 1, 4, `seed=${seed} softcap gain`);
      }
    },
  },
  {
    name: '越界钳制：vocal 接近 100 时不得突破 100',
    fn: () => {
      for (let seed = 1; seed <= 20; seed++) {
        const s = newTestState(seed);
        s.idol.vocal = 99;
        trainVocal(s);
        assert(s.idol.vocal <= 100, `seed=${seed} vocal cap`);
      }
    },
  },
];
