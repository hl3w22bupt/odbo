import { Hono } from "hono";
import { ctx } from "#apphost";
import { getAsset } from "./lib/asset-store";

// 构建版本标识（每次发布手动 bump；与落地页 #build-badge / window.__BUILD_VERSION 对应，
// 用于冒烟复核区分新旧部署——线上页面注入的是部署 ref 的 git 短哈希，此处是发布代号）
const APP_VERSION = "v2-curtain-fix-1";

const app = new Hono();

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）。
// 资产走懒加载（首请求才拉取），/health 不等待资产就绪。
app.get("/health", (c) =>
  c.json({
    ok: true,
    app: "talent-nurture",
    title: "星光练习生：才艺养成物语",
    version: APP_VERSION,
    env: ctx.environment,
    assets: "lazy/object-storage",
  }),
);

// 游戏落地页（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// 清单带 landing.html 的部署（本游戏 build 产物）伺服自己的页面，
// 页面内引用一律走 api/public/assets/* 相对路径；无 landing.html 时回落内置说明页。
app.get("/", async (c) => {
  const landing = await getAsset("landing.html");
  if (landing) {
    return c.body(landing.body, 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    });
  }
  return c.html(FALLBACK_HTML);
});

/**
 * 游戏静态资产（底座 A：资产出 bundle，运行时从对象存储懒加载 + 内存缓存）。
 * - 壳页面请求的 `.gz.b64` 后缀是形态约定：gzip+base64 文本 → 映射回清单里的真实文件名；
 * - `:name{.+}` 必须匹配嵌套资产名（本游戏 systems/**.mjs 等模块镜像），单段 `:name` 会 404；
 * - encoding=raw：文本资产（游戏 JS 模块 / HTML），按源 contentType 伺服；
 * - encoding=gzip+b64：二进制资产的 base64 文本。
 *   M1 网关只透传文本：octet-stream / gzip 会被 502 UNSUPPORTED_BINARY 拒绝。
 */
app.get("/api/public/assets/:name{.+}", async (c) => {
  const name = c.req.param("name");
  const asset = await getAsset(name.replace(/\.gz\.b64$/, ""));
  if (!asset) {
    return c.text(`asset not found: ${name}`, 404);
  }
  const contentType = asset.encoding === "raw" ? asset.contentType : "text/plain; charset=utf-8";
  return c.body(asset.body, 200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300",
  });
});

export default app;

const FALLBACK_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>星光练习生：才艺养成物语</title><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#141021;color:#f3eaff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center}h1{font-size:1.6rem;margin:0 0 .5rem}code{background:#2a2240;padding:2px 6px;border-radius:4px;font-size:.9em}p{color:#b9a8dd;margin:.25rem 0}</style>
</head><body><div class="box"><h1>🌟 星光练习生：才艺养成物语</h1>
<p>资产尚未就绪（landing.html 缺失）。请稍后刷新，或联系工坊重部。</p>
<p>健康检查：<code>GET /health</code></p>
</div>
<script>
(function () {
  'use strict';
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
    if (audioCtx && audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) {} }
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });
  window.__audioDebug = function () { return { state: audioCtx ? audioCtx.state : 'no-ctx', addModules: 0, log: audioLog }; };
})();
</script>
</body></html>`;
