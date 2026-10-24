/**
 * mentor-dance —— 舞蹈导师·K哥（spec entity id: npc-mentor-dance）。
 */
import { TRAINING } from '../numeric.mjs';

export const MENTOR_DANCE = {
  id: 'npc-mentor-dance',
  name: 'K哥',
  title: '舞蹈导师',
  emoji: '🕺',
  intro: 'K哥。舞台上腿软的人，台下一定没练够。练。',
  trainLine: '节拍卡准了，再来一遍，肌肉会记住。',
  praiseLine: '行啊，这动作有你的名字了。',
  worryLine: '脸色不行，今晚别跳了。',
};

export function danceLineAfterTrain(idol) {
  if (idol.mentorDanceAffinity >= 30) return MENTOR_DANCE.praiseLine;
  return MENTOR_DANCE.trainLine;
}

export function grantDanceAffinity(idol) {
  idol.mentorDanceAffinity += TRAINING.mentorAffinityGain;
  return idol.mentorDanceAffinity;
}
