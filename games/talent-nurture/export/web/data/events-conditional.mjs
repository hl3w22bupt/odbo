/**
 * events-conditional —— 条件触发事件（replay hooks / 状态反应事件）。
 * 与落位事件共用同一引擎与锁定语义；when(state) 为 true 且未触发过时可在本周追加触发。
 * content.replayHooks 对应：隐藏事件「巨星的深夜」（vocal/dance 达 S 级 85 触发）。
 */

export const HIDDEN_EVENT_ID = 'ev-hidden-star-night';

export const CONDITIONAL_EVENTS = [
  {
    id: HIDDEN_EVENT_ID,
    source: 'spec',
    chapter: 'any',
    title: '巨星的深夜',
    text: '凌晨的练习室只剩你一个人。镜子里那个动作，已经和教学视频里不一样了——是你自己的版本。',
    when: (state) => state.idol.vocal >= 85 || state.idol.dance >= 85,
    choices: [
      { id: 'opt-grind-dawn', text: '追着灵感练到天亮', effects: { vocal: 3, dance: 3, stamina: -20, mood: 8 }, flag: 'starNightGrind' },
      { id: 'opt-sleep-early', text: '早点睡觉保存体力', effects: { stamina: 25, mood: 5 } },
    ],
  },
  {
    id: 'ev-cond-low-mood',
    source: 'demo-extra',
    chapter: 'any',
    title: '情绪低谷',
    text: '你盯着镜子里的自己，忽然不知道这一切有没有意义。',
    when: (state) => state.idol.mood <= 20,
    choices: [
      { id: 'opt-call-home', text: '给妈妈打电话', effects: { mood: 15, stress: -5 }, flag: 'calledHome' },
      { id: 'opt-write-song', text: '把情绪写进日记', effects: { mood: 8, vocal: 2 } },
    ],
  },
  {
    id: 'ev-cond-stress-alarm',
    source: 'demo-extra',
    chapter: 'any',
    title: '压力警报',
    text: '手指在发抖，睡眠时间已经连续一周不足五小时。再这样下去，身体会先于公演倒下。',
    when: (state) => state.idol.stress >= 60,
    choices: [
      { id: 'opt-take-day', text: '给自己放半天假', effects: { stress: -18, mood: 6 } },
      { id: 'opt-push-on', text: '咬牙继续', effects: { stress: 8, vocal: 2, dance: 2 } },
    ],
  },
  {
    id: 'ev-cond-rising-pop',
    source: 'demo-extra',
    chapter: 'any',
    title: '人气上升期',
    text: '你的直拍切片冲上了热搜，评论里全是你的名字。公司建议趁势接一个商务。',
    when: (state) => state.idol.fans >= 500,
    choices: [
      { id: 'opt-take-gig', text: '接下商务', effects: { fans: 40, stamina: -12 }, flag: 'tookGig' },
      { id: 'opt-focus-train', text: '婉拒，专注训练', effects: { vocal: 3, dance: 3 } },
    ],
  },
  {
    id: 'ev-cond-rival-respect',
    source: 'demo-extra',
    chapter: 'any',
    title: '苏晴的认可',
    text: '连赢之后，苏晴在练习室门口拦住你，递来一瓶水：「……别在决赛前受伤。」',
    when: (state) => state.flags.rivalWins >= 2,
    choices: [
      { id: 'opt-accept-water', text: '接过水，道谢', effects: { mood: 10 }, flag: 'rivalRespect' },
      { id: 'opt-declare-final', text: '「决赛我也不会让」', effects: { stress: 5, dance: 3, vocal: 3 } },
    ],
  },
];
