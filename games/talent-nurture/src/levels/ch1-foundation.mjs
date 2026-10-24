/** level-ch1 —— 第一章·特训第一课（第 1-2 周）。goal：vocal/dance 至少一项达 C 级(25)；内部考核 ≥45。 */
export const CH1 = {
  id: 'level-ch1-foundation',
  name: '第一章·特训第一课',
  chapter: 'ch1',
  weeks: {
    1: { events: ['el-ch1-ev-midnight'] },
    2: {
      events: ['el-ch1-ev-birthday'],
      stage: {
        id: 'el-ch1-stage-internal',
        stage: 'internal-check',
        label: '周末内部考核',
        passThreshold: 45,
      },
    },
  },
};
