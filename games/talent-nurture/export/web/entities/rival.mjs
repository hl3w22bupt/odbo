/**
 * rival —— 对手练习生·苏晴（spec entity id: npc-rival）。
 * 对决得分表来自 spec.numeric.rival；连胜解锁隐藏对话（replay hook：对手隐藏线）。
 */
import { RIVAL } from '../numeric.mjs';

export const RIVAL_INFO = {
  id: 'npc-rival',
  name: '苏晴',
  title: '同期对手',
  emoji: '⭐',
  intro: '苏晴，公司这期最好的苗子。你的存在对我没威胁——现在还不是。',
  battleLine: '每周的舞台就是我的挑战书，接住。',
  defeatLine: '……这个舞台是你的了。下次，我不会再输。',
  hiddenLine: '（隐藏对话）说真的——12 周前的你和我之间，隔着一整个公司。现在没有了。',
};

export function rivalScoreFor(stageId) {
  switch (stageId) {
    case 'rival-battle-1': return RIVAL.scoreBattle1;
    case 'rival-battle-2': return RIVAL.scoreBattle2;
    case 'rival-battle-3': return RIVAL.scoreBattle3;
    case 'debut-showcase': return RIVAL.scoreFinale;
    default: return null;
  }
}
