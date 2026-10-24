/**
 * endings —— 结局定义数据（spec entity id: data-endings）。
 * 5 个互斥结局 + 判定优先级见 numeric.ENDING_RULES.judgeOrder。
 */
export const ENDINGS = {
  'legend-dual': {
    id: 'legend-dual',
    name: '双冠传奇',
    emoji: '👑',
    rank: 'TRUE END',
    text: '公演得分 85+，唱舞双双登顶，粉丝突破 1800。星辉市的夜空下，所有的灯牌都在喊同一个名字——小星。公司解约函变成了续约合同，林澜和 K哥在台下鼓了很久的掌。',
  },
  'vocal-specialist': {
    id: 'vocal-specialist',
    name: '歌姬之路',
    emoji: '🎤',
    rank: 'GOOD END A',
    text: '你的高音穿透了场馆的每一寸空气。出道发布会上，公司宣布以「主唱担当」身份推你出道——歌姬之路，刚刚开始。',
  },
  'dance-specialist': {
    id: 'dance-specialist',
    name: '舞灵之路',
    emoji: '🕺',
    rank: 'GOOD END B',
    text: '最后一个定格，全场起立。K哥在侧台吼得比谁都大声。你以「领舞担当」的身份站上了出道位——舞灵之名，从此属于你。',
  },
  'normal-debut': {
    id: 'normal-debut',
    name: '顺利出道',
    emoji: '🌟',
    rank: 'NORMAL END',
    text: '公演及格线之上，你拿到了那份出道合同。不是最耀眼的新人，但 12 周前那个连镜头都不敢看的自己，已经留在了练习室里。',
  },
  'fail-return': {
    id: 'fail-return',
    name: '遗憾回校',
    emoji: '🏫',
    rank: 'BAD END',
    text: '公演得分没有过线。解约协议放在桌上，苏晴在走廊里欲言又止。你背着书包走出尚声娱乐的大楼——但练习室的地板记得你流过的汗。要不要，再来一次？',
  },
};
