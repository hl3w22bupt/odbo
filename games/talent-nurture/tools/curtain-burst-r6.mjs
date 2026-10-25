#!/usr/bin/env node
/**
 * curtain-burst-r6 —— 终局使用验收：分支事件幕布过场「帧采样」独立取证。
 *
 * 与 smoke-mobile.mjs curtain 断言（MutationObserver+rAF 轮询的仪器口径）互补：
 * 这里用「连发截帧」取证幕布的**视觉真实存在**——帧序列里暗幕从全遮盖→中开→消失，
 * 证明肉眼可感知、跨多帧存活≥200ms、非同帧闪没。只记录帧与探针值，判定阈值独立于此脚本。
 *
 * 用法：node tools/curtain-burst-r6.mjs [liveUrl] [--runs 2] [--out qa/acceptance/curtain-final-r6]
 * 产出：<out>/run-<NN>/NNN-frame.png + <out>/run-<NN>/burst.json
 * 退出码：0=取证完成（是否达标由 consumption 方比对阈值）；2=环境不可用；1=流程中断。
 */
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const flag = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const LIVE = (process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : 'https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/').replace(/\/?$/, '/');
const RUNS = Number(flag('runs', '2'));
const OUT = join(ROOT, flag('out', 'qa/acceptance/curtain-final-r6'));
const say = (m) => console.log('[burst-r6] ' + m);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- chrome 启动（判例承 tools/smoke-mobile.mjs）----
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
if (!chromeBin) { console.error('[burst-r6] chrome 未找到'); process.exit(2); }
userDir = join('/tmp', `tn-burst-${Date.now()}`);
proc = execFile(chromeBin, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${userDir}`, '--remote-debugging-port=0', 'about:blank',
], () => {});
let wsUrl = null;
const stderrChunks = [];
proc.stderr.on('data', (d) => stderrChunks.push(String(d)));
for (let i = 0; i < 40 && !wsUrl; i += 1) {
  await sleep(250);
  const portFile = join(userDir, 'DevToolsActivePort');
  if (existsSync(portFile)) {
    const [p] = readFileSync(portFile, 'utf8').split('\n'); // 文件可能先创建后写内容：必须校验端口是数字
    if (/^\d+$/.test(p || '')) wsUrl = `ws://127.0.0.1:${p}/devtools/browser`;
  }
  if (!wsUrl) { const m = /ws:\/\/[^\s]+/.exec(stderrChunks.join('')); if (m) wsUrl = m[0]; }
}
if (!wsUrl) { console.error('[burst-r6] DevTools 端口未就绪'); process.exit(2); }
const httpPort = new URL(wsUrl).port;
let pageWs = null;
for (let i = 0; i < 20 && !pageWs; i += 1) {
  await sleep(250);
  try {
    const list = await fetch(`http://127.0.0.1:${httpPort}/json/list`).then((r) => r.json());
    const page = list.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) pageWs = page.webSocketDebuggerUrl;
  } catch { /* retry */ }
}
if (!pageWs) { console.error('[burst-r6] page target 未就绪'); process.exit(2); }

