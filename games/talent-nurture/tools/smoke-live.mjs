#!/usr/bin/env node
/**
 * smoke-live —— 线上冒烟 + 截帧取证（判例承 tools/smoke.mjs，零 npm 依赖 CDP）。
 * 用法：node tools/smoke-live.mjs [liveUrl]
 * 对公网入口（网关子路径 /apps/talent-nurture）跑与本地同口径的断言链，并落屏证据到 qa/live/。
 */
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const QA = join(ROOT, 'qa', 'live');
const LIVE = (process.argv[2] || 'https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/').replace(/\/?$/, '/');
const say = (m) => console.log('[live] ' + m);
const die = (m) => { console.error('[live] DIE ' + m); process.exit(1); };

let proc = null, userDir = null;
process.on('exit', () => {
  if (proc && proc.exitCode === null) { try { proc.kill('SIGKILL'); } catch {} }
  if (userDir) { try { rmSync(userDir, { recursive: true, force: true }); } catch {} }
});

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const chromeBin = CANDIDATES.find((c) => existsSync(c));
if (!chromeBin) die('chrome 未找到');
userDir = join('/tmp', `tn-live-${Date.now()}`);
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

const ws = new WebSocket(pageWs);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
setTimeout(() => { console.error('[live] DIE watchdog 240s\n' + consoleErrors.join('\n')); process.exit(1); }, 240000).unref();
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
mkdirSync(QA, { recursive: true });
let shotN = 0;
async function shot(tag) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = r.result?.data;
  if (!data) die(`captureScreenshot 无数据：${JSON.stringify(r.error || r.result || {}).slice(0, 200)}`);
  const file = join(QA, `${String(++shotN).padStart(2, '0')}-${tag}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  say(`  📸 ${file}`);
}

// 移动端竖屏视口（AC⑤/AC⑥ 仿真口径）
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: LIVE });
await sleep(2500);
let ready = false;
for (let i = 0; i < 40 && !ready; i += 1) { await sleep(250); ready = await evalJs('!!document.querySelector(".title-screen")'); }
if (!ready) die('线上开屏超时\n' + consoleErrors.join('\n'));
const audio = await evalJs('window.__audioDebug ? JSON.stringify(window.__audioDebug()) : "MISSING"');
if (audio === 'MISSING') die('__audioDebug 壳契约缺失');
say(`开屏 ✓ 壳契约 __audioDebug=${audio}`);
await shot('01-title-375w');

await evalJs(`document.querySelector('.start-btn').click()`); await sleep(250);
await shot('02-intro');
await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('开始第一周')); b&&b.click(); })()`); await sleep(250);
for (let round = 0; round < 2; round++) {
  for (let k = 0; k < 3; k++) { await evalJs(`(() => { const b=document.querySelector('.choice-btn:not([disabled])'); b&&b.click(); })()`); await sleep(60); }
  const cnt = await evalJs(`window.__talentDebug().fired.length`);
  if (Number(cnt) !== round + 1) die(`线上连点幂等破坏：fired=${cnt}`);
  if (round === 0) await shot('03-event-choose');
  await evalJs(`(() => { const b=document.querySelector('.continue-btn'); b&&b.click(); })()`); await sleep(180);
}
say('序章事件 ✓ 连点 3 次只生效一次');
for (let i = 0; i < 3; i++) {
  await evalJs(`(() => { const b=document.querySelector('.action-btn.guided') || document.querySelector('.action-btn:not([disabled])'); b&&b.click(); })()`);
  await sleep(140);
}
const tutVocal = await evalJs(`window.__talentDebug().idol.vocal`);
if (Number(tutVocal) <= 10) die('教程训练未生效');
await shot('04-week-board-375w');
say(`教程 ✓（vocal=${tutVocal}）`);

const click = async (sel) => evalJs(`(() => { const b=document.querySelector(${JSON.stringify(sel)}); if(b && !b.disabled){b.click(); return true;} return false; })()`);
let stageVisits = 0;
let eventShot = false, stageShot = false;
for (let guard = 0; guard < 600; guard += 1) {
  const phase = await evalJs(`window.__talentDebug().phase`);
  if (phase === 'ended') break;
  if (phase === 'event') {
    if (await click('.choice-btn:not([disabled])')) {
      await sleep(70);
      if (!eventShot) { await shot('05-event-midgame'); eventShot = true; }
      await click('.continue-btn'); await sleep(90); continue;
    }
    await click('.continue-btn'); await sleep(90); continue;
  }
  if (phase === 'week') {
    const left = await evalJs(`window.__talentDebug().actionsLeft`);
    const idol = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug().idol)`));
    if (left > 0) {
      const done = idol.stamina < 45 ? await click('.action-btn:nth-of-type(3)') : await click('.action-btn:nth-of-type(1)');
      if (!done) await click('.action-btn.guided');
      await sleep(85);
      continue;
    }
    await click('.end-week'); await sleep(110);
    continue;
  }
  if (phase === 'stage-confirm') {
    const performed = await click('.stage-actions .primary');
    if (!performed) await click('.stage-actions .ghost');
    stageVisits += 1;
    await sleep(130);
    continue;
  }
  if (phase === 'stage-result') {
    if (!stageShot) { await shot('06-stage-result'); stageShot = true; }
    await click('.stage-dialog .primary'); await sleep(130); continue;
  }
  await sleep(130);
}
const fin = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug())`));
if (fin.phase !== 'ended') die(`线上通关未到结局：phase=${fin.phase} week=${fin.week}\n` + consoleErrors.join('\n'));
if (!fin.ending || fin.finalScore == null) die(`结局/公演缺失：${fin.ending} / ${fin.finalScore}`);
if (stageVisits !== 8) die(`舞台场次异常：${stageVisits}（期望 8）`);
await shot('07-ending');
say(`通关 ✓ 结局=${fin.ending} 公演=${fin.finalScore}分 vocal=${fin.idol.vocal} fans=${fin.idol.fans}（舞台 ${stageVisits} 场）`);

await click('.restart-btn'); await sleep(350);
await click('.start-btn'); await sleep(250);
const reborn = JSON.parse(await evalJs(`JSON.stringify(window.__talentDebug())`));
if (reborn.week !== 0 || reborn.idol.vocal !== 10 || reborn.idol.stamina !== 100 || reborn.fired.length !== 0) {
  die(`线上重开有残留：${JSON.stringify(reborn).slice(0, 200)}`);
}
say('重开 ✓ 零残留');

if (consoleErrors.length) die(`线上 console 有错误：\n${consoleErrors.join('\n')}`);
say('console ✓ 零错误');
say('LIVE SMOKE: PASS');
try { ws.close(); } catch {}
process.exit(0);
