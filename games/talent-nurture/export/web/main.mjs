/**
 * main —— 游戏主控制器：显式状态机 title → week/events/stage → judgement → ended。
 * AC②：newGame() 每次创建全新 state（重开零残留）；AC③：所有生效路径都有幂等锁。
 * 数值只读 numeric.js；玩法编排只做流程与场景切换。
 */
import { CYCLE, TRAINING, STAGE, GUARD } from './numeric.mjs';
import { TUNING_META } from './numeric.mjs';
import { createIdol } from './entities/idol.mjs';
import { createRng } from './systems/rng.mjs';
import { beginWeek, doAction, settleWeek } from './systems/scheduler.mjs';
import { dueEvents, chooseEventOption } from './systems/event-engine.mjs';
import { performStage } from './systems/stage-score.mjs';
import { judgeEnding } from './systems/ending-judge.mjs';
import { PLACED_EVENTS } from './data/events-placed.mjs';
import { CONDITIONAL_EVENTS } from './data/events-conditional.mjs';
import { PROLOGUE } from './levels/prologue.mjs';
import { CH1 } from './levels/ch1-foundation.mjs';
import { CH2 } from './levels/ch2-first-stage.mjs';
import { CH3 } from './levels/ch3-rival-crisis.mjs';
import { CH4 } from './levels/ch4-fanfest.mjs';
import { FINALE } from './levels/finale-showcase.mjs';
import { h, clear } from './scenes/ui.mjs';
import { renderScheduleBoard } from './scenes/schedule-board.mjs';
import { renderEventDialog } from './scenes/event-dialog.mjs';
import { renderStageConfirm, renderStageResult } from './scenes/stage-live.mjs';
import { renderEndingScreen } from './scenes/ending-screen.mjs';
import { curtain, introCinematic } from './scenes/fx.mjs';
import { flashPose } from './scenes/idol-avatar.mjs';
import { MENTOR_VOCAL } from './entities/mentor-vocal.mjs';
import { MENTOR_DANCE } from './entities/mentor-dance.mjs';
import { RIVAL_INFO } from './entities/rival.mjs';

const LEVELS = [PROLOGUE, CH1, CH2, CH3, CH4, FINALE];
const WEEK_PLANS = {};
for (const lv of LEVELS) {
  for (const [w, plan] of Object.entries(lv.weeks)) {
    WEEK_PLANS[Number(w)] = { ...plan, levelId: lv.id, levelName: lv.name };
  }
}

/** 某一周的周计划（进入周 N 用 WEEK_PLANS[N]；beginWeek 内部才自增周数——勿传当前周） */
export function planForWeek(week) {
  return WEEK_PLANS[week] || {};
}

// ---- 调参桥应用：只认 TUNING_META 声明的键，按 min/max 钳制（§3C 契约）----
export function applyTuning(tuning) {
  if (!tuning || typeof tuning !== 'object' || Array.isArray(tuning)) return {};
  const applied = {};
  for (const [key, meta] of Object.entries(TUNING_META)) {
    const v = tuning[key];
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    const clamped = Math.min(meta.max, Math.max(meta.min, v));
    meta.set(clamped);
    applied[key] = clamped;
  }
  return applied;
}

// ---- 极简 WebAudio 合成音效（实例由壳页 AudioContext 包装层捕获，移动端手势解锁兜底）----
let audioCtxRef = null;
function beep(freq, dur, type = 'sine', gainVal = 0.05) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtxRef = audioCtxRef || new AC();
    const osc = audioCtxRef.createOscillator();
    const gain = audioCtxRef.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain).connect(audioCtxRef.destination);
    const t = audioCtxRef.currentTime;
    osc.start(t);
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.stop(t + dur);
  } catch (e) { /* 音频永不阻断玩法 */ }
}
const sfx = {
  click: () => beep(660, 0.06, 'square', 0.03),
  good: () => { beep(523, 0.12); setTimeout(() => beep(784, 0.18), 90); },
  bad: () => beep(180, 0.25, 'sawtooth', 0.04),
};

// ---- 状态创建（唯一入口，保证重开零残留）----
export function newGame(seed = Math.floor(Math.random() * 2 ** 31)) {
  return {
    seed,
    rng: createRng(seed),
    phase: 'title',
    week: 0,
    actionsLeft: 0,
    weekSettled: true,
    forcedRestDone: false,
    weekPlan: null,
    pendingEvents: [],
    tutorialIndex: 0,
    idol: createIdol(),
    firedEvents: new Set(),
    flags: { rivalWins: 0 },
    weekLog: [],
    finalScore: null,
    judge: null,
    lastStageResult: null,
  };
}

