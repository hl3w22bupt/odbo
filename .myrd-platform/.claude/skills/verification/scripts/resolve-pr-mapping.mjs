#!/usr/bin/env node
/**
 * Verification skill：PR → 需求/Goal 映射解析（确定性纯函数，零依赖）。
 *
 * 优先级（references/README §3，命中即停，T2 场景必需；均未命中 = orphan，
 * 结论封顶 NEEDS_WORK）：
 *   1. pr_body：PR 描述中的显式标记行 `Req:` / `Requirement:` / `Refs:` / `Closes:` / `Fixes:` / `Goal:`
 *   2. branch_name：分支名中的 `goal-<id>` / `requirement-<id>` / `req-<id>` / 裸 cuid
 *   3. commit_message：commit message 中的同一组标记行（裸 cuid 不采信，噪声过高）
 *
 * 对象 id 识别：平台 cuid（c 开头的小写字母数字串，≥21 位）。
 *
 * 用法（IO 由调用方完成，本脚本只做解析 —— 便于离线测试）：
 *   gh pr view <n> --json body,headRefName,commits \
 *     | node resolve-pr-mapping.mjs
 *   node resolve-pr-mapping.mjs pr.json
 *
 * 输入 JSON 字段（全部可选，缺的跳过）：
 *   { body: string, headRefName: string, commits: [{message?|messageHeadline?,messageBody?}] | string[] }
 * 输出（stdout）：{ status: "mapped"|"orphan", method, requirements, goals, note }
 * 退出码：0 成功；2 用法/IO 错误。
 */

import { readFileSync } from "fs";

/** 平台 cuid：c 开头 + 小写字母数字（对 cuid v1/cuid2 都成立的最小公共形态） */
const CUID = /\bc[0-9a-z]{20,}\b/g;

/** 标记行：行首（允许列表符/空白）标记词 + 冒号 + 值 */
const MARKER_LINE = /^\s*(?:[-*+>\s]*)(req|requirement|goal|refs?|closes?|fixes?)\s*[:：]\s*(.+)$/gim;

function extractIds(text) {
  return [...new Set((text.match(CUID) ?? []))];
}

/** 标记行 → {requirements, goals}（Req/Refs/Closes/Fixes → requirement；Goal → goal） */
function parseMarkers(text) {
  const requirements = [];
  const goals = [];
  let m;
  MARKER_LINE.lastIndex = 0;
  while ((m = MARKER_LINE.exec(text)) !== null) {
    const kind = m[1].toLowerCase();
    const ids = extractIds(m[2]);
    if (ids.length === 0) continue;
    if (kind === "goal") goals.push(...ids);
    else requirements.push(...ids);
  }
  return { requirements: [...new Set(requirements)], goals: [...new Set(goals)] };
}

/** 分支名 → {requirements, goals}（关键字前缀优先，裸 cuid 归入 requirement —— 需求分支为主流命名） */
function parseBranch(branch) {
  const goals = [];
  const requirements = [];
  for (const m of branch.matchAll(/goal[-_:](c[0-9a-z]{20,})/gi)) goals.push(m[1]);
  for (const m of branch.matchAll(/(?:requirement|req)[-_:](c[0-9a-z]{20,})/gi)) requirements.push(m[1]);
  const tagged = new Set([...goals, ...requirements]);
  for (const id of extractIds(branch)) {
    if (!tagged.has(id)) requirements.push(id);
  }
  return { requirements: [...new Set(requirements)], goals: [...new Set(goals)] };
}

/** commits（宽松形态）→ 拼接全部 message 文本 */
function commitTexts(commits) {
  if (!Array.isArray(commits)) return "";
  return commits
    .map((c) => {
      if (typeof c === "string") return c;
      return [c.message, c.messageHeadline, c.messageBody].filter(Boolean).join("\n");
    })
    .join("\n");
}

export function resolvePrMapping(input) {
  const attempted = [];
  const byBody = input.body ? parseMarkers(String(input.body)) : { requirements: [], goals: [] };
  if (byBody.requirements.length || byBody.goals.length) {
    return {
      status: "mapped",
      method: "pr_body",
      requirements: byBody.requirements,
      goals: byBody.goals,
      note: "PR 描述显式标记命中（优先级 1）",
    };
  }
  attempted.push("pr_body: 无显式标记或标记行未含有效对象 id");

  const branch = String(input.headRefName ?? "");
  if (branch) {
    const byBranch = parseBranch(branch);
    if (byBranch.requirements.length || byBranch.goals.length) {
      return {
        status: "mapped",
        method: "branch_name",
        requirements: byBranch.requirements,
        goals: byBranch.goals,
        note: `分支名 ${branch} 命中（优先级 2）`,
      };
    }
    attempted.push(`branch_name: ${branch || "(空)"} 未命中`);
  }

  const commits = commitTexts(input.commits);
  if (commits) {
    const byCommits = parseMarkers(commits);
    if (byCommits.requirements.length || byCommits.goals.length) {
      return {
        status: "mapped",
        method: "commit_message",
        requirements: byCommits.requirements,
        goals: byCommits.goals,
        note: "commit message 标记命中（优先级 3）",
      };
    }
    attempted.push("commit_message: 标记行未含有效对象 id");
  }

  return {
    status: "orphan",
    method: null,
    requirements: [],
    goals: [],
    note: `三级映射均未命中：${attempted.join("；")}`,
  };
}

function main() {
  const argv = process.argv.slice(2);
  // 无文件参数 = 从 stdin 读（管道用法）；仅当 stdin 还是 TTY（没有管道输入）时才算用法错误
  if (argv.includes("--help") || argv.includes("-h") || (argv.length === 0 && process.stdin.isTTY)) {
    process.stdout.write(
      "用法: gh pr view <n> --json body,headRefName,commits | node resolve-pr-mapping.mjs\n  或: node resolve-pr-mapping.mjs <pr.json>\n输出: {status, method, requirements, goals, note}\n",
    );
    return argv.includes("--help") || argv.includes("-h") ? 0 : 2;
  }
  let raw;
  try {
    raw = argv[0] ? readFileSync(argv[0], "utf8") : readFileSync(0, "utf8");
  } catch (e) {
    process.stderr.write(`ERROR: 读取输入失败: ${e.message}\n`);
    return 2;
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`ERROR: 输入不是合法 JSON: ${e.message}\n`);
    return 2;
  }
  process.stdout.write(JSON.stringify(resolvePrMapping(input), null, 2) + "\n");
  return 0;
}

// 被 selftest 直接 import 时不出场；CLI 直跑时执行
const isMain = process.argv[1] && (process.argv[1].endsWith("resolve-pr-mapping.mjs") || process.argv[1].endsWith("resolve-pr-mapping"));
if (isMain) process.exit(main());
