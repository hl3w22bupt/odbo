#!/usr/bin/env node
/**
 * smoke-mobile —— 移动端模拟门禁（375×720 移动仿真，判例承 tools/smoke-live.mjs，零 npm 依赖 CDP）。
 * 用法：node tools/smoke-mobile.mjs [liveUrl]
 * 六类检查：network / console / first-screen / touch-pipeline / viewport / hotzone。
 * 产出：qa/mobile/report.json + qa/mobile/NN-<stage>.png；PASS 退出 0，FAIL 退出 1。
 */
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const QA = join(ROOT, 'qa', 'mobile');
const LIVE = (process.argv[2] || 'https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/').replace(/\/?$/, '/');
const VIEWPORT = { w: 375, h: 720 };
const say = (m) => console.log('[mobile] ' + m);
const die = (m) => { console.error('[mobile] DIE ' + m); try { ws && ws.close(); } catch {} process.exit(1); };

let ws = null, proc = null, userDir = null;
process.on('exit', () => {
  if (proc && proc.exitCode === null) { try { proc.kill('SIGKILL'); } catch {} }
  if (userDir) { try { rmSync(userDir, { recursive: true, force: true }); } catch {} }
});

// ---- chrome 启动 + page target（判例承 smoke-live.mjs）----
const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const chromeBin = CANDIDATES.find((c) => existsSync(c));
if (!chromeBin) die('chrome 未找到');
userDir = join('/tmp', `tn-mobile-${Date.now()}`);
proc = execFile(chromeBin, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${userDir}`, '--remote-debugging-port=0', 'about:blank',
], () => {});
let wsUrl = null;
const stderrChunks = [];
proc.stderr.on('data', (d) => stderrChunks.push(String(d)));
for (let i = 0; i < 20 && !wsUrl; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  const portFile = join(userDir, 'DevToolsActivePort');
  if (existsSync(portFile)) {
    const [p] = readFileSync(portFile, 'utf8').split('\n');
    wsUrl = `ws://127.0.0.1:${p}/devtools/browser`;
  } else {
    const m = /ws:\/\/[^\s]+/.exec(stderrChunks.join(''));
    if (m) wsUrl = m[0];
  }
}
if (!wsUrl) die('chrome DevTools 端口未就绪');
const httpPort = new URL(wsUrl).port;
let pageWs = null;
for (let i = 0; i < 20 && !pageWs; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const list = await fetch(`http://127.0.0.1:${httpPort}/json/list`).then((r) => r.json());
    const page = list.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) pageWs = page.webSocketDebuggerUrl;
  } catch { /* 重试 */ }
}
if (!pageWs) die('page target 未就绪');
say(`chromium 就绪 → ${LIVE}`);

ws = new WebSocket(pageWs);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const watchdog = setTimeout(() => {
  console.error('[mobile] DIE watchdog 300s\n' + consoleErrors.join('\n'));
  process.exit(1);
}, 300000);
watchdog.unref();
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const consoleWarnings = [];
const netResponses = [];
const netFailed = [];
const requestUrls = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') {
    const line = m.params.args?.map((a) => a.value || a.description || '').join(' ');
    if (m.params.type === 'error') consoleErrors.push(line);
    if (m.params.type === 'warning') consoleWarnings.push(line);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params?.exceptionDetails?.exception?.description || 'exceptionThrown');
  }
  if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    if (e.level === 'error') consoleErrors.push(`[log] ${e.text} ${e.url || ''}`);
    if (e.level === 'warning') consoleWarnings.push(`[log] ${e.text} ${e.url || ''}`);
  }
  if (m.method === 'Network.requestWillBeSent') requestUrls.set(m.params.requestId, m.params.request.url);
  if (m.method === 'Network.responseReceived') {
    const r = m.params.response;
    netResponses.push({ url: r.url, status: r.status, mime: r.mimeType, type: m.params.type });
  }
  if (m.method === 'Network.loadingFailed') {
    netFailed.push({ url: requestUrls.get(m.params.requestId) || `#${m.params.requestId}`, error: m.params.errorText, type: m.params.type });
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Log.enable');
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 截图 ----
mkdirSync(QA, { recursive: true });
let shotN = 0;
const screenshots = [];
async function shot(tag) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = r.result?.data;
  if (!data) die(`captureScreenshot 无数据：${JSON.stringify(r.error || r.result || {}).slice(0, 200)}`);
  const name = `${String(++shotN).padStart(2, '0')}-${tag}.png`;
  writeFileSync(join(QA, name), Buffer.from(data, 'base64'));
  screenshots.push(name);
  say(`  📸 qa/mobile/${name}`);
}

