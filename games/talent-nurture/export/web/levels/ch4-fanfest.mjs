/** level-ch4 —— 第四章·粉丝答谢祭（第 9-10 周）。goal：粉丝 ≥800；答谢祭 ≥70，粉丝收益 ×1.5；解锁 Live 模式。 */
export const CH4 = {
  id: 'level-ch4-fanfest',
  name: '第四章·粉丝答谢祭',
  chapter: 'ch4',
  weeks: {
    9: { events: ['el-ch4-ev-fan-letter'] },
    10: {
      events: ['el-ch4-ev-mentor-pick'],
      stage: {
        id: 'el-ch4-stage-fanfest',
        stage: 'fan-festival',
        label: '粉丝答谢祭',
        passThreshold: 70,
        fansGainMultiplier: 1.5,
      },
    },
  },
};
