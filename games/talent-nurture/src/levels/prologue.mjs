/**
 * level-prologue —— 序章·入社试镜（教程，不可失败）。
 * goal：vocal/dance 各特训 1 次 + 休息 1 次，学会日程面板；试镜检查点 ≥30（教程保护必过）。
 */
export const PROLOGUE = {
  id: 'level-prologue',
  name: '序章·入社试镜',
  chapter: 'prologue',
  tutorial: {
    steps: [
      { action: 'train-vocal', elementId: 'el-pro-tutorial-vocal', hint: '点击「唱功特训」，完成第一次声乐练习' },
      { action: 'train-dance', elementId: 'el-pro-tutorial-dance', hint: '点击「舞蹈特训」，完成第一次舞蹈练习' },
      { action: 'rest', elementId: 'el-pro-tutorial-rest', hint: '点击「休息」，学会恢复体力' },
    ],
    introElementId: 'el-pro-intro',
  },
  weeks: {
    0: {
      events: ['ev-pro-roommate', 'ev-pro-first-costume'],
      stage: {
        id: 'el-pro-audition',
        stage: 'audition',
        label: '入社试镜',
        passThreshold: 30,
        tutorialProtect: true,
      },
    },
  },
};