// ---- 触摸管线：CDP Input.dispatchTouchEvent（touchStart→touchEnd）----
async function tapAt(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(45);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
/** touch 点击 selector：scrollIntoView → 取 rect 中心与 elementFromPoint 命中 → tap。返回取证信息。 */
async function tapSelector(sel) {
  const lit = JSON.stringify(sel);
  const miss = await evalJs(`(() => { const el = document.querySelector(${lit});
    if (!el) return 'missing';
    el.scrollIntoView({ block: 'center', behavior: 'instant' }); return ''; })()`);
  if (miss) return { ok: false, reason: miss, sel };
  await sleep(90);
  const geo = JSON.parse(await evalJs(`(() => { const el = document.querySelector(${lit});
    if (!el) return '{"err":"missing"}';
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return JSON.stringify({ cx, cy, w: Math.round(r.width), h: Math.round(r.height),
      inVp: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0 && r.height > 0,
      hitOk: !!(hit && (hit === el || el.contains(hit))) }); })()`));
  if (geo.err) return { ok: false, reason: geo.err, sel };
  if (!geo.inVp || !geo.hitOk) return { ok: false, reason: !geo.inVp ? 'out-of-viewport' : 'covered-by-other', sel, geo };
  await tapAt(geo.cx, geo.cy);
  return { ok: true, sel, geo };
}
/** 依次尝试多个 selector，取第一个可点的（tapSelector 永远返回 truthy 对象，不能用 ||）。 */
async function tapAny(...sels) {
  let last = null;
  for (const sel of sels) {
    last = await tapSelector(sel);
    if (last.ok) return last;
  }
  return last || { ok: false, reason: 'no-candidate', sel: sels.join(',') };
}
const debug = async () => JSON.parse(await evalJs('JSON.stringify(window.__talentDebug())'));

// ---- 热区采样：当前屏可见可点按钮的 rect ----
const SAMPLE_BUTTONS = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('button')) {
    if (el.disabled) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
    out.push({ cls: el.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return JSON.stringify(out);
})()`;
const hotzoneSamples = [];
async function sampleHotzone(phaseLabel) {
  const btns = JSON.parse(await evalJs(SAMPLE_BUTTONS));
  hotzoneSamples.push({ phase: phaseLabel, count: btns.length, buttons: btns });
  return btns;
}

// =====================================================================
// 门禁执行
// =====================================================================
const checks = [];
const addCheck = (id, name, pass, detail) => {
  checks.push({ id, name, pass: !!pass, detail: String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'} [${id}] ${name} :: ${detail}`);
};

// 移动端竖屏仿真（375×720，mobile:true）
await send('Emulation.setDeviceMetricsOverride', {
  width: VIEWPORT.w, height: VIEWPORT.h, deviceScaleFactor: 2, mobile: true,
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: LIVE });
await sleep(2500);
let ready = false;
for (let i = 0; i < 40 && !ready; i += 1) { await sleep(250); ready = await evalJs('!!document.querySelector(".title-screen")'); }
if (!ready) die('线上开屏超时\n' + consoleErrors.join('\n'));

