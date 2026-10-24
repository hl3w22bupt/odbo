/**
 * ui —— DOM 场景共享助手（零依赖）。
 */

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v == null) continue; // null/undefined = 不设置该属性（如 disabled:null 必须可点）
    else node.setAttribute(k, v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** 数值变动徽标：+8 唱功（绿）/ -18 体力（红） */
export function deltaBadge(delta) {
  const wrap = h('span', { class: 'deltas' });
  const NAMES = { vocal: '唱功', dance: '舞技', stamina: '体力', mood: '心情', stress: '压力', fans: '粉丝', mentorVocalAffinity: '林澜好感', mentorDanceAffinity: 'K哥好感', nextStageScoreBuff: '舞台增益' };
  for (const [k, v] of Object.entries(delta || {})) {
    if (!v) continue;
    const sign = v > 0 ? '+' : '';
    wrap.append(h('span', { class: `delta ${v > 0 ? 'up' : 'down'}`, text: `${sign}${v} ${NAMES[k] || k}` }));
  }
  return wrap;
}

/** 六维 + 粉丝的状态条 */
export function statRow(idol) {
  const bar = (label, value, max, cls) =>
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label', text: label }),
      h('div', { class: 'stat-track' }, h('div', { class: `stat-fill ${cls}`, style: `width:${Math.max(0, Math.min(100, (value / max) * 100))}%` })),
      h('span', { class: 'stat-value', text: String(Math.round(value)) }),
    );
  return h('div', { class: 'stats' },
    h('div', { class: 'stat-pair' },
      bar(`🎤 唱功 ${rankText(idol.vocal)}`, idol.vocal, 100, 'vocal'),
      bar(`🕺 舞技 ${rankText(idol.dance)}`, idol.dance, 100, 'dance'),
    ),
    bar('体力', idol.stamina, 100, 'stamina'),
    bar('心情', idol.mood, 100, 'mood'),
    bar('压力', idol.stress, 100, 'stress'),
    h('div', { class: 'fans', text: `💗 粉丝 ${idol.fans}` }),
  );
}

function rankText(v) {
  const ranks = [[85, 'S'], [65, 'A'], [45, 'B'], [25, 'C'], [0, 'D']];
  for (const [min, r] of ranks) if (v >= min) return r;
  return 'D';
}
