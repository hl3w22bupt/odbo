/**
 * events-placed —— 落位事件（按周排期）。
 * 来源标注：source:'spec' = 与 design-spec levels[].elements 的 branch-event 逐字一致
 * （id/文案/效果表原值）；source:'demo-extra' = demo 为满足 perChapterRange 补写的章节事件。
 * 效果键支持：vocal/dance/stamina/mood/stress/fans/mentorVocalAffinity/mentorDanceAffinity/
 * nextStageScoreBuff；choice.flag 写入 state.flags（驱动后续剧情与结局变体）。
 */

export const PLACED_EVENTS = [
  // —— 序章（教程章，2 个轻量事件，让玩家在教程里就学会做分支选择）——
  {
    id: 'ev-pro-roommate',
    source: 'demo-extra',
    chapter: 'prologue',
    week: 0,
    title: '室友初见',
    text: '宿舍门推开，一个抱着一摞偶像杂志的女生冲你笑：「你就是同期的小星吧？我叫周雨，练习生三个月了。要走这条路，先想清楚哦。」',
    choices: [
      { id: 'opt-swap-contact', text: '交换联系方式', effects: { mood: 5 }, flag: 'befriendedZhouyu' },
      { id: 'opt-stay-focus', text: '点头致意，先去练习室', effects: { stress: 3, vocal: 2 } },
    ],
  },
  {
    id: 'ev-pro-first-costume',
    source: 'demo-extra',
    chapter: 'prologue',
    week: 0,
    title: '第一套练习服',
    text: '更衣柜里挂着印有你名字的练习服。镜子里的自己看起来像个真正的练习生了。',
    choices: [
      { id: 'opt-selfie', text: '自拍发给家人', effects: { mood: 6 } },
      { id: 'opt-mirror-pose', text: '对着镜子练一个定格', effects: { dance: 3, stress: 2 } },
    ],
  },

  // —— 第一章（第 1-2 周）——
  {
    id: 'el-ch1-ev-midnight',
    source: 'spec',
    chapter: 'ch1',
    week: 1,
    title: '深夜加练的诱惑',
    text: '晚上十一点，练习室的灯还亮着。林澜发来消息：「明早还要测体能，你确定还要练？」',
    choices: [
      { id: 'opt-keep-training', text: '留下来加练', effects: { vocal: 5, stamina: -12, stress: 8 } },
      { id: 'opt-go-rest', text: '回去睡觉', effects: { mood: 5, stamina: 20 } },
    ],
  },
  {
    id: 'el-ch1-ev-birthday',
    source: 'spec',
    chapter: 'ch1',
    week: 2,
    title: '室友的生日会',
    text: '室友周雨的生日会就在今晚，而周六有内部考核。蛋糕已经订好了。',
    choices: [
      { id: 'opt-join-party', text: '去参加生日会', effects: { mood: 12, stamina: -8 } },
      { id: 'opt-keep-rehearsal', text: '留下排练', effects: { dance: 4, mood: -6 } },
    ],
  },

  // —— 第二章（第 3-4 周）——
  {
    id: 'el-ch2-ev-nerves',
    source: 'spec',
    chapter: 'ch2',
    week: 3,
    title: '上台前怯场',
    text: '后台的幕布后面能听见观众的嗡嗡声。你的手心全是汗——这是你第一次面对真正的观众。',
    choices: [
      { id: 'opt-breathe', text: '后台深呼吸', effects: { mood: 8 } },
      { id: 'opt-talk-linlan', text: '找林澜倾诉', effects: { mentorVocalAffinity: 10, mood: 12 } },
      { id: 'opt-push-through', text: '硬撑上台', effects: { stress: 10, vocal: 3 } },
    ],
  },
  {
    id: 'el-ch2-ev-interview',
    source: 'spec',
    chapter: 'ch2',
    week: 4,
    title: '赛后采访',
    text: '首次舞台结束，采访镜头对准你：「对新同期的苏晴，你有信心超越她吗？」',
    choices: [
      { id: 'opt-humble', text: '谦虚感谢团队', effects: { fans: 30, mood: 5 } },
      { id: 'opt-declare', text: '放话要超越苏晴', effects: { fans: 60, stress: 8 }, flag: 'rivalryDeclared' },
    ],
  },

  // —— 第三章（第 5-8 周）——
  {
    id: 'el-ch3-ev-battle-invite',
    source: 'spec',
    chapter: 'ch3',
    week: 5,
    title: '练习室对决邀请',
    text: '苏晴把一瓶水放在你面前：「周末的舞台，我们正面比一场。敢吗？」',
    choices: [
      { id: 'opt-accept-battle', text: '应战', effects: { dance: 6, stamina: -15 } },
      { id: 'opt-avoid', text: '回避', effects: { stress: 12 }, flag: 'avoidedRival' },
    ],
  },
  {
    id: 'el-ch3-ev-rumor',
    source: 'spec',
    chapter: 'ch3',
    week: 6,
    title: '被造谣事件',
    text: '论坛上突然出现「小星挤掉别人出道位」的帖子，转发正在发酵。周末就是第二场对决。',
    choices: [
      { id: 'opt-clarify', text: '公开澄清', effects: { mood: -8 }, flag: 'clarifiedRumor' },
      { id: 'opt-prove-by-stage', text: '用实力回应', effects: { nextStageScoreBuff: 5 }, flag: 'proveByStage' },
    ],
  },
  {
    id: 'el-ch3-ev-live-crash',
    source: 'spec',
    chapter: 'ch3',
    week: 7,
    title: '直播翻车危机',
    text: '公司临时安排的粉丝直播里，伴奏轨坏了，三千人在线看着你。',
    choices: [
      { id: 'opt-rescue', text: '临场救场清唱', effects: { fans: 80, stress: 6 }, flag: 'savedLivestream' },
      { id: 'opt-apologize-off', text: '道歉下播', effects: { fans: -30, mood: -10 } },
    ],
  },

  // —— 第四章（第 9-10 周）——
  {
    id: 'el-ch4-ev-fan-letter',
    source: 'spec',
    chapter: 'ch4',
    week: 9,
    title: '粉丝来信',
    text: '公司转来一封手写信：「我明年也要考练习生。因为你，我相信普通人也可以发光。」',
    choices: [
      { id: 'opt-reply-personal', text: '亲自回信', effects: { fans: 50, mood: 10 }, flag: 'repliedFan' },
      { id: 'opt-reply-official', text: '统一官方回复', effects: { fans: 20 } },
    ],
  },
  {
    id: 'el-ch4-ev-mentor-pick',
    source: 'spec',
    chapter: 'ch4',
    week: 10,
    title: '导师特训二选一',
    text: '答谢祭前的特训营只有一个名额——林澜的声乐营，或者K哥的舞蹈营。',
    choices: [
      { id: 'opt-vocal-camp', text: '参加林澜声乐营', effects: { vocal: 8, stamina: -10 }, flag: 'choseVocalCamp' },
      { id: 'opt-dance-camp', text: '参加K哥舞蹈营', effects: { dance: 8, stamina: -10 }, flag: 'choseDanceCamp' },
    ],
  },

  // —— 终章（第 11-12 周）——
  {
    id: 'ev-fin-media',
    source: 'demo-extra',
    chapter: 'finale',
    week: 11,
    title: '媒体的最后质疑',
    text: '出道公演前最后一周，娱乐号发文：「练习生小星，德不配位？」评论区吵成一团。',
    choices: [
      { id: 'opt-quiet-train', text: '不回应，安静训练', effects: { stress: -5, vocal: 2 } },
      { id: 'opt-face-media', text: '直播正面回应', effects: { fans: 25, stress: 6 }, flag: 'facedMedia' },
    ],
  },
  {
    id: 'el-fin-ev-last-choice',
    source: 'spec',
    chapter: 'finale',
    week: 12,
    title: '公演前夜',
    text: '最后一个夜晚。编舞老师提出一个方案：保守稳练，或者挑战那个成功率五成的高难编舞。',
    choices: [
      { id: 'opt-safe-rehearsal', text: '保守稳练', effects: { nextStageScoreBuff: 2, stress: -15 } },
      { id: 'opt-hard-choreo', text: '挑战高难编舞', effects: { nextStageScoreBuff: 6, stress: 15 }, flag: 'hardChoreo' },
    ],
  },
];
