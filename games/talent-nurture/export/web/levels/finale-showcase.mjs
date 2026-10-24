/** level-finale —— 终章·新人出道公演（第 11-12 周）。公演得分永久记录，随后结局判定。 */
import { RIVAL } from '../numeric.mjs';

export const FINALE = {
  id: 'level-finale-showcase',
  name: '终章·新人出道公演',
  chapter: 'finale',
  weeks: {
    11: { events: ['ev-fin-media'] },
    12: {
      events: ['el-fin-ev-last-choice'],
      stage: {
        id: 'el-fin-stage-showcase',
        stage: 'debut-showcase',
        label: '新人出道公演',
        passThreshold: 55,
        rivalStage: true,
        rivalScore: RIVAL.scoreFinale,
        isFinale: true,
      },
    },
  },
};
