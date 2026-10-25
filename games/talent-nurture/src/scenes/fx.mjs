/**
 * fx —— 视觉动效库（v+1 策划案 cmvn6pmb3007im9gbv4xelwj2：纯 CSS/JS 代码资产，零图片零视频）。
 * 门禁红线（tools/smoke.mjs + smoke-mobile.mjs）：
 *  - 所有覆盖层 pointer-events:none（elementFromPoint 命中判定不能被装饰层拦截）；
 *  - fx 层 overflow:hidden（scrollWidth ≤375 不破版）；
 *  - 交互按钮不做持续型 transform 动画（rect 读取与 tap 之间不能漂移）；
 *  - 本模块顶层不得访问 document（契约测试在 Node 下级联 import main.mjs → scenes）。
 * 性能（v+1 约束）：动画全部走 CSS transform/opacity（合成器路径，移动端 60fps、无 >50ms 长任务）；
 * prefers-reduced-motion 时全部直切（CSS 兜底 + JS countUp 跳末值）。
 */

/** 用户偏好减弱动效（惰性取用，避免顶层碰 window） */
function reducedMotion() {
  try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (e) { return false; }
}

/** 在 parent 内挂一个装饰层（absolute + pointer-events:none + overflow:hidden）；返回该层元素。 */
export function mountFxLayer(parent, cls = '') {
  const layer = document.createElement('div');
  layer.className = `fx-layer${cls ? ' ' + cls : ''}`;
  const st = parent.style;
  if (!st.position || st.position === 'static') st.position = 'relative';
  parent.appendChild(layer);
  return layer;
}

// ---- 舞台灯光（v+1：单束追光 → 三束扫光 → VS 对打灯 → 答谢祭灯海 → 公演演出链）----
/** 由 stage 配置推导灯光方案 */
function stageMood(stage) {
  if (!stage) return 'sweep';
  if (stage.isFinale) return 'finale';
  const key = String(stage.stage || '');
  if (key.startsWith('rival-battle')) return 'vs';
  if (stage.fansGainMultiplier) return 'sea';
  if (key === 'internal-check') return 'spot';
  return 'sweep';
}

/**
 * 舞台场景视觉：dialog 内挂灯束/粒子池（全 CSS 动画，自清理由 dialog 重建兜底）。
 * stage: 关卡 stage 配置（{ stage, isFinale, fansGainMultiplier, ... }）
 */
export function stageFx(dialog, stage) {
  const mood = stageMood(stage);
  const layer = mountFxLayer(dialog, `stage-fx mood-${mood}`);
  const beams = mood === 'spot' ? 1 : mood === 'vs' ? 2 : 3;
  for (let i = 0; i < beams; i += 1) {
    const b = document.createElement('i');
    b.className = beams === 1 ? 'fx-beam solo' : 'fx-beam';
    layer.appendChild(b);
  }
  if (mood === 'vs') layer.appendChild(Object.assign(document.createElement('i'), { className: 'fx-vs' }));
  if (mood === 'sea' || mood === 'finale') {
    // 灯海/公演：闪烁光点池（答谢祭 160 上限 → 层内按密度折算，纯 CSS 闪烁，零 rAF）
    const dots = mood === 'sea' ? 56 : 40;
    for (let i = 0; i < dots; i += 1) {
      const d = document.createElement('i');
      d.className = 'fx-dot';
      d.style.left = `${(i * 37 + mood.length * 11) % 100}%`;
      d.style.top = `${(i * 53 + 17) % 92}%`;
      d.style.animationDelay = `${(i % 9) * 0.23}s`;
      d.style.animationDuration = `${1.6 + (i % 5) * 0.4}s`;
      layer.appendChild(d);
    }
  }
  return layer;
}

