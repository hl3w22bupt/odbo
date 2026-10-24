/**
 * schedule-board —— 周日程面板（spec scene id: ui-schedule-board）。
 * 渲染：周/章头、行动槽、五种行动按钮（含禁用态）、行动日志、结束本周。
 * 反馈即时性（AC④）：每次行动立即显示数值徽标与日志；行动后按钮状态即时刷新。
 */
import { h, clear, deltaBadge, statRow } from './ui.mjs';
import { CYCLE } from '../numeric.mjs';
import { skillRank } from '../entities/idol.mjs';
import { previewScore } from '../systems/stage-score.mjs';

const ACTION_META = {
  'train-vocal': { label: '唱功特训', emoji: '🎤', desc: 'vocal +3~9（60 后减半）｜体力 -18 压力 +8' },
  'train-dance': { label: '舞蹈特训', emoji: '🕺', desc: 'dance +3~9（60 后减半）｜体力 -18 压力 +8' },
  'rest': { label: '休息', emoji: '😴', desc: '体力 +45｜压力 -25｜心情 +6' },
  'social': { label: '社交', emoji: '💬', desc: '粉丝 +15｜心情 +8｜体力 -10' },
  'rehearsal': { label: '彩排', emoji: '🎭', desc: '半价训练｜查看舞台得分预览' },
};

/**
 * 渲染周日程面板。
 * ctx: { onAction(actionId), onEndWeek(), tutorialStep?: {action, hint} | null }
 */
export function renderScheduleBoard(root, state, ctx) {
  clear(root);
  const idol = state.idol;
  const stageToday = state.weekPlan && state.weekPlan.stage;

  const header = h('div', { class: 'week-header' },
    h('div', { class: 'week-title', text: state.week === 0 ? '序章·入社试镜' : `第 ${state.week} / ${CYCLE.weeksTotal} 周` }),
    h('div', { class: 'week-sub', text: `剩余行动 ${state.actionsLeft} / ${CYCLE.actionsPerWeek}${stageToday ? ` ｜ 周末：${stageToday.label}` : ' ｜ 本周无舞台'}` }),
  );

  const actions = h('div', { class: 'actions' });
  for (const [id, meta] of Object.entries(ACTION_META)) {
    const disabled =
      state.actionsLeft <= 0 ||
      (ctx.tutorialStep && ctx.tutorialStep.action !== id);
    actions.append(
      h('button', {
        class: `action-btn ${ctx.tutorialStep && ctx.tutorialStep.action === id ? 'guided' : ''}`,
        disabled: disabled ? '' : null,
        onclick: () => ctx.onAction(id),
      },
        h('span', { class: 'action-name', text: `${meta.emoji} ${meta.label}` }),
        h('span', { class: 'action-desc', text: meta.desc }),
      ),
    );
  }

  const logBox = h('div', { class: 'log' });
  for (const entry of state.weekLog.slice(-8).reverse()) {
    logBox.append(h('div', { class: 'log-line' },
      h('span', { class: 'log-action', text: ACTION_META[entry.action] ? ACTION_META[entry.action].label : entry.action === 'forced-rest' ? '⚠️ 强制休息' : entry.action }),
      deltaBadge(entry.delta),
    ));
  }

  const endBtn = h('button', {
    class: 'primary end-week',
    onclick: () => ctx.onEndWeek(),
  }, state.actionsLeft > 0 ? `结束本周（提前结算，还剩 ${state.actionsLeft} 次行动）` : '结束本周，进入结算');

  const rehearsalPreview = state.weekLog.some((l) => l.preview)
    ? h('div', { class: 'preview', text: `🎭 彩排预览：当前预计舞台得分 ${previewScore(state)}` })
    : null;

  root.append(
    ...[header, statRow(idol), h('div', { class: 'chapter-goal', text: chapterHint(state) }), rehearsalPreview, actions, endBtn, logBox]
      .filter((n) => n != null),
  );
}

function chapterHint(state) {
  if (state.week === 0) return '目标：完成入社试镜教学（教程保护，不会失败）';
  if (state.weekPlan && state.weekPlan.stage) return `本章舞台：${state.weekPlan.stage.label}（登台需体力 ≥25）`;
  return '本周没有舞台安排，安心训练。';
}

export { skillRank };
