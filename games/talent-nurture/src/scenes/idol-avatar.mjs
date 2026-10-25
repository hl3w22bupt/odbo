/**
 * idol-avatar —— 人物六态动画状态机（v+1 策划案 sys-anim-state-machine）。
 * 六态：idle 待机呼吸(2.4s·起伏3px) / sing 演唱(节拍同步) / dance 舞蹈(480ms循环) /
 *       train 训练(800ms+汗滴) / celebrate 庆祝(跳起10px) / dejected 失落(低头12°)。
 * 切换交叉淡入 ≤200ms（双层 glyph 交替，CSS transition）。只做表现层，不碰数值结算。
 * 约束：交互按钮不做持续 transform；本模块顶层不碰 document（Node 契约测试级联 import）。
 */

const POSE_META = {
  idle: { glyph: '🧑‍🎤', fx: '' },
  sing: { glyph: '🎤', fx: '♪' },
  dance: { glyph: '🕺', fx: '✦' },
  train: { glyph: '💪', fx: '💧', sweat: true },
  celebrate: { glyph: '🎉', fx: '✨' },
  dejected: { glyph: '😞', fx: '' },
};

// 模块级当前姿态（场景重渲染时读取，瞬态姿态跨 render 保持）
let basePose = 'idle';
let transient = null; // { pose, until }
let activeEl = null;
let flipTimer = null;

export function currentPose() {
  if (transient && Date.now() < transient.until) return transient.pose;
  transient = null;
  return basePose;
}

/** 双层 glyph 交叉淡入（≤200ms）：写隐藏层文本 → 翻转透明度 */
function applyPose(el, pose) {
  const meta = POSE_META[pose] || POSE_META.idle;
  if (!el) return;
  // 重建类名时保留 compact 等标记位（dataset 承载，避免被姿态类覆盖）
  const keep = el.dataset.compact === '1' ? ' compact' : '';
  el.className = `idol-avatar pose-${pose}${keep}`;
  el.classList.toggle('ava-sweaty', !!meta.sweat);
  const a = el.querySelector('.ava-a');
  const b = el.querySelector('.ava-b');
  if (!a || !b) return;
  const showB = el.dataset.showB === '1';
  const show = showB ? b : a;
  const hide = showB ? a : b;
  hide.textContent = meta.glyph;
  el.dataset.showB = showB ? '0' : '1';
  show.classList.add('ava-hidden');
  hide.classList.remove('ava-hidden');
  el.querySelector('.ava-fx').textContent = meta.fx;
}

/**
 * 渲染人物头像（返回 DOM 元素；pose 缺省用 currentPose()）。
 * 重复 import 的场景各自挂载互不影响；同一时刻只有最新元素接收瞬态回切。
 */
export function renderIdolAvatar({ pose, name = '小星', compact = false } = {}) {
  const el = document.createElement('div');
  el.className = 'idol-avatar';
  el.innerHTML = `
    <div class="ava-frame">
      <span class="ava-glyph ava-a"></span>
      <span class="ava-glyph ava-b ava-hidden"></span>
      <span class="ava-fx" aria-hidden="true"></span>
      <span class="ava-sweat" aria-hidden="true">💧</span>
    </div>
    <span class="ava-name"></span>`;
  el.querySelector('.ava-name').textContent = name;
  if (compact) el.dataset.compact = '1';
  activeEl = el;
  applyPose(el, pose || currentPose());
  return el;
}

/** 直接翻转已挂载元素的姿态类（交叉淡入由 applyPose 处理） */
function flipTo(el, pose) {
  if (el && el.isConnected) applyPose(el, pose);
}

/** 瞬态姿态：ms 后自动回 basePose（跨 render 有效；元素被重建时由 render 读取状态兜底） */
export function flashPose(pose, ms = 900, base) {
  if (base) basePose = base;
  transient = { pose, until: Date.now() + ms };
  const el = activeEl;
  if (flipTimer) clearTimeout(flipTimer);
  flipTo(el, pose);
  flipTimer = setTimeout(() => {
    transient = null;
    flipTo(activeEl, basePose);
  }, ms);
}
