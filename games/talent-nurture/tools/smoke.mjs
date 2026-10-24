#!/usr/bin/env node
/**
 * smoke —— 浏览器冒烟（判例承 wheat-squad tools/smoke.mjs，零 npm 依赖 CDP 直连系统 Chrome）。
 * 按部署形态伺服：/ → landing.html，模块/样式走 /api/public/assets/*（与线上壳同构）。
 * 断言链：开屏 → 序章教程 → 分支事件（连点幂等）→ 12 周全自动通关 → 结局 → 重开零残留 → 调参桥。
 * 前置：node tools/build.mjs
 */
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const WEB = join(ROOT, 'export', 'web');
const say = (m) => console.log('[smoke] ' + m);
const die = (m) => { console.error('[smoke] DIE ' + m); process.exit(1); };

let proc = null, server = null, userDir = null;
process.on('exit', () => {
  if (proc && proc.exitCode === null) { try { proc.kill('SIGKILL'); } catch {} }
  try { server?.close(); } catch {}
  if (userDir) { try { rmSync(userDir, { recursive: true, force: true }); } catch {} }
});

if (!existsSync(join(WEB, 'landing.html'))) die('export/web 缺位——先 node tools/build.mjs');

const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css' };
server = createServer((req, res) => {
  let url = (req.url || '/').split('?')[0];
  // 模拟网关两种入口形态：/（根）与 /apps/talent-nurture（无尾斜杠子路径）
  url = url.replace(/^\/apps\/talent-nurture/, '') || '/';
  const rel = url === '/' ? 'landing.html' : url.replace(/^\/api\/public\/assets\//, '');
  const p = join(WEB, rel);
  if (!p.startsWith(WEB) || !existsSync(p)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'text/plain; charset=utf-8' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
say(`静态服务 http://127.0.0.1:${port}/（部署形态载面）`);

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const chromeBin = CANDIDATES.find((c) => existsSync(c));
if (!chromeBin) die('chrome 未找到');
userDir = join('/tmp', `tn-smoke-${Date.now()}`);
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
say('chromium 就绪（CDP page target）');

const ws = new WebSocket(pageWs);
// 看门狗：任何 await 挂死（页面崩溃 / CDP 无响应）都强杀并留诊断
setTimeout(() => {
  console.error('[smoke] DIE watchdog: 180s 未完成——疑似挂死\n' + consoleErrors.join('\n'));
  process.exit(1);
}, 180000).unref();
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
    consoleErrors.push(m.params.args?.map((a) => a.value || a.description || '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params?.exceptionDetails?.exception?.description || 'exceptionThrown');
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = async (url) => { await send('Page.navigate', { url }); await sleep(1200); };

// ---- ① 开屏 + 壳契约（无尾斜杠子路径入口，与网关 /apps/talent-nurture 同构）----
await nav(`http://127.0.0.1:${port}/apps/talent-nurture`);
let ready = false;
for (let i = 0; i < 40 && !ready; i += 1) { await sleep(250); ready = await evalJs('!!document.querySelector(".title-screen")'); }
if (!ready) die('开屏超时\n' + consoleErrors.join('\n'));
const shell = await evalJs(`JSON.stringify({ audio: typeof window.__audioDebug === 'function', tuningBridge: true })`);
if (!JSON.parse(shell).audio) die('壳契约缺失 __audioDebug');
say('开屏 ✓ title-screen + __audioDebug 壳契约在位');

// ---- ② 开始 → 序章 → 事件（连点幂等）→ 教程 ----
await evalJs(`document.querySelector('.start-btn').click()`); await sleep(200);
await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('开始第一周')); b&&b.click(); })()`); await sleep(200);
// 序章两个事件：对第一个选项做「狂点 3 次」——效果必须只生效一次（AC③）
for (let round = 0; round < 2; round++) {
  const before = await evalJs(`JSON.stringify(window.__talentDebug ? window.__talentDebug().idol : null)`);
  for (let k = 0; k < 3; k++) { await evalJs(`(() => { const b=document.querySelector('.choice-btn:not([disabled])'); b&&b.click(); })()`); await sleep(60); }
  const after = await evalJs(`JSON.stringify(window.__talentDebug ? window.__talentDebug().idol : null)`);
  const cnt = await evalJs(`window.__talentDebug().fired.length`);
  if (Number(cnt) !== round + 1) die(`事件连点幂等破坏：fired=${cnt}`);
  await evalJs(`(() => { const b=document.querySelector('.continue-btn'); b&&b.click(); })()`); await sleep(150);
}
say('序章事件 ✓ 连点 3 次只生效一次（AC③ 幂等）');

// 教程：按引导点 3 个动作
for (let i = 0; i < 3; i++) {
  await evalJs(`(() => { const b=document.querySelector('.action-btn.guided') || document.querySelector('.action-btn:not([disabled])'); b&&b.click(); })()`);
  await sleep(120);
}
const tutVocal = await evalJs(`window.__talentDebug().idol.vocal`);
if (Number(tutVocal) <= 10) die('教程训练未生效（vocal 未增长）');
say(`教程 ✓ 三步引导完成（vocal=${tutVocal}）`);

// ---- ③ 全自动通关 12 周（真实 UI 点击路径）----
// click 只认「可点且点了真生效」：disabled 按钮的 .click() 是静默 no-op，必须视作未点
const click = async (sel) => evalJs(`(() => { const b=document.querySelector(${JSON.stringify(sel)}); if(b && !b.disabled){b.click(); return true;} return false; })()`);
let stageVisits = 0;
let lastSig = '';
for (let guard = 0; guard < 600; guard += 1) {
  const phase = await evalJs(`window.__talentDebug().phase`);
  if (phase === 'ended') break;
  const sig = `${phase}:${await evalJs(`window.__talentDebug().week`)}:${await evalJs(`window.__talentDebug().actionsLeft`)}`;
  if (guard % 25 === 0) say(`  …[g${guard}] ${sig}`);
  if (sig === lastSig && guard % 25 === 24) say(`  ⚠ 可能停滞: ${sig}`);
  lastSig = sig;
  if (phase === 'event') {
    if (await click('.choice-btn:not([disabled])')) { await sleep(60); await click('.continue-btn'); await sleep(80); continue; }
    await click('.continue-btn'); await sleep(80); continue;
  }
  if (phase === 'week') {
    const left = await evalJs(`window.__talentDebug().actionsLeft`);
    const idol = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug().idol)`));
    if (left > 0) {
      const done = idol.stamina < 45
        ? await click('.action-btn:nth-of-type(3)')  // 休息
        : await click('.action-btn:nth-of-type(1)'); // 唱功特训
      if (!done) { // 教程期间非引导键被禁用 → 点引导键
        await click('.action-btn.guided');
      }
      await sleep(80);
      continue;
    }
    await click('.end-week'); await sleep(100);
    continue;
  }
  if (phase === 'stage-confirm') {
    const performed = await click('.stage-actions .primary');
    if (!performed) await click('.stage-actions .ghost'); // 体力不足 → 弃权
    stageVisits += 1;
    await sleep(120);
    continue;
  }
  if (phase === 'stage-result') { await click('.stage-dialog .primary'); await sleep(120); continue; }
  await sleep(120);
}
const fin = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug())`));
if (fin.phase !== 'ended') die(`通关流程未到结局：phase=${fin.phase} week=${fin.week}\n` + consoleErrors.join('\n'));
if (!fin.ending) die('结局未判定');
if (fin.finalScore == null) die(`公演得分未记录（finalScore=null——第 12 周舞台未跑或周计划错位）`);
if (stageVisits !== 8) die(`舞台场次异常：${stageVisits}（期望 8：试镜+内部考核+首秀+三对决+答谢祭+公演）`);
say(`通关 ✓ 12 周走完，结局=${fin.ending} 公演=${fin.finalScore}分 vocal=${fin.idol.vocal} dance=${fin.idol.dance} fans=${fin.idol.fans}（舞台 ${stageVisits} 场）`);

// ---- ④ 重开零残留（AC②）----
await click('.restart-btn'); await sleep(300);
await click('.start-btn'); await sleep(200);
const reborn = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug())`));
if (reborn.week !== 0 || reborn.idol.vocal !== 10 || reborn.idol.stamina !== 100) {
  die(`重开有残留：week=${reborn.week} vocal=${reborn.idol.vocal} stamina=${reborn.idol.stamina}`);
}
if (reborn.fired.length !== 0) die(`重开后 firedEvents 残留：${reborn.fired.length}`);
say('重开 ✓ 全状态归零（week=0, vocal=10, stamina=100, fired=0）');

// ---- ⑤ 调参桥（§3C）：?tuning 覆盖 numeric 并按 meta 钳制 ----
await nav(`http://127.0.0.1:${port}/?tuning=${encodeURIComponent('{"gainBase":999,"passThreshold":88}')}`);
await sleep(600);
const tuned = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug().tuning)`));
if (tuned.gainBase !== 12) die(`调参钳制失效：gainBase=${tuned.gainBase}（期望钳到 max 12）`);
if (tuned.passThreshold !== 88) die(`调参未生效：passThreshold=${tuned.passThreshold}`);
say(`调参桥 ✓ gainBase 999→钳到 12，passThreshold=88 生效`);

// ---- ⑥ console 零错误 ----
if (consoleErrors.length) die(`console 有错误：\n${consoleErrors.join('\n')}`);
say('console ✓ 零错误');
say('SMOKE: PASS');
try { ws.close(); } catch {}
process.exit(0);