// ---- 粒子（彩带/灰烬）：一次性 CSS 动画，计数封顶，动画结束自移除 ----
const PARTICLE_CAP = 80; // v+1 粒子池上限（答谢祭灯海走 fx-dot，不计入）
export function burstParticles(container, n, tone = 'confetti') {
  if (reducedMotion()) return;
  const layer = mountFxLayer(container, `fx-burst tone-${tone}`);
  const count = Math.max(0, Math.min(PARTICLE_CAP, n));
  const COLORS = tone === 'confetti'
    ? ['#ffd166', '#ff7eb6', '#7ee8a2', '#7ee8ff', '#b388ff']
    : ['#8a829e', '#6f6883', '#a49bbb'];
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('i');
    p.className = 'fx-particle';
    p.style.left = `${8 + ((i * 29) % 84)}%`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty('--dx', `${(((i * 17) % 40) - 20)}px`);
    p.style.setProperty('--rot', `${((i * 53) % 360) - 180}deg`);
    p.style.animationDuration = `${0.9 + ((i * 7) % 10) * 0.12}s`;
    p.style.animationDelay = `${((i * 3) % 8) * 0.05}s`;
    p.addEventListener('animationend', () => p.remove(), { once: true });
    layer.appendChild(p);
  }
  setTimeout(() => layer.remove(), 2600);
}

// ---- 评分滚动（v+1：1.4s 四档分色滚动；reduced-motion 直切末值）----
export function countUp(el, to, { dur = 1400, suffix = '' } = {}) {
  const target = Number(to);
  if (!el || !Number.isFinite(target)) return;
  if (reducedMotion()) { el.textContent = `${target}${suffix}`; return; }
  const t0 = performance.now();
  const step = (now) => {
    if (!el.isConnected) return; // 场景已切换：立即停止，不悬挂 rAF
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - (1 - k) * (1 - k) * (1 - k); // easeOutCubic
    el.textContent = `${Math.round(target * eased)}${suffix}`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---- 浮字（v+1 uiMotion：浮字 900ms）----
export function floatText(container, text, cls = '') {
  if (!container || reducedMotion()) return;
  const f = document.createElement('span');
  f.className = `fx-float ${cls}`;
  f.textContent = text;
  f.style.left = '50%';
  container.appendChild(f);
  f.addEventListener('animationend', () => f.remove(), { once: true });
  setTimeout(() => { if (f.isConnected) f.remove(); }, 1200);
}

// ---- 幕布过场（v+1：全部分支事件统一 420ms 幕布；pointer-events:none 不拦输入）----
let curtainsAlive = 0;
export function curtain(root) {
  if (!root || reducedMotion() || curtainsAlive >= 2) return;
  curtainsAlive += 1;
  const c = document.createElement('div');
  c.className = 'fx-curtain';
  c.append(
    Object.assign(document.createElement('i'), { className: 'curtain-left' }),
    Object.assign(document.createElement('i'), { className: 'curtain-right' }),
  );
  root.appendChild(c);
  setTimeout(() => {
    c.remove();
    curtainsAlive -= 1;
  }, 520);
}

// ---- 序章程序化开场（v+1：黑边 + 胶片颗粒 + 缓推 + 透黑淡入；≤12s，任意触摸跳过，零视频）----
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
export function introCinematic(root) {
  if (!root || reducedMotion()) return;
  const target = root.querySelector('.dialog');
  if (target) target.classList.add('cine-push'); // 缓推（1.1s，ease-out 前载，门禁 tap 时机 ≥500ms 已基本归位）

  const cine = document.createElement('div');
  cine.className = 'fx-cine';
  cine.innerHTML = `<i class="cine-bar top"></i><i class="cine-bar bottom"></i><i class="cine-grain"></i><i class="cine-black"></i>`;
  cine.querySelector('.cine-grain').style.backgroundImage = GRAIN_SVG;
  root.appendChild(cine);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cine.remove();
    document.removeEventListener('pointerdown', finish, true);
    document.removeEventListener('touchstart', finish, true);
    document.removeEventListener('keydown', finish, true);
  };
  // 任意触摸/按键跳过（capture + passive，不消费事件，门禁触摸直落底层按钮）
  document.addEventListener('pointerdown', finish, { capture: true, passive: true });
  document.addEventListener('touchstart', finish, { capture: true, passive: true });
  document.addEventListener('keydown', finish, { capture: true, passive: true });
  // 总时长 2.6s（≤12s 预算内取短值，减少门禁时序耦合）
  setTimeout(finish, 2600);
}
