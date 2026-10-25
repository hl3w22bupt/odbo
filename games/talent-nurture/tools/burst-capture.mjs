#!/usr/bin/env node
/**
 * burst-capture —— 使用验收专用的连发截帧取证工具（承 tools/smoke-mobile.mjs 判例）。
 *
 * 用途：对已运行的页面做「间隔多帧」连发截图 + 每帧 DOM 动画状态探针，
 *      证明 CSS 动画真实运行（帧间字节有差异、animationName/computed transform 在变），
 *      区分「静态贴图」与「动效」。只记录（帧、哈希、探针值），不做合格判定。
 *
 * 连接方式：复用 experience-harness sessiond 拉起的 headless Chrome（--remote-debugging-port），
 *          零 npm 依赖，Node ≥22 内置 WebSocket。
 *
 * 用法：
 *   node burst-capture.mjs --port 9620 --out <目录> --frames 6 --interval 300 \
 *     [--probe '<js 表达式，须返回 JSON.stringify-able 值>'] [--label <前缀>] \
 *     [--tap x,y]  （第 1 帧截完即经 Input.dispatchTouchEvent 真实触摸管线点击，用于抓转场中间帧）
 *
 * 输出：<out>/<NNN>-<label>.png + <out>/burst-manifest.json
 * （manifest 记录每帧 sha256、字节差、探针值；帧间 sha256 全同 = 画面静止，互异 = 有动画）
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const flag = (name, dflt = "") => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};

const PORT = Number(flag("port", "0"));
const OUT = flag("out", "./burst");
const FRAMES = Number(flag("frames", "6"));
const INTERVAL = Number(flag("interval", "300"));
const PROBE_EXPR = flag("probe", "");
const LABEL = flag("label", "frame");
const TAP = flag("tap", ""); // "x,y"：第 1 帧后触发真实触摸

if (!PORT) {
  console.error("缺少 --port <Chrome CDP 端口>");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("无 page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { ws, send };
}

const { ws, send } = await connect();
await send("Runtime.enable");
mkdirSync(OUT, { recursive: true });

/** 真实触摸管线：Input.dispatchTouchEvent touchStart→touchEnd（承 smoke-mobile.mjs 口径） */
async function tap(x, y) {
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

const frames = [];
for (let i = 0; i < FRAMES; i++) {
  if (i === 1 && TAP) {
    const [tx, ty] = TAP.split(",").map(Number);
    await tap(tx, ty);
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(shot.result.data, "base64");
  const name = `${String(i + 1).padStart(3, "0")}-${LABEL}.png`;
  writeFileSync(join(OUT, name), buf);

  let probe = null;
  if (PROBE_EXPR) {
    const r = await send("Runtime.evaluate", { expression: PROBE_EXPR, returnByValue: true });
    probe = r.result?.result?.value ?? null;
  }
  frames.push({
    frame: i + 1,
    file: name,
    sha256: createHash("sha256").update(buf).digest("hex"),
    bytes: buf.length,
    probedAt: new Date().toISOString(),
    probe,
  });
  if (i < FRAMES - 1) await sleep(INTERVAL);
}
ws.close();

const digests = new Set(frames.map((f) => f.sha256));
const manifest = {
  label: LABEL,
  out: OUT,
  frames: FRAMES,
  intervalMs: INTERVAL,
  distinctSha256: digests.size,
  stillImage: digests.size === 1, // 纯记录：帧间哈希全同=画面静止（只陈述事实，不下结论）
  frames,
};
writeFileSync(join(OUT, "burst-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ frames: FRAMES, distinctSha256: digests.size, stillImage: manifest.stillImage, out: OUT }));
