/** level-ch3 —— 第三章·苏晴的挑战书（第 5-8 周）。goal：双技能 ≥45(B)；三场对决（对手 50/62/70）至少赢 1 次。 */
import { RIVAL } from '../numeric.mjs';

export const CH3 = {
  id: 'level-ch3-rival-crisis',
  name: '第三章·苏晴的挑战书',
  chapter: 'ch3',
  weeks: {
    5: {
      events: ['el-ch3-ev-battle-invite'],
      stage: {
        id: 'el-ch3-stage-vs-rival-1',
        stage: 'rival-battle-1',
        label: '对决 1 · 苏晴',
        passThreshold: 55,
        rivalStage: true,
        rivalScore: RIVAL.scoreBattle1,
      },
    },
    6: {
      events: ['el-ch3-ev-rumor'],
      stage: {
        id: 'el-ch3-stage-vs-rival-2',
        stage: 'rival-battle-2',
        label: '对决 2 · 苏晴',
        passThreshold: 55,
        rivalStage: true,
        rivalScore: RIVAL.scoreBattle2,
      },
    },
    7: {
      events: ['el-ch3-ev-live-crash'],
      stage: {
        id: 'el-ch3-stage-vs-rival-3',
        stage: 'rival-battle-3',
        label: '对决 3 · 苏晴',
        passThreshold: 55,
        rivalStage: true,
        rivalScore: RIVAL.scoreBattle3,
      },
    },
    8: {},
  },
};
