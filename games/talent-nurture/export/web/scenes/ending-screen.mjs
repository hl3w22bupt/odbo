/**
 * ending-screen —— 结局画面与结局图鉴（spec scene id: ui-ending-screen）。
 * AC②：结局达成后可重新开始；重开 = 全新 state（重开重置由 main.newGame 保证，此处只读展示）。
 */
import { h, clear } from './ui.mjs';

/**
 * ctx: { onRestart(), gallery: Set<endingId> }
 */
export function renderEndingScreen(root, judge, state, ctx) {
  clear(root);
  const { ending } = judge;
  const extras = (judge.variantLines || []).filter(Boolean);

  const flavor = [];
  if (extras.includes('rival-hidden')) flavor.push('苏晴在后台找到了你，说了那句只对强者说的话：「说真的——12 周前的你和我之间，隔着一整个公司。现在没有了。」');
  if (extras.includes('rivalry-fulfilled')) flavor.push('发布会上有记者问起你三个月前放话「要超越苏晴」。你笑了：「我说到做到。」');

  const galleryNames = ['legend-dual', 'vocal-specialist', 'dance-specialist', 'normal-debut', 'fail-return'];
  const gallery = h('div', { class: 'gallery' },
    h('h3', { text: '结局画廊（本周目收集）' }),
    h('div', { class: 'gallery-row' },
      galleryNames.map((id) => h('span', {
        class: `gallery-item ${ctx.gallery.has(id) ? 'got' : 'unknown'}`,
        text: ctx.gallery.has(id) ? id : '？？？',
      })),
    ),
  );

  root.append(
    h('div', { class: 'dialog ending-dialog' },
      h('div', { class: 'event-tag', text: ending.rank }),
      h('h1', { class: 'ending-title', text: `${ending.emoji} ${ending.name}` }),
      h('p', { class: 'ending-text', text: ending.text }),
      ...flavor.map((t) => h('p', { class: 'ending-flavor', text: t })),
      h('div', { class: 'ending-stats' },
        h('span', { text: `🎤 唱功 ${state.idol.vocal}` }),
        h('span', { text: `🕺 舞技 ${state.idol.dance}` }),
        h('span', { text: `🏆 公演 ${state.finalScore ?? '—'} 分` }),
        h('span', { text: `💗 粉丝 ${state.idol.fans}` }),
      ),
      gallery,
      h('button', { class: 'primary restart-btn', onclick: () => ctx.onRestart() }, '🔁 重新开始（完全重置）'),
    ),
  );
}
