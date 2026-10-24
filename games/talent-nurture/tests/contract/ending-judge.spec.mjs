/** acc-ending-judge：优先级【双冠传奇→歌姬→舞灵→顺利出道→遗憾回校】短路判定唯一结局，五结局互斥且必居其一 */
import { assert, assertEq } from '../helpers.mjs';
import { judgeEnding } from '../../src/systems/ending-judge.mjs';
import { ENDINGS } from '../../src/data/endings.mjs';
import { ENDING_RULES } from '../../src/numeric.mjs';

const BASE = { vocal: 10, dance: 10, finalScore: 40, fans: 0, flags: {} };

export const tests = [
  {
    name: '全条件满足 → 短路判定为双冠传奇（最高优先级）',
    fn: () => {
      const r = judgeEnding({ ...BASE, vocal: 90, dance: 90, finalScore: 90, fans: 2000 });
      assertEq(r.id, 'legend-dual', 'legend first');
    },
  },
  {
    name: '歌姬：vocal≥80 且 vocal>dance 且得分≥55',
    fn: () => {
      const r = judgeEnding({ ...BASE, vocal: 85, dance: 60, finalScore: 60, fans: 100 });
      assertEq(r.id, 'vocal-specialist', 'vocal specialist');
      const notQuite = judgeEnding({ ...BASE, vocal: 85, dance: 85, finalScore: 60, fans: 100 });
      assert(notQuite.id !== 'vocal-specialist', 'vocal==dance 不满足 vocal>dance');
    },
  },
  {
    name: '舞灵：dance≥80 且 dance>vocal 且得分≥55',
    fn: () => {
      const r = judgeEnding({ ...BASE, vocal: 60, dance: 85, finalScore: 60, fans: 100 });
      assertEq(r.id, 'dance-specialist', 'dance specialist');
    },
  },
  {
    name: '顺利出道：得分≥55 但无双 elite；遗憾回校：得分<55',
    fn: () => {
      assertEq(judgeEnding({ ...BASE, vocal: 70, dance: 70, finalScore: 60, fans: 100 }).id, 'normal-debut', 'normal debut');
      assertEq(judgeEnding({ ...BASE, vocal: 90, dance: 90, finalScore: 54, fans: 5000 }).id, 'fail-return', 'fail return');
    },
  },
  {
    name: '五结局互斥且必居其一：任意输入恰好返回一个结局，且判定顺序与 spec 一致',
    fn: () => {
      assertEq(ENDING_RULES.judgeOrder.join(','), 'legend-dual,vocal-specialist,dance-specialist,normal-debut,fail-return', 'judge order');
      const cases = [
        { vocal: 90, dance: 90, finalScore: 90, fans: 2000 },
        { vocal: 85, dance: 60, finalScore: 60, fans: 100 },
        { vocal: 60, dance: 85, finalScore: 60, fans: 100 },
        { vocal: 70, dance: 70, finalScore: 60, fans: 100 },
        { vocal: 10, dance: 10, finalScore: 30, fans: 0 },
      ];
      for (const c of cases) {
        const r = judgeEnding({ ...BASE, ...c });
        assert(ENDINGS[r.id], `known ending for ${JSON.stringify(c)}`);
      }
      // 全部输入空间抽样的结局必在 5 结局集合内
      for (let v = 0; v <= 100; v += 25) {
        for (const fs of [30, 56, 75, 90]) {
          const r = judgeEnding({ vocal: v, dance: 100 - v, finalScore: fs, fans: v * 20, flags: {} });
          assert(ENDINGS[r.id], `exhaustive ending id ${r.id}`);
        }
      }
    },
  },
];
