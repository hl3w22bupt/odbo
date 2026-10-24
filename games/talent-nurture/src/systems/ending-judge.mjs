/**
 * ending-judge —— 结局判定器（spec entity id: sys-ending-judge）。
 * 契约（acc-ending-judge）：第 12 周后按 ENDING_RULES.judgeOrder 优先级短路判定，五结局互斥且必居其一：
 *   双冠传奇 = vocal≥80 且 dance≥80 且公演得分≥85 且 fans≥1800
 *   歌姬     = vocal≥80 且 vocal>dance 且得分≥55
 *   舞灵     = dance≥80 且 dance>vocal 且得分≥55
 *   顺利出道 = 得分≥55
 *   否则     = 遗憾回校
 */
import { ENDING_RULES } from '../numeric.mjs';
import { ENDINGS } from '../data/endings.mjs';

export function judgeEnding({ vocal, dance, finalScore, fans, flags = {} }) {
  const R = ENDING_RULES;
  let id = 'fail-return';
  for (const candidate of R.judgeOrder) {
    if (matches(candidate, vocal, dance, finalScore, fans)) {
      id = candidate;
      break;
    }
  }
  const ending = ENDINGS[id];
  const variantLines = [];
  if (id !== 'fail-return' && flags.rivalWins >= 3) {
    variantLines.push(' rival-hidden');
  }
  if (flags.rivalryDeclared && (id === 'legend-dual' || id === 'vocal-specialist' || id === 'dance-specialist')) {
    variantLines.push(' rivalry-fulfilled');
  }
  return { id, ending, variantLines };
}

function matches(id, vocal, dance, finalScore, fans) {
  const R = ENDING_RULES;
  switch (id) {
    case 'legend-dual':
      return vocal >= R.dualElite && dance >= R.dualElite && finalScore >= R.legendScore && fans >= R.legendFans;
    case 'vocal-specialist':
      return vocal >= R.specialist && vocal > dance && finalScore >= R.debutPass;
    case 'dance-specialist':
      return dance >= R.specialist && dance > vocal && finalScore >= R.debutPass;
    case 'normal-debut':
      return finalScore >= R.debutPass;
    default:
      return true;
  }
}
