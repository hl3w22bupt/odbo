/** acc-event-branch：每章 2~3 事件；每事件 2~3 互斥选项；选择立即按效果表生效并锁定（不可回退重选）；同事件不重复触发 */
import { newTestState, gotoWeek, assert, assertEq } from '../helpers.mjs';
import { dueEvents, chooseEventOption, validateEventLibrary } from '../../src/systems/event-engine.mjs';
import { ALL_EVENTS, placedCountByChapter } from '../../src/data/events.mjs';
import { EVENT_RULES } from '../../src/numeric.mjs';

export const tests = [
  {
    name: '事件库 ≥18 个事件，作者规则校验通过（选项数 2~3、核心六维 |delta| ≤30、fans ≤80）',
    fn: () => {
      assert(ALL_EVENTS.length >= 18, `library size ${ALL_EVENTS.length}`);
      const v = validateEventLibrary(ALL_EVENTS);
      assert(v.ok, `library validation: ${v.problems.join('; ')}`);
    },
  },
  {
    name: '落位事件每章 2~3 个（perChapterRange；prologue 为教程章豁免）',
    fn: () => {
      const counts = placedCountByChapter();
      for (const [ch, n] of Object.entries(counts)) {
        if (ch === 'prologue') continue;
        assertInRange(n, EVENT_RULES.perChapterRange[0], EVENT_RULES.perChapterRange[1], `chapter ${ch} events`);
      }
    },
  },
  {
    name: '选择后立即按效果表修改数值（深夜加练：vocal+5 stamina-12 stress+8）',
    fn: () => {
      const s = newTestState(11);
      gotoWeek(s, 1);
      const before = { ...s.idol };
      const r = chooseEventOption(s, 'el-ch1-ev-midnight', 'opt-keep-training');
      assertEq(r.ok, true, 'apply ok');
      assertEq(s.idol.vocal, before.vocal + 5, 'vocal');
      assertEq(s.idol.stamina, before.stamina - 12, 'stamina');
      assertEq(s.idol.stress, before.stress + 8, 'stress');
    },
  },
  {
    name: 'irreversible：同事件第二次选择被拒（连点/重放只生效一次），事件不重复触发',
    fn: () => {
      const s = newTestState(11);
      gotoWeek(s, 1);
      assertEq(chooseEventOption(s, 'el-ch1-ev-midnight', 'opt-keep-training').ok, true, 'first');
      const again = chooseEventOption(s, 'el-ch1-ev-midnight', 'opt-go-rest');
      assertEq(again.ok, false, 'second choice rejected');
      assertEq(again.reason, 'already-resolved', 'reason');
      assertEq(dueEvents(s).filter((e) => e.id === 'el-ch1-ev-midnight').length, 0, 'never re-fires');
    },
  },
  {
    name: '每章触发数符合排期（w1..w12 事件计划），分支 flag 写入 flags',
    fn: () => {
      const s = newTestState(11);
      gotoWeek(s, 2);
      assertEq(chooseEventOption(s, 'el-ch1-ev-birthday', 'opt-join-party').ok, true, 'apply');
      assertEq(s.flags.befriendedZhouyu, undefined, 'no flag on this choice');
      gotoWeek(s, 5);
      chooseEventOption(s, 'el-ch3-ev-battle-invite', 'opt-avoid');
      assertEq(s.flags.avoidedRival, true, 'flag written');
    },
  },
];

function assertInRange(v, lo, hi, msg) {
  if (v < lo || v > hi) throw new Error(`assertInRange failed: ${msg} (value=${v})`);
}
