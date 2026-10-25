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
import { execFileSync } from 'node:child_process';

// 构建版本标识：部署 ref 的 git 短哈希（线上冒烟用它核对「新部署已生效」）
const BUILD_VERSION = (() => {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'dev'; }
})();

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
<meta name="build-version" content="${BUILD_VERSION}">
<title>星光练习生：才艺养成物语</title>
<script>
(function () {
  'use strict';
  // 构建版本标识（冒烟取证：window.__BUILD_VERSION 应等于部署 ref 的 git 短哈希）
  window.__BUILD_VERSION = '${BUILD_VERSION}';
  // ---- 资产基路径（game-9 判例）：公网入口 /apps/<slug>（无尾斜杠）下，裸相对路径会
  // 解析到 /apps/*（网关 404）。按页面路径推导：/apps/talent-nurture → /apps/talent-nurture/。
  var BASE_PATH = (function () {
    var p = location.pathname.replace(/index\\.html$/, '');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  })();

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

  // ---- 样式与游戏模块：动态注入（静态 src 在无尾斜杠入口下会 404）----
  function onload() {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_PATH + 'api/public/assets/style.css';
    document.head.appendChild(link);
    var s = document.createElement('script');
    s.type = 'module';
    s.src = BASE_PATH + 'api/public/assets/main.mjs';
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onload);
  else onload();
})();
</script>
</head>
<body>
<div id="game-root"></div>
<div id="build-badge" title="构建版本">build ${BUILD_VERSION}</div>
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