// ---- 检查 a：network —— 关键资产全 200，无 404 / 加载失败 ----
{
  const bad = [
    ...netResponses.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.url}`),
    ...netFailed.map((f) => `${f.error} ${f.url}`),
  ];
  const loaded = netResponses.map((r) => r.url);
  // 部署产物经网关以 assets/ 前缀伺服（build.mjs → landing.html + api/public/assets/*），按形态动态探测
  const assets = loaded.filter((u) => /\.(mjs|css|html)(\?|$)/.test(u));
  const htmlEntry = assets.filter((u) => u.endsWith('landing.html') || u.endsWith('index.html') || u.replace(/\/$/, '').length < u.length);
  const cssEntry = assets.filter((u) => u.endsWith('style.css'));
  const mainEntry = assets.filter((u) => /(^|\/)main\.mjs(\?|$)/.test(u));
  const sceneEntry = assets.filter((u) => /scenes\/[\w-]+\.mjs(\?|$)/.test(u));
  const gaps = [];
  if (!htmlEntry.length) gaps.push('html 入口(landing/index)');
  if (!cssEntry.length) gaps.push('style.css');
  if (!mainEntry.length) gaps.push('main.mjs');
  if (sceneEntry.length < 4) gaps.push(`scenes/*.mjs 仅 ${sceneEntry.length} 个（需 ≥4：ui/schedule-board/event-dialog/stage-live）`);
  const total = netResponses.length;
  const detail = `请求 ${total} 个（资产 ${assets.length}：html ${htmlEntry.length}、css ${cssEntry.length}、main.mjs ${mainEntry.length}、scenes ${sceneEntry.length}）、非 2xx/3xx 或加载失败 ${bad.length} 个${bad.length ? '：' + bad.slice(0, 6).join(' | ') : ''}${gaps.length ? `；缺失：${gaps.join('、')}` : '；关键资产齐备'}`;
  addCheck('network', '关键资产经 375×720 移动仿真加载全 200、无 404', bad.length === 0 && gaps.length === 0, detail);
}

// ---- 检查 c：first-screen —— 标题与开始按钮可见可点 ----
{
  const g = JSON.parse(await evalJs(`(() => {
    const t = document.querySelector('.game-title');
    const b = document.querySelector('.start-btn');
    if (!t || !b) return JSON.stringify({ err: !t ? 'game-title missing' : 'start-btn missing' });
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return JSON.stringify({ title: (t.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height),
      inVp: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      hitOk: !!(hit && (hit === b || b.contains(hit))), disabled: !!b.disabled }); })()`));
  if (g.err) { addCheck('first-screen', '首屏标题与开始按钮渲染且可点', false, g.err); }
  else {
    const ok = g.title.length > 0 && g.inVp && g.hitOk && !g.disabled;
    addCheck('first-screen', '首屏标题与开始按钮渲染且可点', ok,
      `标题「${g.title}」按钮 ${g.w}×${g.h}px 在视口内=${g.inVp} elementFromPoint 命中=${g.hitOk} disabled=${g.disabled}`);
  }
}
await sampleHotzone('title');
await shot('title');

// ---- 检查 d：touch-pipeline —— touch 点击「开始」按钮，状态推进 ----
const touchLog = [];
{
  const before = await debug();
  const tap = await tapSelector('.start-btn');
  await sleep(300);
  const after = await debug();
  const pass = tap.ok && before.phase === 'title' && after.phase === 'intro';
  touchLog.push({ step: 'start-btn', tapOk: tap.ok, geo: tap.geo, before: before.phase, after: after.phase });
  addCheck('touch-start', 'touch 管线点击「开始」按钮生效（title→intro）', pass,
    tap.ok ? `phase ${before.phase}→${after.phase} @ (${tap.geo.cx},${tap.geo.cy}) ${tap.geo.w}×${tap.geo.h}px`
           : `tap 失败：${tap.reason}`);
  await shot('intro');
}

// ---- 检查 f（采样）+ touch 进入序章事件 ----
{
  const tap = await tapSelector('.dialog button.primary');
  await sleep(300);
  const d = await debug();
  if (!tap.ok) die('touch 点击「开始第一周」失败：' + tap.reason);
  touchLog.push({ step: 'begin-prologue', tapOk: true, after: d.phase });
}

// ---- 检查 d（续）+ e：分支事件选项 touch 连点 3 次只生效一次 ----
{
  for (let i = 0; i < 30 && (await debug()).phase !== 'event'; i += 1) await sleep(200);
  const d0 = await debug();
  if (d0.phase !== 'event') die('未进入事件阶段：phase=' + d0.phase);
  await sampleHotzone('event');
  await shot('event-choose');
  // 视口检查：选项按钮完整在视口内
  const rects = JSON.parse(await evalJs(`(() => JSON.stringify([...document.querySelectorAll('.choice-btn:not([disabled])')].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      inVp: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; })))()`));
  const scrollW = Number(await evalJs('document.documentElement.scrollWidth'));
  const bodyScrollW = Number(await evalJs('document.body.scrollWidth'));
  const allIn = rects.length > 0 && rects.every((r) => r.inVp);
  addCheck('viewport', 'scrollWidth ≤375 且选项按钮完整在视口内', scrollW <= VIEWPORT.w && bodyScrollW <= VIEWPORT.w && allIn,
    `scrollWidth=${scrollW}/${bodyScrollW}（上限 ${VIEWPORT.w}）；选项 ${rects.length} 个，全部在视口内=${allIn}${rects[0] ? `；首个 ${rects[0].w}×${rects[0].h}px @(${rects[0].x},${rects[0].y})` : ''}`);

  // touch 连点 3 次：只应生效一次
  const idolBefore = JSON.stringify(d0.idol);
  const firedBefore = d0.fired.length;
  const sel = '.choice-btn:not([disabled])';
  const t1 = await tapSelector(sel);
  await sleep(220);
  await tapSelector(sel); await sleep(120);
  await tapSelector(sel); await sleep(220);
  const d1 = await debug();
  const resultBoxes = Number(await evalJs(`document.querySelectorAll('.event-result').length`));
  const chosenCount = Number(await evalJs(`document.querySelectorAll('.choice-btn.chosen').length`));
  const firedDelta = d1.fired.length - firedBefore;
  const idolUnchangedAfterLock = JSON.stringify(d1.idol) === idolBefore || firedDelta === 1;
  const pass = t1.ok && firedDelta === 1 && resultBoxes === 1 && chosenCount === 1 && idolUnchangedAfterLock;
  touchLog.push({ step: 'event-choice x3', tapOk: t1.ok, firedDelta, resultBoxes, chosenCount });
  addCheck('touch-event', '分支事件选项 touch 点击生效且连点 3 次只计 1 次', pass,
    `fired ${firedBefore}→${d1.fired.length}（+${firedDelta}）、效果徽标块 ${resultBoxes} 个、chosen ${chosenCount} 个${t1.ok ? ` @(${t1.geo.cx},${t1.geo.cy})` : `；tap 失败：${t1.reason}`}`);
  const c = await tapSelector('.continue-btn');
  if (!c.ok) die('touch 点击「继续」失败：' + c.reason);
  await sleep(250);
}

// ---- 检查 d（续）：教程训练 touch 生效（vocal 增长）----
{
  // 序章可能连发多个事件：逐个「选择→继续」直到进入周面板
  let weekSeen = false;
  for (let i = 0; i < 40 && !weekSeen; i += 1) {
    const d = await debug();
    if (d.phase === 'week') { weekSeen = true; break; }
    if (d.phase === 'event') {
      await tapAny('.choice-btn:not([disabled])');
      await sleep(160);
      await tapSelector('.continue-btn');
      await sleep(220);
      continue;
    }
    await sleep(200);
  }
  const d = await debug();
  if (d.phase !== 'week') die('未进入周面板：phase=' + d.phase);
  await sampleHotzone('week-board');
  await shot('week-board');
  const before = await debug();
  const t = await tapAny('.action-btn.guided', '.action-btn:not([disabled])');
  await sleep(260);
  const after = await debug();
  const trained = after.idol.vocal > before.idol.vocal || after.idol.dance > before.idol.dance
    || after.idol.stamina !== before.idol.stamina || after.actionsLeft < before.actionsLeft;
  touchLog.push({ step: 'tutorial-train', tapOk: !!t, trained });
  addCheck('touch-train', 'touch 点击训练按钮生效（状态推进）', !!t && trained,
    `vocal ${before.idol.vocal}→${after.idol.vocal}、actionsLeft ${before.actionsLeft}→${after.actionsLeft}`);
}

// ---- 全 touch 主循环推进至结局，沿途采样热区 ----
let stageVisits = 0;
for (let guard = 0; guard < 900; guard += 1) {
  const d = await debug();
  if (d.phase === 'ended') break;
  if (d.phase === 'event') {
    const t = await tapSelector('.choice-btn:not([disabled])');
    await sleep(160);
    await tapSelector('.continue-btn');
    await sleep(140);
    if (!t.ok) die('事件选项 touch 失败：' + t.reason);
    continue;
  }
  if (d.phase === 'week') {
    if (d.actionsLeft > 0) {
      const t = await tapAny('.action-btn.guided', '.action-btn:not([disabled])');
      if (!t.ok) die('行动按钮 touch 失败：' + t.reason);
      await sleep(120);
      continue;
    }
    const t = await tapSelector('.end-week');
    if (!t.ok) die('结束本周 touch 失败：' + t.reason);
    await sleep(150);
    continue;
  }
  if (d.phase === 'stage-confirm') {
    await sampleHotzone('stage-confirm');
    const t = await tapAny('.stage-actions .primary', '.stage-actions .ghost');
    if (!t.ok) die('舞台确认 touch 失败：' + t.reason);
    stageVisits += 1;
    await sleep(160);
    continue;
  }
  if (d.phase === 'stage-result') {
    if (screenshots.filter((s) => s.includes('stage-result')).length === 0) await shot('stage-result');
    const t = await tapAny('.stage-dialog .primary', '.dialog .primary');
    if (!t.ok) die('舞台结算 touch 失败：' + t.reason);
    await sleep(160);
    continue;
  }
  await sleep(150);
}
const fin = await debug();
addCheck('touch-pipeline', '全程 touch 管线推进至结局', fin.phase === 'ended' && !!fin.ending && fin.finalScore != null,
  `phase=${fin.phase} 结局=${fin.ending} 公演=${fin.finalScore}分 舞台 ${stageVisits} 场、touch 步骤 ${touchLog.length} 步全生效=${touchLog.every((s) => s.tapOk)}`);
await shot('ending');

// ---- 检查 f：hotzone —— 两两无重叠 + 高度 ≥40px ----
{
  const overlaps = [];
  const shortBtns = [];
  for (const s of hotzoneSamples) {
    for (let i = 0; i < s.buttons.length; i += 1) {
      const a = s.buttons[i];
      if (a.h < 40) shortBtns.push(`${s.phase}:${a.cls}(${a.h}px)`);
      for (let j = i + 1; j < s.buttons.length; j += 1) {
        const b = s.buttons[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1 && oy > 1) overlaps.push(`${s.phase}:[${a.cls}]×[${b.cls}] ${Math.round(ox)}×${Math.round(oy)}px`);
      }
    }
  }
  const sampled = hotzoneSamples.map((s) => `${s.phase}×${s.count}个`).join('、');
  const allH = hotzoneSamples.flatMap((s) => s.buttons.map((b) => b.h));
  const minH = allH.length ? Math.min(...allH) : 0;
  addCheck('hotzone', '可点按钮热区两两无重叠且高度 ≥40px', overlaps.length === 0 && shortBtns.length === 0,
    `采样 ${hotzoneSamples.length} 屏（${sampled}）；重叠 ${overlaps.length} 对${overlaps.length ? '：' + overlaps.slice(0, 4).join(' | ') : ''}；矮于 40px 的按钮 ${shortBtns.length} 个${shortBtns.length ? '：' + shortBtns.slice(0, 4).join(', ') : ''}；最矮 ${minH}px`);
}

// ---- 检查 b：console —— 全流程零 error，warning 计数 ----
{
  addCheck('console', '全流程 console 零 error', consoleErrors.length === 0,
    `error=${consoleErrors.length}${consoleErrors.length ? '：' + consoleErrors.slice(0, 3).join(' | ') : ''}；warning=${consoleWarnings.length}（仅计数不判失败）`);
}

// ---- report.json ----
const failed = checks.filter((c) => !c.pass);
const report = {
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
  target: { liveUrl: LIVE, gamePath: 'games/talent-nurture', viewport: `${VIEWPORT.w}x${VIEWPORT.h}` },
  emulation: { deviceMetrics: { width: VIEWPORT.w, height: VIEWPORT.h, deviceScaleFactor: 2, mobile: true }, touchEmulation: true },
  checks,
  screenshots,
  summary: {
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    touchSteps: touchLog.length, stageVisits, ending: fin.ending, finalScore: fin.finalScore,
  },
  console: { errors: consoleErrors.length, warnings: consoleWarnings.length, errorSamples: consoleErrors.slice(0, 10) },
  network: {
    totalResponses: netResponses.length,
    failures: [...netFailed, ...netResponses.filter((r) => r.status >= 400)].map((x) => `${x.status || x.error} ${x.url}`),
    assets: [...new Set(netResponses.filter((r) => /\.(mjs|css|html)(\?|$)/.test(r.url)).map((r) => `${r.status} ${r.url}`))],
  },
  hotzone: { samples: hotzoneSamples.map((s) => ({ phase: s.phase, count: s.count })) },
  touchLog,
  failures: failed.map((c) => ({ id: c.id, name: c.name, detail: c.detail })),
};
writeFileSync(join(QA, 'report.json'), JSON.stringify(report, null, 2) + '\n');
say(`report.json 已写入 qa/mobile/report.json（verdict=${report.verdict}，${report.summary.passed}/${report.summary.total} 项通过）`);
try { ws.close(); } catch {}
clearTimeout(watchdog);
process.exit(report.verdict === 'PASS' ? 0 : 1);
