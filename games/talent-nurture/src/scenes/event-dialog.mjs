/**
 * event-dialog —— 事件对话框（spec scene id: ui-event-dialog）。
 * AC③ 对抗输入：选项点击后立即锁定全部按钮（irreversible），连点/重复点击只生效一次。
 * AC④ 输入语义：选择后立即展示该选项的效果徽标（所见即所选）。
 */
import { h, clear, deltaBadge } from './ui.mjs';
import { floatText } from './fx.mjs';

/**
 * 渲染一个事件。
 * ctx: { onChoose(ev, choice) } —— onChoose 返回 { ok, effects }；ok 时锁定并展示效果。
 */
export function renderEventDialog(root, ev, ctx) {
  clear(root);
  const choicesBox = h('div', { class: 'event-choices' });
  const dialog = h('div', { class: 'dialog' });

  for (const choice of ev.choices) {
    const btn = h('button', {
      class: 'choice-btn',
      onclick: () => {
        // 幂等防护：视觉立即锁死，逻辑层（event-engine.chooseEventOption）二次幂等兜底
        lockChoices(choicesBox);
        btn.classList.add('chosen');
        const result = ctx.onChoose(ev, choice);
        if (result && result.ok) {
          const box = h('div', { class: 'event-result' },
            h('span', { text: `你选择了「${choice.text}」` }),
            deltaBadge(result.effects),
          );
          resultBox.append(box);
          // v+1：选择反馈浮字（首个变动值，如「+8 唱功」）
          const first = Object.entries(result.effects || {}).find(([, v]) => v);
          if (first) {
            const NAMES = { vocal: '唱功', dance: '舞技', stamina: '体力', mood: '心情', stress: '压力', fans: '粉丝' };
            const [k, v] = first;
            floatText(dialog, `${v > 0 ? '+' : ''}${v} ${NAMES[k] || k}`, v > 0 ? 'fx-up' : 'fx-down');
          }
          resultBox.append(h('button', { class: 'primary continue-btn', onclick: () => ctx.onContinue() }, '继续'));
        }
      },
    }, h('span', { text: choice.text }));
    choicesBox.append(btn);
  }

  const resultBox = h('div', { class: 'event-result-box' });
  dialog.append(
    h('div', { class: 'event-tag', text: '剧情事件' }),
    h('h2', { class: 'event-title', text: ev.title }),
    h('p', { class: 'event-text', text: ev.text }),
    choicesBox,
    resultBox,
  );
  root.append(dialog);
}

function lockChoices(box) {
  for (const btn of box.querySelectorAll('button')) {
    btn.disabled = true;
  }
}
