/**
 * stage-live —— 舞台演出与结算场景（spec scene id: ui-stage-live）。
 * 登台需体力 ≥25（guard.stageMinStamina），不足可弃权；结果页展示得分/评级/粉丝收益/对手对比。
 */
import { h, clear, statRow } from './ui.mjs';
import { GUARD } from '../numeric.mjs';

/** 登台确认页：体力门槛与一次性增益提示；ctx { onPerform(), onSkip() } */
export function renderStageConfirm(root, state, stage, ctx) {
  clear(root);
  const canPerform = state.idol.stamina >= GUARD.stageMinStamina;
  root.append(
    h('div', { class: 'dialog stage-dialog' },
      h('div', { class: 'event-tag', text: '周末舞台' }),
      h('h2', { text: stage.label }),
      h('p', { text: stage.isFinale ? '这是决定你未来 12 周努力方向的舞台——出道与否，就看今晚。' : '周末的舞台来了。全场的灯打在你身上。' }),
      statRow(state.idol),
      h('p', { class: 'gate-line', text: canPerform ? `体力 ${state.idol.stamina} ≥ 25，可以登台${state.idol.nextStageScoreBuff ? `（含舞台增益 +${state.idol.nextStageScoreBuff}）` : ''}` : `体力不足 25（当前 ${state.idol.stamina}），强行登台会当场失声——只能弃权。` }),
      h('div', { class: 'stage-actions' },
        h('button', {
          class: 'primary',
          disabled: canPerform ? null : '',
          onclick: () => ctx.onPerform(),
        }, '🎤 登台演出'),
        h('button', { class: 'ghost', onclick: () => ctx.onSkip() }, '弃权'),
      ),
    ),
  );
}

/** 舞台结算页：result = performStage 的返回值；ctx { onContinue() } */
export function renderStageResult(root, state, stage, result, ctx) {
  clear(root);
  const tierText = { fail: '失败', pass: '及格', good: '良好', perfect: '完美' }[result.tier] || result.tier;
  const tierCls = { fail: 't-fail', pass: 't-pass', good: 't-good', perfect: 't-perfect' }[result.tier] || '';

  const rivalLine = result.rivalScore != null
    ? h('p', { class: `rival-line ${result.win ? 'win' : 'lose'}`, text: result.win
        ? `你 ${result.score} : ${result.rivalScore} 苏晴——这一场，你赢了！`
        : `你 ${result.score} : ${result.rivalScore} 苏晴——这一场，苏晴更胜一筹。` })
    : null;

  root.append(
    h('div', { class: 'dialog stage-dialog' },
      h('div', { class: 'event-tag', text: '舞台结算' }),
      h('h2', { text: stage.label }),
      h('div', { class: `score-big ${tierCls}`, text: `${result.score} 分 · ${tierText}` }),
      rivalLine,
      h('p', { class: 'fans-line', text: result.fansGain > 0 ? `💗 粉丝 +${result.fansGain}${stage.fansGainMultiplier ? '（答谢祭 ×1.5）' : ''}` : '粉丝数没有变化。' }),
      statRow(state.idol),
      h('button', { class: 'primary', onclick: () => ctx.onContinue() }, '继续'),
    ),
  );
}
