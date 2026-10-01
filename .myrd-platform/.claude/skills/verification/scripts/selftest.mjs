#!/usr/bin/env node
/**
 * Verification skill 门禁自测：正例 + 反例双向用例（改任何脚本/规则后必跑）。
 *
 * 覆盖：
 *   - validate-report.mjs：schema / 证据链硬检查 / 评分与结论确定性复核（正例 2 + 反例 14）
 *   - render-report-md.mjs：关键小节渲染 + 非法报告拒绝
 *   - resolve-pr-mapping.mjs：三级优先级 + orphan + 优先级抢占
 *
 * 用法：node selftest.mjs
 * 退出码：0 全部通过；1 存在失败（逐条列出）。
 *
 * 反例纪律（references/08 维护规则，见 SKILL.md §8）：新增校验规则时，先在这里加一条
 * 「必须被拒绝」的反例，再改 validator —— 保证门禁自身可回归。
 */

import { execFileSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import assert from "node:assert/strict";
import { resolvePrMapping } from "./resolve-pr-mapping.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = join(SCRIPT_DIR, "validate-report.mjs");
const RENDERER = join(SCRIPT_DIR, "render-report-md.mjs");
const EXAMPLES = join(SCRIPT_DIR, "..", "examples");

const results = [];

function runCase(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    process.stdout.write(`  PASS ${name}\n`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    process.stdout.write(`  FAIL ${name}\n       ${String(e.message).split("\n")[0]}\n`);
  }
}

/** 运行 validator（报告 JSON 走 stdin），返回 {code, stdout, stderr} */
function validate(reportObj) {
  const input = typeof reportObj === "string" ? reportObj : JSON.stringify(reportObj);
  try {
    const stdout = execFileSync(process.execPath, [VALIDATOR], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    // 非 0 退出：execFileSync 抛错，status 为退出码
    if (e.status === 2) return { code: 2, stdout: e.stdout ?? "", stderr: e.stderr ?? String(e.message) };
    return { code: 1, stdout: e.stdout ?? "", stderr: (e.stderr ?? String(e.message)) };
  }
}

function render(reportObj) {
  const input = typeof reportObj === "string" ? reportObj : JSON.stringify(reportObj);
  try {
    const stdout = execFileSync(process.execPath, [RENDERER], { input, encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? String(e.message) };
  }
}

const sampleReq = JSON.parse(readFileSync(join(EXAMPLES, "sample-report.json"), "utf8"));
const samplePr = JSON.parse(readFileSync(join(EXAMPLES, "sample-report-pr.json"), "utf8"));
/** 反例基底：clone PR 样例（覆盖 schema 最全：含 prMapping / allOf 条件分支） */
const base = () => structuredClone(samplePr);

console.log("[1/3] validate-report.mjs");

runCase("正例：Requirement 场景样例（NEEDS_WORK 路径）通过", () => {
  const r = validate(sampleReq);
  assert.equal(r.code, 0, `应通过，实际 stderr: ${r.stderr}`);
  assert.match(r.stdout, /verdict=NEEDS_WORK score=75/);
});

runCase("正例：PR 场景样例（CERTIFIED 路径，含 prMapping）通过（stdin 管道方式）", () => {
  const r = validate(samplePr);
  assert.equal(r.code, 0, `应通过，stderr: ${r.stderr}`);
});

runCase("反例：缺必填字段（删 verdict）被拒", () => {
  const r = base();
  delete r.verdict;
  assert.equal(validate(r).code, 1);
});

runCase("反例：结论非三态（PASS）被拒", () => {
  const r = base();
  r.verdict.value = "PASS";
  assert.equal(validate(r).code, 1);
});

runCase("反例：pass 判定零证据被拒（P1 schema 强制 + 硬检查①）", () => {
  const r = base();
  r.adjudications[0].evidenceIds = [];
  assert.equal(validate(r).code, 1);
});

runCase("反例：pass 判定仅传闻级证据被拒（hearsay 不得支撑 pass）", () => {
  const r = base();
  r.evidence.push({
    id: "EV-09", type: "doc_link", uri: "https://example.com/claims", fetchedAt: r.evidence[0].fetchedAt,
    digest: "sha256:" + "0".repeat(64), excerpt: "agent 自述已实现", reliability: "hearsay", status: "ok",
  });
  r.adjudications[0].evidenceIds = ["EV-09"];
  assert.equal(validate(r).code, 1);
});

runCase("反例：pass 判定引用 unreachable 证据被拒（硬检查② + 造假规则）", () => {
  const r = base();
  r.evidence[1].status = "unreachable";
  const out = validate(r);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /status=unreachable/);
});

runCase("反例：score 越界（101）被拒", () => {
  const r = base();
  r.scoring.score = 101;
  assert.equal(validate(r).code, 1);
});

runCase("反例：score 与重算不一致被拒（90 ≠ 100）", () => {
  const r = base();
  r.scoring.score = 90;
  assert.equal(validate(r).code, 1);
});

runCase("反例：breakdown weighted 与 weight×分值 不一致被拒", () => {
  const r = base();
  r.scoring.breakdown[0].weighted = 0.9;
  assert.equal(validate(r).code, 1);
});

runCase("反例：digest 非 sha256 格式被拒", () => {
  const r = base();
  r.evidence[0].digest = "deadbeef";
  assert.equal(validate(r).code, 1);
});

runCase("反例：标准无判定记录被拒（硬检查③：标准无遗漏）", () => {
  const r = base();
  r.adjudications = r.adjudications.slice(0, 1);
  assert.equal(validate(r).code, 1);
});

runCase("反例：结论与确定性重算不一致被拒（partial 存在却声称 CERTIFIED）", () => {
  const r = structuredClone(sampleReq);
  r.verdict.value = "CERTIFIED";
  const out = validate(r);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /确定性重算值 NEEDS_WORK/);
});

runCase("反例：PR 场景缺 prMapping 被拒（验收标准 2 条件必填）", () => {
  const r = base();
  delete r.prMapping;
  assert.equal(validate(r).code, 1);
});

runCase("反例：PR 映射 orphan 却声称 CERTIFIED 被拒（封顶 NEEDS_WORK）", () => {
  const r = base();
  r.prMapping.status = "orphan";
  r.prMapping.note = "模拟三级映射全未命中";
  const out = validate(r);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /NEEDS_WORK/);
});