let state = newGame();
const gallery = new Set();
let root;

export function mount(el) {
  root = el;
  render();
}

// ---- 渲染分发（显式状态机）----
function render() {
  if (!root) return;
  clear(root);
  switch (state.phase) {
    case 'title': return renderTitle();
    case 'intro': return renderIntro();
    case 'event': {
      const ev = state.pendingEvents[0];
      if (!ev) { state.phase = 'week'; return render(); }
      curtain(root); // v+1：事件幕布过场（V1 修复：挂 body 级 fx 层，不被下方 renderEventDialog 的 clear(root) 同帧清除）
      return renderEventDialog(root, ev, {
        onChoose: (e, choice) => {
          const r = chooseEventOption(state, e.id, choice.id);
          if (r.ok) sfx.click();
          return r;
        },
        onContinue: () => {
          state.pendingEvents.shift();
          if (!state.pendingEvents.length) state.phase = 'week';
          render();
        },
      });
    }
    case 'week': return renderScheduleBoard(root, state, {
      tutorialStep: tutorialStep(),
      onAction: onAction,
      onEndWeek: onEndWeek,
    });
    case 'stage-confirm': return renderStageConfirm(root, state, state.weekPlan.stage, {
      onPerform: onPerformStage,
      onSkip: onSkipStage,
    });
    case 'stage-result': return renderStageResult(root, state, state.weekPlan.stage, state.lastStageResult, {
      onContinue: afterStage,
    });
    case 'ended': return renderEndingScreen(root, state.judge, state, { onRestart: restart, gallery });
    default: return renderTitle();
  }
}

function tutorialStep() {
  if (state.week !== 0) return null;
  const steps = PROLOGUE.tutorial.steps;
  return state.tutorialIndex < steps.length ? steps[state.tutorialIndex] : null;
}

function renderTitle() {
  root.append(
    h('div', { class: 'title-screen' },
      h('h1', { class: 'game-title', text: '🌟 星光练习生：才艺养成物语' }),
      h('p', { class: 'tagline', text: '12 周，把唱功与舞技磨成出道舞台的高光。每一次分支选择，都在改写 5 个结局的走向。' }),
      h('div', { class: 'howto' },
        h('p', { text: '玩法：每周 5 次行动（唱功特训 / 舞蹈特训 / 休息 / 社交 / 彩排）→ 周末舞台得分 = 唱功×0.5 + 舞技×0.35 + 心情×0.15。' }),
        h('p', { text: '登台需体力 ≥25；压力 ≥70 会被强制休息；第 12 周公演决定结局（共 5 种）。' }),
      ),
      h('div', { class: 'cast' },
        h('span', { text: `${MENTOR_VOCAL.emoji} 声乐导师 ${MENTOR_VOCAL.name}` }),
        h('span', { text: `${MENTOR_DANCE.emoji} 舞蹈导师 ${MENTOR_DANCE.name}` }),
        h('span', { text: `${RIVAL_INFO.emoji} 同期对手 ${RIVAL_INFO.name}` }),
      ),
      h('button', { class: 'primary start-btn', onclick: startGame }, '▶ 开始练习生生涯'),
    ),
  );
}

function renderIntro() {
  root.append(
    h('div', { class: 'dialog' },
      h('div', { class: 'event-tag', text: '序章' }),
      h('h2', { text: '入社第一天' }),
      h('p', { text: `${MENTOR_VOCAL.emoji} ${MENTOR_VOCAL.name}：「${MENTOR_VOCAL.intro}」` }),
      h('p', { text: `${MENTOR_DANCE.emoji} ${MENTOR_DANCE.name}：「${MENTOR_DANCE.intro}」` }),
      h('p', { text: `${RIVAL_INFO.emoji} ${RIVAL_INFO.name}路过练习室，瞥了你一眼：「${RIVAL_INFO.intro}」` }),
      h('button', { class: 'primary', onclick: () => { state.phase = state.pendingEvents.length ? 'event' : 'week'; render(); } }, '开始第一周'),
    ),
  );
  introCinematic(root); // v+1：程序化开场演出（黑边+胶片颗粒+缓推+透黑淡入，触摸即跳过，零视频）
}

function startGame() {
  state = newGame();
  state.phase = 'intro';
  sfx.click();
  enterPrologue();
  render();
}

