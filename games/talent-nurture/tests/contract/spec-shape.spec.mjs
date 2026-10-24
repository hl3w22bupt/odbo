/** spec-shape：实现与 spec 的一致性契约（章节接线 / 对手分表 / 答谢祭倍率 / 隐藏事件 / 重开零残留） */
import { newTestState, gotoWeek, assert, assertEq } from '../helpers.mjs';
import { planForWeek } from '../../src/main.mjs';
import { doAction } from '../../src/systems/scheduler.mjs';
import { PROLOGUE } from '../../src/levels/prologue.mjs';
import { CH1 } from '../../src/levels/ch1-foundation.mjs';
import { CH2 } from '../../src/levels/ch2-first-stage.mjs';
import { CH3 } from '../../src/levels/ch3-rival-crisis.mjs';
import { CH4 } from '../../src/levels/ch4-fanfest.mjs';
import { FINALE } from '../../src/levels/finale-showcase.mjs';
import { ALL_EVENTS, HIDDEN_EVENT_ID } from '../../src/data/events.mjs';
import { CYCLE } from '../../src/numeric.mjs';

const LEVELS = [PROLOGUE, CH1, CH2, CH3, CH4, FINALE];

export const tests = [
  {
    name: '第 1~12 周全部有周计划；第 12 周为出道公演（isFinale，对手 72）',
    fn: () => {
      const plans = {};
      for (const lv of LEVELS) Object.assign(plans, lv.weeks);
      for (let w = 1; w <= CYCLE.weeksTotal; w++) {
        assert(plans[w], `week ${w} plan exists`);
      }
      const finale = plans[12].stage;
      assert(finale && finale.isFinale, 'week 12 finale stage');
      assertEq(finale.rivalScore, 72, 'finale rival score');
    },
  },
  {
    name: 'planForWeek 接线逐周核对（防 beginWeek 自增错位回归）：w0 试镜 / w2 内部考核 / w4 首秀 / w5-7 对决 / w10 答谢祭 / w12 公演',
    fn: () => {
      assertEq(planForWeek(0).stage && planForWeek(0).stage.id, 'el-pro-audition', 'w0 audition');
      assertEq(planForWeek(0).events.length, 2, 'w0 two prologue events');
      assertEq(planForWeek(2).stage.id, 'el-ch1-stage-internal', 'w2 internal check');
      assertEq(planForWeek(4).stage.id, 'el-ch2-stage-debut', 'w4 debut');
      assertEq(planForWeek(5).stage.rivalScore, 50, 'w5 battle1');
      assertEq(planForWeek(6).stage.rivalScore, 62, 'w6 battle2');
      assertEq(planForWeek(7).stage.rivalScore, 70, 'w7 battle3');
      assert(!planForWeek(8).stage, 'w8 no stage');
      assertEq(planForWeek(10).stage.id, 'el-ch4-stage-fanfest', 'w10 fanfest');
      assertEq(planForWeek(12).stage.id, 'el-fin-stage-showcase', 'w12 finale');
      assert(planForWeek(12).stage.isFinale, 'w12 isFinale');
    },
  },
  {
    name: '隐藏事件「巨星的深夜」存在于库中且带 when 谓词',
    fn: () => {
      const hidden = ALL_EVENTS.find((e) => e.id === HIDDEN_EVENT_ID);
      assert(hidden, 'hidden event exists');
      assert(typeof hidden.when === 'function', 'when predicate');
      const s = newTestState(1);
      s.idol.vocal = 86;
      assertEq(hidden.when(s), true, 'S-rank triggers');
    },
  },
  {
    name: '重开零残留：newGame 是全新对象，玩过的旧 state 不影响新局',
    fn: () => {
      const a = newTestState(5);
      gotoWeek(a, 1);
      doAction(a, 'train-vocal');
      a.flags.avoidedRival = true;
      a.firedEvents.add('el-ch1-ev-midnight');
      const b = newTestState(999);
      assertEq(b.idol.vocal, 10, 'vocal reset');
      assertEq(b.idol.stamina, 100, 'stamina reset');
      assertEq(b.week, 0, 'week reset');
      assertEq(b.firedEvents.size, 0, 'fired events reset');
      assertEq(b.flags.rivalWins, 0, 'flags reset');
      assert(!b.firedEvents.has('el-ch1-ev-midnight'), 'no residue');
    },
  },
];