runCase("反例：红队 skipped 却声称 CERTIFIED 被拒（P3：无对抗不得认证）", () => {
  const r = base();
  r.redTeam = { status: "skipped", challenges: [] };
  const out = validate(r);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /NEEDS_WORK/);
});

runCase("反例：额外字段（additionalProperties:false）被拒", () => {
  const r = base();
  r.extraField = 1;
  assert.equal(validate(r).code, 1);
});

runCase("反例：非法 JSON 输入被拒", () => {
  assert.equal(validate("{not-json").code, 1);
});

console.log("[2/3] render-report-md.mjs");

runCase("渲染 PR 样例：关键小节与映射行齐全，无 emoji", () => {
  const r = render(samplePr);
  assert.equal(r.code, 0, r.stderr);
  for (const marker of ["# 验证报告：", "需求映射：mapped", "## 结论依据", "RULE_ALL_PASS", "## 逐条判定", "## 红队对抗", "## 风险与遗留", "## 证据清单", "[EV-01]("]) {
    assert.ok(r.stdout.includes(marker), `输出应包含「${marker}」`);
  }
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r.stdout), "禁止 emoji 图标");
});

runCase("渲染 NEEDS_WORK 样例：风险与遗留逐条列出", () => {
  const r = render(sampleReq);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /AC-02 仅部分达成/);
});