/** 序章（第 0 周，教程）：不经过 beginWeek 的自增，保持 week=0 与 PROLOGUE.weeks 键位对齐 */
function enterPrologue() {
  state.week = 0;
  state.actionsLeft = CYCLE.actionsPerWeek;
  state.forcedRestDone = false;
  state.weekSettled = false;
  state.weekPlan = WEEK_PLANS[0];
  state.tutorialIndex = 0;
  queueDueEvents();
}

function restart() {
  // 完全重置：丢弃旧 state，全新对象（AC②）；结局画廊按会话保留（replay hook）
  state = newGame();
  startGame();
}

function queueDueEvents() {
  const due = dueEvents(state).filter((ev) => (state.week === 0 ? typeof ev.week === 'number' : true));
  state.pendingEvents = due;
}

function onAction(actionId) {
  const step = tutorialStep();
  if (step && step.action !== actionId) return;
  const r = doAction(state, actionId, 'vocal');
  if (!r.ok) return;
  if (step) state.tutorialIndex += 1;
  // v+1：行动瞬态姿态（特训=流汗训练 / 社交=小庆祝 / 彩排=起舞 / 休息=回待机）
  const POSE_BY_ACTION = { 'train-vocal': 'train', 'train-dance': 'train', social: 'celebrate', rehearsal: 'dance', rest: 'idle' };
  flashPose(POSE_BY_ACTION[actionId] || 'idle', actionId === 'rest' ? 400 : 900, 'idle');
  sfx.click();
  render();
}

function onEndWeek() {
  // acc-week-loop：用完行动槽「或点结束本周」都可结算 → 允许提前结束
  settleWeek(state);
  state.weekLog = [];
  const stage = state.weekPlan && state.weekPlan.stage;
  if (stage) {
    state.phase = 'stage-confirm';
  } else if (state.week >= CYCLE.weeksTotal) {
    judgeNow();
    return;
  } else {
    beginNextWeek();
  }
  render();
}

function beginNextWeek() {
  // beginWeek 内部 self-increment：进入周 N 需传 N 的计划（state.week+1）
  beginWeek(state, planForWeek(state.week + 1));
  queueDueEvents();
  state.phase = state.pendingEvents.length ? 'event' : 'week';
}

function onPerformStage() {
  const stage = state.weekPlan.stage;
  let result = performStage(state, stage);
  if (stage.tutorialProtect && result.tier === 'fail') {
    result = { ...result, tier: 'pass', protectedNote: '林澜：「教程保护——这次算你过。」' };
  }
  if (stage.isFinale) state.finalScore = result.score;
  state.lastStageResult = result;
  if (result.tier === 'fail' || result.missed) sfx.bad(); else sfx.good();
  state.phase = 'stage-result';
  render();
}

function onSkipStage() {
  state.lastStageResult = { missed: true, reason: 'stamina', score: 0, tier: 'fail', fansGain: 0 };
  if (state.weekPlan.stage.isFinale) state.finalScore = 0;
  sfx.bad();
  state.phase = 'stage-result';
  render();
}

function afterStage() {
  const stage = state.weekPlan.stage;
  if (stage.isFinale || state.week >= CYCLE.weeksTotal) {
    judgeNow();
    return;
  }
  beginNextWeek();
  render();
}

function judgeNow() {
  state.judge = judgeEnding({
    vocal: state.idol.vocal,
    dance: state.idol.dance,
    finalScore: state.finalScore ?? 0,
    fans: state.idol.fans,
    flags: state.flags,
  });
  gallery.add(state.judge.id);
  state.phase = 'ended';
  render();
}

// ---- 浏览器启动 ----
if (typeof window !== 'undefined') {
  const raw = new URLSearchParams(location.search).get('tuning');
  if (raw) {
    try {
      const t = JSON.parse(raw);
      if (t && typeof t === 'object' && !Array.isArray(t)) {
        window.__GAME_TUNING__ = t; // 壳页已先行解析；此处兜底并应用钳制
        applyTuning(t);
      }
    } catch (e) { /* 非 JSON 忽略 */ }
  }
  window.__talentDebug = () => ({
    phase: state.phase, week: state.week, actionsLeft: state.actionsLeft,
    buildVersion: window.__BUILD_VERSION || null,
    idol: { ...state.idol }, flags: { ...state.flags },
    fired: [...state.firedEvents], finalScore: state.finalScore, ending: state.judge && state.judge.id,
    conditionalLibrary: CONDITIONAL_EVENTS.length,
    tuning: {
      gainBase: TRAINING.gainBase, gainVariance: TRAINING.gainVariance,
      passThreshold: STAGE.passThreshold, forcedRestStress: GUARD.forcedRestStress,
    },
  });
  const boot = () => {
    const el = document.getElementById('game-root');
    if (el) mount(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
