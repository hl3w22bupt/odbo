#!/usr/bin/env node
/**
 * 平台合规材料检查（platform-compliance）—— mobius-design D9 / 需求 R9。
 *
 * 思想来源：触乐《当 AI 开始重写小游戏生产流程》—— AI 帮不了的 4 件事之四：**平台合规审核**。
 * 同质化和合规才是死穴：能帮「过审与验收」比能「生成」稀缺得多。本脚本把合规材料清单做成
 * 机器可判的 routine：清单文件里每项要么给证据文件（存在即过），要么显式声明 done + 说明；
 * 附带策划案资产的许可检查（非生成资产必须有 license —— Steam AI 披露等场景）。
 *
 * 用法（零依赖，Node >= 18，可在任意项目 worktree 内直接跑）：
 *   node compliance-check.mjs [--checklist <path>] [--project <dir>] [--spec <path>] [--json] [--strict]
 *
 *   --checklist <path> 合规清单 JSON（默认 .myrd/compliance/checklist.json，相对 worktree 根）
 *   --project <dir>    证据文件的根目录（默认当前目录）
 *   --spec <path>      策划案 JSON（默认 .myrd/spec/design-spec.json；缺文件时跳过资产许可检查）
 *   --json             输出结构化 JSON（供门禁/agent 消费）
 *   --strict           any_item 未结论也算失败（默认只报不拦）
 *
 * 清单格式（.myrd/compliance/checklist.json）：
 * {
 *   "platform": "wechat-minigame",
 *   "items": [
 *     { "id": "privacy-policy", "requirement": "隐私政策已就位", "evidence": "docs/compliance/privacy.md" },
 *     { "id": "no-real-gambling", "requirement": "无真实货币赌博机制", "done": true, "note": "纯单机无充值" }
 *   ]
 * }
 * 每项判定：evidence 文件存在且非空 → pass；done:true → pass（note 记录说明）；
 * done:false → fail；两者都缺 → pending（--strict 时视为失败）。
 *
 * 退出码：0 = 通过；1 = 存在失败项；2 = 用法/环境错误（清单不存在等）。
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const opts = {
    checklist: '.myrd/compliance/checklist.json',
    project: '.',
    spec: '.myrd/spec/design-spec.json',
    json: false,
    strict: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--checklist') opts.checklist = argv[++i] ?? '';
    else if (a === '--project') opts.project = argv[++i] ?? '.';
    else if (a === '--spec') opts.spec = argv[++i] ?? '';
    else if (a === '--json') opts.json = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--help' || a === '-h') {
      console.log('用法: node compliance-check.mjs [--checklist <path>] [--project <dir>] [--spec <path>] [--json] [--strict]');
      process.exit(0);
    } else {
      console.error(`未知参数: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

/** 单项判定 → 'pass' | 'fail' | 'pending' */
function judgeItem(item, projectDir) {
  if (!item || typeof item !== 'object') return 'pending';
  if (item.done === true) return 'pass';
  if (item.done === false) return 'fail';
  if (typeof item.evidence === 'string' && item.evidence.trim()) {
    const p = path.resolve(projectDir, item.evidence);
    // 证据路径必须落在项目内（与策划案落点同款防越界）
    if (item.evidence.split('/').includes('..')) return 'pending';
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) return 'pass';
      return stat.size > 0 ? 'pass' : 'pending';
    } catch {
      return 'pending';
    }
  }
  return 'pending';
}

/** 策划案资产许可检查：非 generated 来源的资产必须写 license（合规硬项） */
function checkAssetLicenses(spec) {
  const issues = [];
  if (!spec || typeof spec !== 'object') return issues;
  const assets = Array.isArray(spec.assets) ? spec.assets : [];
  for (const a of assets) {
    if (!a || typeof a !== 'object') continue;
    if (a.source !== 'generated' && !a.license) {
      issues.push(`资产「${a.id ?? '?'}」（${a.kind ?? '?'}）来源为 ${a.source ?? '未知'} 但未记录 license —— 外购/CC 素材必须附许可说明`);
    }
  }
  return issues;
}

const opts = parseArgs(process.argv.slice(2));

// 清单必须存在：合规检查是显式声明的门槛，没有清单 = 没做过合规评估（fail-closed）
let checklist;
try {
  checklist = JSON.parse(fs.readFileSync(opts.checklist, 'utf8'));
} catch (e) {
  console.error(`合规清单读不到（${opts.checklist}）: ${e.message}`);
  console.error('合规材料清单是过审门槛 —— 请先建 .myrd/compliance/checklist.json（格式见脚本头部注释）');
  process.exit(2);
}

const items = Array.isArray(checklist.items) ? checklist.items : [];
if (items.length === 0) {
  console.error('合规清单里没有任何检查项（items 为空）—— 清单形同虚设');
  process.exit(2);
}

const results = items.map((item, i) => {
  const id = typeof item.id === 'string' && item.id ? item.id : `item-${i + 1}`;
  const requirement = typeof item.requirement === 'string' ? item.requirement : '';
  const status = judgeItem(item, opts.project);
  return {
    id,
    requirement: requirement || '(未写要求)',
    status,
    note: typeof item.note === 'string' ? item.note : '',
    evidence: typeof item.evidence === 'string' ? item.evidence : '',
  };
});

// 策划案资产许可（spec 缺文件时跳过，不视为失败）
let assetIssues = [];
if (fs.existsSync(opts.spec)) {
  try {
    let parsed = JSON.parse(fs.readFileSync(opts.spec, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.spec && typeof parsed.spec === 'object') parsed = parsed.spec;
    assetIssues = checkAssetLicenses(parsed);
  } catch { /* spec 非法 JSON 交给 contract-check 管，这里不重复报 */ }
}

const passCount = results.filter((r) => r.status === 'pass').length;
const failCount = results.filter((r) => r.status === 'fail').length;
const pendingCount = results.filter((r) => r.status === 'pending').length;
const failed = failCount > 0 || assetIssues.length > 0 || (opts.strict && pendingCount > 0);
const conclusion = failed ? 'REJECT' : 'APPROVE';

const report = {
  conclusion,
  platform: checklist.platform ?? '(未声明平台)',
  summary: { total: results.length, pass: passCount, fail: failCount, pending: pendingCount },
  items: results,
  assetLicenseIssues: assetIssues,
};

if (opts.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`平台合规检查（${report.platform}）：${results.length} 项 —— 通过 ${passCount} / 失败 ${failCount} / 待定 ${pendingCount}`);
  for (const r of results) {
    const mark = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '·';
    const extra = [r.evidence ? `证据: ${r.evidence}` : '', r.note ? `说明: ${r.note}` : ''].filter(Boolean).join('；');
    console.log(`  ${mark} [${r.status}] ${r.id}: ${r.requirement}${extra ? `（${extra}）` : ''}`);
  }
  for (const issue of assetIssues) console.log(`  ✗ [license] ${issue}`);
  console.log(`结论: ${conclusion}${failed ? ' —— 合规材料未齐备，不满足过审门槛' : ''}`);
}

process.exit(failed ? 1 : 0);