runCase("渲染缺 target 的报告被拒（先过 validate 再渲染）", () => {
  const r = base();
  delete r.target;
  assert.equal(render(r).code, 1);
});

console.log("[3/3] resolve-pr-mapping.mjs");

runCase("映射优先级 1：PR 描述 Req: 标记命中 requirement", () => {
  const m = resolvePrMapping({
    body: "## 概要\n实现验证技能\nReq: cmtwygpt8005im9wnm4wyucnj",
    headRefName: "myrd/feature",
    commits: [],
  });
  assert.deepEqual(m, {
    status: "mapped", method: "pr_body",
    requirements: ["cmtwygpt8005im9wnm4wyucnj"], goals: [],
    note: "PR 描述显式标记命中（优先级 1）",
  });
});

runCase("映射优先级 2：分支名 goal-<id> 命中 goal", () => {
  const m = resolvePrMapping({ body: "", headRefName: "myrd/verification-skill-goal-cmtwy2q100053m9wnh1f25cor" });
  assert.equal(m.method, "branch_name");
  assert.deepEqual(m.goals, ["cmtwy2q100053m9wnh1f25cor"]);
  assert.deepEqual(m.requirements, []);
});

runCase("映射优先级 3：commit message Closes: 命中（body/branch 未命中时）", () => {
  const m = resolvePrMapping({
    body: "无标记",
    headRefName: "feature/foo",
    commits: [{ message: "feat: x\n\nCloses: cmtwygpt8005im9wnm4wyucnj" }],
  });
  assert.equal(m.method, "commit_message");
  assert.deepEqual(m.requirements, ["cmtwygpt8005im9wnm4wyucnj"]);
});

runCase("映射 orphan：三级全未命中，note 说明尝试途径", () => {
  const m = resolvePrMapping({ body: "", headRefName: "feature/foo", commits: ["no markers"] });
  assert.equal(m.status, "orphan");
  assert.equal(m.method, null);
  assert.match(m.note, /pr_body/);
  assert.match(m.note, /branch_name/);
});

runCase("映射优先级抢占：body 命中时忽略分支/commit 线索", () => {
  const m = resolvePrMapping({
    body: "Req: cmtwygpt8005im9wnm4wyucnj",
    headRefName: "myrd/some-goal-cmtwy2q100053m9wnh1f25cor",
    commits: ["Refs: cmtwygpt8005im9wnm4wyucnj"],
  });
  assert.equal(m.method, "pr_body");
  assert.deepEqual(m.requirements, ["cmtwygpt8005im9wnm4wyucnj"]);
  assert.deepEqual(m.goals, []);
});

// ── SKILL.md 与 Feature Map 接入的回归护栏 ──────────────────────────────────
// S2 按 FEATURE_MAP 采集 + S6 活文档闭环是流程契约，靠文案存在性守护：
// 若有人删掉这两处指引，这里会失败提醒（而非静默退化回「自由发挥」采集）。

runCase("SKILL.md：S2 指引引用 FEATURE_MAP.md 按图采集", () => {
  const md = readFileSync(join(SCRIPT_DIR, "..", "SKILL.md"), "utf-8");
  assert.match(md, /S2[\s\S]{0,200}FEATURE_MAP\.md/, "S2 阶段应指引先读 FEATURE_MAP.md");
  assert.match(md, /验证步骤[\s\S]{0,60}逐条对照/, "S2 应要求按验证步骤逐条对照采集");
});

runCase("SKILL.md：S6 含活文档闭环（验证时顺手更新漂移条目）", () => {
  const md = readFileSync(join(SCRIPT_DIR, "..", "SKILL.md"), "utf-8");
  assert.match(md, /活文档闭环[\s\S]{0,120}顺手/, "S6 应包含 FEATURE_MAP 漂移时顺手更新的指引");
});

// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n自测结果：${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
  console.error("失败用例：");
  for (const f of failed) console.error(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
process.exit(0);
