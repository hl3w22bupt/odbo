/**
 * mentor-vocal —— 声乐导师·林澜（spec entity id: npc-mentor-vocal）。
 * 台词 + 好感反应；纯数据与小函数，无 DOM。
 */
import { TRAINING } from '../numeric.mjs';

export const MENTOR_VOCAL = {
  id: 'npc-mentor-vocal',
  name: '林澜',
  title: '声乐导师',
  emoji: '🎤',
  intro: '我是林澜，负责你的声乐。12 周很短，别浪费任何一个音。',
  trainLine: '气息再稳一点，把这句留在别人心里。',
  praiseLine: '今晚这个高音，有出道的样子了。',
  worryLine: '你的状态在往下掉，去休息，这是命令。',
};

/** 训练后按好感度取台词（好感 ≥30 用夸赞线，≥60 走 worry 检查交给调度层） */
export function vocalLineAfterTrain(idol) {
  if (idol.mentorVocalAffinity >= 30) return MENTOR_VOCAL.praiseLine;
  return MENTOR_VOCAL.trainLine;
}

/** 训练附带导师好感（数值来自 spec.numeric.training.mentorAffinityGain） */
export function grantVocalAffinity(idol) {
  idol.mentorVocalAffinity += TRAINING.mentorAffinityGain;
  return idol.mentorVocalAffinity;
}
