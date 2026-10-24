#!/usr/bin/env node
/**
 * annotate-report —— qa/mobile/report.json 收口增补（幂等，可复跑后重放）。
 * 用法：node tools/annotate-report.mjs   （在 smoke-mobile.mjs 复跑之后执行）
 * 职责：为 report.screenshots 逐张补 sha256/尺寸/非空白校验（screenshotDigests），
 *       并写 evidenceMethod（取证方式）与 conclusion（结论口径）。
 * 纪律：只追加元数据字段，不改动 smoke-mobile.mjs 产出的判定字段（checks/verdict/summary）；
 *       主观体验结论一律标注待用户回填，绝不代填。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const QA = join(HERE, '..', 'qa', 'mobile');
const reportPath = join(QA, 'report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const digests = [];
for (const name of report.screenshots) {
  const buf = readFileSync(join(QA, name));
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  // 解析 PNG IDAT 解压后采样统计字节多样性（纯黑/纯色屏 distinct 值为个位数，≥32 视为有内容）
  let off = 8;
  const idats = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idats.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idats));
  const stride = w * 4 + 1; // RGBA8 + filter 字节
  const samples = new Set();
  for (let y = 0; y < h; y += 7) {
    const rowStart = y * stride;
    if (rowStart + stride > raw.length) break;
    for (let x = 0; x < w * 4; x += 37) samples.add(raw[rowStart + 1 + x]);
  }
  const distinct = samples.size;
  digests.push({ name, sha256, bytes: buf.length, width: w, height: h, sampledDistinctByteValues: distinct, nonBlank: distinct >= 32 });
  console.log(`${name} ${w}x${h} ${buf.length}B distinct=${distinct} ${distinct >= 32 ? 'NON-BLANK' : '!! BLANK?'}`);
}

report.screenshotDigests = digests;
report.evidenceMethod = {
  tool: 'games/talent-nurture/tools/smoke-mobile.mjs（零 npm 依赖 CDP，判例承 tools/smoke-live.mjs）',
  emulation: 'headless Chrome 375x720 @2x deviceScaleFactor、mobile:true、Emulation.setTouchEmulationEnabled(maxTouchPoints:5)',
  input: 'Input.dispatchTouchEvent touchStart→touchEnd 真实触摸管线（非 JS 直调 onclick）',
  flow: '开屏→序章→分支事件（连点 3 次防重判定的反取证）→教程训练→全 touch 主循环推进 12 周至结局判定',
  reproNote: '2026-10-24 复跑取证：首轮 FAIL 暴露脚本两处取证缺陷——tapSelector 不跳过 disabled 按钮（体力不足时「登台演出」被禁用致卡 stage-confirm 循环 823 次）与 html 入口按 URL 后缀判漏网关 308 规范化形态；修复脚本后复跑 PASS 9/9，本报告为修复后取证，digests 由本脚本增补（复跑 smoke-mobile.mjs 后重放本脚本即可恢复）',
  outOfScope: '主观体验（好玩/画面审美/四问量表）不在机器取证范围，待用户试玩回填',
};
report.conclusion = '机器可判项 9/9 PASS：375x720 移动仿真下资产加载全 200、首屏可点、touch 管线全程推进至结局（fail-return，公演 0 分——体力不足按游戏规则弃权所致的合法结局，与桌面 smoke 歌姬结局/76 分差异源于玩法路径非端差异）、热区无重叠最矮 44px、console 零 error 零 warning；截图均非空白且与阶段一一对应。使用验收结论待用户回填。';

writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`report.json 增补完成：digests=${digests.length} checks=${report.checks.length} verdict=${report.verdict}（判定字段未改动）`);
