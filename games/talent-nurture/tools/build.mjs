#!/usr/bin/env node
/**
 * build —— 零依赖构建：把 src/ 镜像到 export/web/，并生成 AppHost 落地页 landing.html。
 * - 模块以 .mjs 镜像（api/public/assets/** 嵌套资产，wheat-squad 同款布局）；
 * - landing.html 内联「移动端音频手势解锁器」与「调参桥」壳契约（必须先于游戏模块加载）；
 * - 页面内引用一律相对路径（无前导斜杠），经网关子路径 /apps/talent-nurture 访问才不会 404。
 */
import { cpSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(here, '..');
const src = join(gameRoot, 'src');
const out = join(gameRoot, 'export', 'web');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

// 仅镜像 .mjs / .css（.mjs 是模块资产；style.css 原样伺服）
const kept = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.mjs') || p.endsWith('.css')) kept.push(p);
    else rmSync(p);
  }
})(out);
if (!kept.some((p) => p.endsWith('main.mjs'))) {
  console.error('build failed: main.mjs missing');
  process.exit(1);
}

const landing = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>星光练习生：才艺养成物语</title>
<link rel="stylesheet" href="api/public/assets/style.css">
<script>
(function () {
  'use strict';
  // ---- 调参桥（SKILL §3C 硬契约：引擎加载前落全局）----
  try {
    var rawTuning = new URLSearchParams(location.search).get('tuning');
    if (rawTuning) {
      var t = JSON.parse(rawTuning);
      if (t && typeof t === 'object' && !Array.isArray(t)) window.__GAME_TUNING__ = t;
    }
  } catch (e) { /* 非 JSON 忽略 */ }

  // ---- 移动端音频手势解锁器（iOS/Android WebKit：创建即 suspended、打断后 interrupted）----
  var audioCtx = null;
  var audioLog = [];
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    var Wrapped = function (options) {
      var ctx = new NativeAudioContext(options);
      audioCtx = ctx;
      try { ctx.addEventListener('statechange', function () { audioLog.push({ t: Date.now(), state: ctx.state }); }); } catch (e) {}
      return ctx;
    };
    Wrapped.prototype = NativeAudioContext.prototype;
    window.AudioContext = Wrapped;
  }
  function unlockAudio() {
    if (!audioCtx || audioCtx.state === 'running') return;
    try { var p = audioCtx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) unlockAudio();
  }, { passive: true });
  window.__audioDebug = function () {
    return { state: audioCtx ? audioCtx.state : 'no-ctx', addModules: 0, log: audioLog };
  };
})();
</script>
</head>
<body>
<div id="game-root"></div>
<script type="module" src="api/public/assets/main.mjs"></script>
</body>
</html>
`;
writeFileSync(join(out, 'landing.html'), landing);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p.slice(out.length + 1));
  }
})(out);
console.log('build ok:', files.length, 'assets →', files.join(', '));