const ws = new WebSocket(pageWs);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args?.map((a) => a.value || a.description || '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params?.exceptionDetails?.exception?.description || 'exceptionThrown');
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') consoleErrors.push(`[log] ${m.params.entry.text}`);
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('page eval: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result?.result?.value;
};

// ---- 移动仿真三连（375×720 @2x + touch）----
await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

/** 真实触摸管线点击（禁止 JS 直调 onclick） */
async function tapAt(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(45);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// 逐帧探针：幕布存在性 + 两片幕布对视口的净覆盖率 + 页内单调时钟 + 玩法相位
const PROBE = `(() => {
  const c = document.querySelector('.fx-curtain');
  const d = (window.__talentDebug && window.__talentDebug()) || null;
  let cov = 0, halves = null;
  if (c && c.isConnected) {
    const vw = innerWidth;
    const ps = [...c.children].map((h) => {
      const r = h.getBoundingClientRect();
      return Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    });
    halves = ps.map((w) => Math.round(w));
    cov = ps.reduce((a, b) => a + b, 0) / vw;
  }
  return JSON.stringify({ pt: Math.round(performance.now()), phase: d ? d.phase : null,
    curtain: !!(c && c.isConnected), cov: Number(cov.toFixed(3)), halves,
    vw: innerWidth, vh: innerHeight });
})()`;

mkdirSync(OUT, { recursive: true });
const runSummaries = [];

for (let run = 1; run <= RUNS; run += 1) {
  const runDir = join(OUT, `run-${String(run).padStart(2, '0')}`);
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });
  say(`—— run ${run}/${RUNS}：加载 ${LIVE}`);

  // 独立幕布挂载记录器（自研简化版：记挂载时刻与移除时刻，作帧采样的旁证）
  await send('Page.navigate', { url: LIVE });
  await sleep(2500);
  for (let i = 0; i < 40; i += 1) {
    const p = JSON.parse(await evalJs(PROBE));
    if (p.phase === 'title') break;
    await sleep(250);
  }
  const p0 = JSON.parse(await evalJs(PROBE));
  if (p0.phase !== 'title') { say(`DIE run${run} 未到 title：phase=${p0.phase}`); process.exit(1); }

  // 第一跳：title→intro（.start-btn），幕布触发点是第二跳「开始第一周」
  const sbtn = JSON.parse(await evalJs(`(() => {
    const el = document.querySelector('.start-btn');
    if (!el) return '{"err":"missing"}';
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return JSON.stringify({ cx, cy, hitOk: !!(hit && (hit === el || el.contains(hit))) });
  })()`));
  if (sbtn.err || !sbtn.hitOk) { say(`DIE run${run} start-btn 不可点：${JSON.stringify(sbtn)}`); process.exit(1); }
  await tapAt(sbtn.cx, sbtn.cy);
  let introReady = false;
  for (let i = 0; i < 30 && !introReady; i += 1) {
    await sleep(200);
    introReady = await evalJs('!!document.querySelector(".dialog button.primary")');
  }
  if (!introReady) { say(`DIE run${run} intro 未就绪`); process.exit(1); }
  await sleep(600); // 让 intro 面板进场动画归位（cinePush 1.1s 的大头），幕布由「开始第一周」触发

  // 「开始第一周」按钮几何（elementFromPoint 命中自身才可信）
  const btn = JSON.parse(await evalJs(`(() => {
    const el = document.querySelector('.dialog button.primary');
    if (!el) return '{"err":"missing"}';
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return JSON.stringify({ cx, cy, w: Math.round(r.width), h: Math.round(r.height),
      hitOk: !!(hit && (hit === el || el.contains(hit))) });
  })()`));
  if (btn.err || !btn.hitOk) { say(`DIE run${run} 开始按钮不可点：${JSON.stringify(btn)}`); process.exit(1); }
  say(`run ${run}：title 就绪，开始按钮 ${btn.w}×${btn.h}px @(${btn.cx},${btn.cy})，emit tap 后连发截帧`);

  // 安装挂载记录器（下一次事件渲染开始记录）
  await evalJs(`(() => {
    window.__r6mounts = [];
    const mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (!n || n.nodeType !== 1 || !n.classList || !n.classList.contains('fx-curtain')) continue;
        const rec = { at: Math.round(performance.now()) };
        window.__r6mounts.push(rec);
        const iv = setInterval(() => { if (!n.isConnected) { rec.goneAt = Math.round(performance.now()); clearInterval(iv); } }, 16);
        setTimeout(() => clearInterval(iv), 4000);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return 'ok';
  })()`);

  // 连发截帧：5 帧前置 → tap → 固定全窗采样 34 帧（覆盖幕布 420ms 动画 + 520ms 移除，禁止提前收束截掉幕布尾巴）
  const frames = [];
  const TAP_AT_FRAME = 5;
  const TOTAL = 34;
  for (let i = 0; i < TOTAL; i += 1) {
    if (i === TAP_AT_FRAME) {
      await tapAt(btn.cx, btn.cy);
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.result.data, 'base64');
    const hostT = Date.now();
    const probe = JSON.parse(await evalJs(PROBE));
    const name = `${String(i + 1).padStart(3, '0')}-frame.png`;
    writeFileSync(join(runDir, name), buf);
    frames.push({
      frame: i + 1,
      file: name,
      hostT,
      sha256: createHash('sha256').update(buf).digest('hex'),
      bytes: buf.length,
      tapped: i === TAP_AT_FRAME,
      probe,
    });
  }

  // ---- 分析（机器可判，阈值由验收消费方核对：存活≥200ms、≥2 帧、非同帧闪没）----
  const tTap = frames[TAP_AT_FRAME - 1].probe.pt;
  const curtainFrames = frames.filter((f) => f.probe.curtain && f.probe.cov > 0.02 && f.probe.pt >= tTap);
  const first = curtainFrames[0] || null;
  const last = curtainFrames[curtainFrames.length - 1] || null;
  const spanMs = first && last ? last.probe.pt - first.probe.pt : 0;
  const coverages = curtainFrames.map((f) => f.probe.cov);
  const distinctShas = new Set(frames.map((f) => f.sha256)).size;
  const distinctCurtainShas = new Set(curtainFrames.map((f) => f.sha256)).size;
  const maxDrop = coverages.length >= 2 ? Math.max(...coverages) - Math.min(...coverages) : 0;
  const mounts = await evalJs('JSON.stringify(window.__r6mounts || [])');
  const eventPhaseFrame = frames.find((f) => f.probe.phase === 'event') || null;
  const result = {
    run,
    liveUrl: LIVE,
    viewport: `${frames[0].probe.vw}x${frames[0].probe.vh}`,
    framesCaptured: frames.length,
    distinctShas,
    tapAtFrame: TAP_AT_FRAME,
    tapPt: tTap,
    curtain: {
      framesWithCurtain: curtainFrames.length,
      distinctCurtainShas,
      spanMs,
      coverageSequence: coverages,
      maxCoverageDrop: Number(maxDrop.toFixed(3)),
      firstFrame: first ? { file: first.file, pt: first.probe.pt, cov: first.probe.cov } : null,
      lastFrame: last ? { file: last.file, pt: last.probe.pt, cov: last.probe.cov } : null,
      halfWidths: curtainFrames.map((f) => f.probe.halves),
    },
    mountsRecorded: JSON.parse(mounts),
    firstEventPhaseFrame: eventPhaseFrame ? { file: eventPhaseFrame.file, pt: eventPhaseFrame.probe.pt } : null,
    consoleErrorsDuringRun: consoleErrors.length,
  };
  writeFileSync(join(runDir, 'burst.json'), JSON.stringify({ ...result, frames }, null, 2));
  runSummaries.push(result);
  say(`run ${run} 完成：帧 ${frames.length} 张（distinct sha ${distinctShas}）；含幕布帧 ${curtainFrames.length} 张（distinct ${distinctCurtainShas}）跨 ${spanMs}ms；覆盖率序列 [${coverages.join(' → ')}]；挂载记录 ${result.mountsRecorded.length} 次；console error ${result.consoleErrorsDuringRun}`);
  if (run < RUNS) await sleep(1200);
}

writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), liveUrl: LIVE, runs: runSummaries }, null, 2));
say(`全部完成 → ${OUT}`);
ws.close();
process.exit(0);
