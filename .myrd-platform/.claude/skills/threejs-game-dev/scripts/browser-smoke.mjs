#!/usr/bin/env node
// browser-smoke.mjs — CDP 真浏览器冒烟门禁：headless Chrome 打开产物 index.html?smoke=<秒>，
// 断言：SMOKE payload 可解析 / 零未捕获异常 / 渲染确已开始 / 状态机推进 / 帧率下限。
// 用法：node browser-smoke.mjs <工程目录> [--seconds 62] [--chrome <path>] [--port 9226]
// 产物侧协议：?smoke=<秒> 跳过交互直接快进内核，结果 JSON 写 #ts-smoke + document.title（模板已内置）。

import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SECONDS = Number(flag("--seconds", "62"));
const PORT = Number(flag("--port", "9226"));
const CANDIDATES = [flag("--chrome", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome-stable", "google-chrome", "chromium-browser", "chromium"].filter(Boolean);

const target = path.join(dir, "index.html");
if (!existsSync(target)) {
  console.error(`BROWSER-SMOKE: FAIL — ${target} 不存在，先 node tools/build.mjs`);
  process.exit(1);
}

let chrome = null;
for (const c of CANDIDATES) {
  try { chrome = c; break; } catch { /* try next */ }
}
if (!chrome) {
  console.error("BROWSER-SMOKE: FAIL(2) — 找不到 Chrome/Chromium（--chrome 指定路径），先装环境不要改代码");
  process.exit(2);
}

// —— 起 headless Chrome（CDP 端口 + 软件渲染兜底 + 独立 user-data-dir）——
const profile = mkdtempSync(path.join(os.tmpdir(), "ts3d-smoke-"));
const cp = spawn(chrome, [
  "--headless=new", "--remote-debugging-port=" + PORT, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", "--user-data-dir=" + profile, "--window-size=1280,720", "--disable-gpu-sandbox",
  `file://${target}?smoke=${SECONDS}`,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectCdp(retries = 50) {
  for (let i = 0; i < retries; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === "page" && t.url.includes("index.html"));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* chrome not ready yet */ }
    await sleep(200);
  }
  throw new Error("CDP 连接超时");
}

let outcome = "timeout";
let payload = null;
let consoleErrors = 0;

try {
  const wsUrl = await connectCdp();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") consoleErrors++;
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors++;
    // 产物侧把结果写进 title（SMOKE {...}）—— title 变化即取
    if (m.method === "Page.frameNavigated" || m.method === "Page.titleChanged") { /* title via evaluate */ }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send("Runtime.enable");
  await send("Page.enable");

  const evalTitle = async () => {
    const r = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
    return r.result?.result?.value || "";
  };
  const evalJson = async () => {
    const r = await send("Runtime.evaluate", {
      expression: "document.getElementById('ts-smoke')?.textContent || ''",
      returnByValue: true,
    });
    return r.result?.result?.value || "";
  };

  // 轮询等待产物侧落账（快进 SECONDS 秒 + 余量）
  const deadline = Date.now() + Math.min(SECONDS * 1000 + 60000, 180000);
  while (Date.now() < deadline) {
    await sleep(1000);
    const t = await evalTitle();
    if (t.startsWith("SMOKE ")) {
      try { payload = JSON.parse(t.slice(6)); outcome = "title"; } catch { outcome = "badjson"; }
      break;
    }
    const raw = await evalJson();
    if (raw) {
      try { payload = JSON.parse(raw); outcome = "dom"; } catch { outcome = "badjson"; }
      break;
    }
  }
  ws.close();
} catch (e) {
  console.error(`BROWSER-SMOKE: FAIL — CDP 阶段异常：${e.message}`);
  cp.kill();
  process.exit(1);
}
cp.kill();

console.log(`\n===== browser-smoke（smoke=${SECONDS}s，${outcome}）=====`);
const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

ok(payload !== null, "SMOKE payload 已落账（title/#ts-smoke，模板 ?smoke= 协议）");
if (payload) {
  ok(payload.exceptions === 0, `零未捕获异常（exceptions=${payload.exceptions}，CDP 侧计数=${consoleErrors}）`);
  ok((payload.frames || 0) > 0, `渲染确已开始（frames=${payload.frames}）`);
  ok((payload.fps ?? 0) >= 10, `帧率下限（fps=${payload.fps}，headless SwiftShader ≥10）`);
  ok(payload.state === "gameover" || payload.state === "playing",
    `状态机推进（state=${payload.state}，快进 ${SECONDS}s 应达 gameover 或 playing）`);
  ok(Number.isFinite(payload.score) && Number.isFinite(payload.timeLeft), `数值健康（score=${payload.score}，timeLeft=${payload.timeLeft}）`);
  if (consoleErrors > 0 && payload.exceptions === 0) failures.push(`CDP 侧捕获 ${consoleErrors} 条 console error（payload.exceptions=0 与之矛盾，查 [smoke] 日志）`);
}

console.log("\n===== browser-smoke 汇总 =====");
if (failures.length || payload === null) {
  console.error(`BROWSER-SMOKE: FAIL（${failures.length || 1} 项未过：${(outcome === "timeout" ? ["产物未在预算内落账 SMOKE 结果——先本机打开 index.html?smoke=5 手动复现"] : failures).join("；")}）`);
  process.exit(1);
}
console.log("BROWSER-SMOKE: PASS");
