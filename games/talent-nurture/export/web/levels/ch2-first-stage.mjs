/** level-ch2 —— 第二章·首次登台（第 3-4 周）。goal：首次公开舞台 ≥55；粉丝 ≥100；解锁导师特训课程。 */
export const CH2 = {
  id: 'level-ch2-first-stage',
  name: '第二章·首次登台',
  chapter: 'ch2',
  weeks: {
    3: { events: ['el-ch2-ev-nerves'] },
    4: {
      events: ['el-ch2-ev-interview'],
      stage: {
        id: 'el-ch2-stage-debut',
        stage: 'public-debut',
        label: '首次公开小舞台',
        passThreshold: 55,
      },
    },
  },
};
