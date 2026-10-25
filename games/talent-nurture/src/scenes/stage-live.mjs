/**
 * stage-live —— 舞台演出与结算场景（spec scene id: ui-stage-live）。
 * 登台需体力 ≥25（guard.stageMinStamina），不足可弃权；结果页展示得分/评级/粉丝收益/对手对比。
 */
import { h, clear, statRow } from './ui.mjs';
import { GUARD } from '../numeric.mjs';
import { stageFx, countUp, burstParticles, floatText } from './fx.mjs';
import { renderIdolAvatar } from './idol-avatar.mjs';

/** 登台确认页：体力门槛与一次性增益提示；ctx { onPerform(), onSkip() } */
export function renderStageConfirm(root, state, stage, ctx) {
  clear(root);
  const canPerform = state.idol.stamina >= GUARD.stageMinStamina;
  // 确认页人物姿态按舞台类型：内测=训练蓄力 / 公演与对决=演唱 / 灯海与终章=起舞
  const pose = stage.isFinale || stage.fansGainMultiplier ? 'dance' : String(stage.stage || '').startsWith('rival-battle') || stage.stage === 'public-debut' ? 'sing' : 'train';
  const dialog = h('div', { class: 'dialog stage-dialog' },
    h('div', { class: 'event-tag', text: '周末舞台' }),
    h('h2', { text: stage.label }),
    h('p', { text: stage.isFinale ? '这是决定你未来 12 周努力方向的舞台——出道与否，就看今晚。' : '周末的舞台来了。全场的灯打在你身上。' }),
    statRow(state.idol),
    h('div', { class: 'idol-slot' }, renderIdolAvatar({ pose, name: state.week >= 5 && String(stage.stage || '').startsWith('rival-battle') ? '小星 vs 苏晴' : '小星' })),
    h('p', { class: 'gate-line', text: canPerform ? `体力 ${state.idol.stamina} ≥ 25，可以登台${state.idol.nextStageScoreBuff ? `（含舞台增益 +${state.idol.nextStageScoreBuff}）` : ''}` : `体力不足 25（当前 ${state.idol.stamina}），强行登台会当场失声——只能弃权。` }),
    h('div', { class: 'stage-actions' },
      h('button', {
        class: 'primary',
        disabled: canPerform ? null : '',
        onclick: () => ctx.onPerform(),
      }, '🎤 登台演出'),
      h('button', { class: 'ghost', onclick: () => ctx.onSkip() }, '弃权'),
    ),
  );
  root.append(dialog);
  stageFx(dialog, stage); // v+1：聚光灯/扫光/VS 对打灯/灯海，按舞台类型
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

  // 结算人物姿态：良好/完美庆祝、及格演唱、失败失落
  const pose = result.tier === 'perfect' || result.tier === 'good' ? 'celebrate' : result.tier === 'pass' ? 'sing' : 'dejected';

  const scoreBig = h('div', { class: `score-big ${tierCls}` },
    h('span', { class: 'score-num', text: result.missed ? String(result.score) : '0' }),
    ` 分 · ${tierText}`,
  );
  const fansLine = h('p', { class: 'fans-line', text: result.fansGain > 0 ? `💗 粉丝 +${result.fansGain}${stage.fansGainMultiplier ? '（答谢祭 ×1.5）' : ''}` : '粉丝数没有变化。' });

  const dialog = h('div', { class: 'dialog stage-dialog' },
    h('div', { class: 'event-tag', text: '舞台结算' }),
    h('h2', { text: stage.label }),
    scoreBig,
    rivalLine,
    fansLine,
    statRow(state.idol),
    h('div', { class: 'idol-slot' }, renderIdolAvatar({ pose })),
    h('button', { class: 'primary', onclick: () => ctx.onContinue() }, '继续'),
  );
  root.append(dialog);

  // v+1 结算演出：评分 1.4s 滚动（四档分色）+ 彩带/灰烬 + 粉丝浮字
  if (!result.missed) countUp(scoreBig.querySelector('.score-num'), result.score, { dur: 1400 });
  if (result.tier === 'perfect' || result.tier === 'good') burstParticles(dialog, result.tier === 'perfect' ? 56 : 32, 'confetti');
  else if (result.tier === 'fail') burstParticles(dialog, 18, 'ash');
  if (result.fansGain > 0) floatText(dialog, `💗 +${result.fansGain}${stage.fansGainMultiplier ? ' ×1.5' : ''}`);
}
