#!/usr/bin/env node
/**
 * Verification skill 报告渲染：结构化报告 JSON → 人类可读 Markdown。
 *
 * 模板与 references/04 §5 逐字段对应；PR 场景额外渲染 prMapping 行（验收标准 2：
 * 报告需可见「与关联需求的映射关系」）。供 S6 回写使用（PR 评论 / 通知附件）。
 * 渲染规则：表格列固定；判定与结论用文本徽标（禁 emoji）；证据一律超链接到 uri。
 *
 * 用法：
 *   node render-report-md.mjs <report.json>
 *   cat report.json | node render-report-md.mjs
 *
 * 退出码：0 成功（Markdown 到 stdout）；1 报告非法；2 用法/IO 错误。
 */

import { readFileSync } from "fs";

/** Markdown 表格单元格转义：竖线与换行 */
function cell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const VERDICT_LABEL = { pass: "pass", partial: "partial", fail: "fail", unverified: "unverified" };
const SCENARIO_LABEL = {
  status_change_auto: "T1 状态变更自动",
  pr_created_or_updated: "T2 PR 创建/更新",
  explicit_invoke: "T3 显式调用",
};

function render(report) {
  const lines = [];
  const t = report.target ?? {};
  const s = report.scoring ?? {};
  const v = report.verdict ?? {};
  const evidenceById = new Map((report.evidence ?? []).map((e) => [e.id, e]));
  const criteriaById = new Map((report.criteria ?? []).map((c) => [c.id, c]));
  const challenges = report.redTeam?.challenges ?? [];
  const upheldBy = (severity) => challenges.filter((c) => c.outcome === "upheld" && c.severity === severity).length;

  lines.push(`# 验证报告：${cell(t.title ?? t.id ?? "(未命名对象)")}`);
  lines.push("");
  lines.push(`- 报告 ID：${report.reportId ?? "(缺省)"} · 结论：**${v.value ?? "(缺省)"}**`);
  lines.push(`- 验证对象：${t.type ?? "?"}:${t.id ?? "?"}（${t.ref ?? "无 ref"}）`);
  const trigger = report.triggeredBy ?? {};
  lines.push(
    `- 触发：${SCENARIO_LABEL[trigger.scenario] ?? trigger.scenario ?? "?"} · 触发者：${trigger.actor ?? "?"} · 完成：${report.createdAt ?? "?"} · 耗时：${report.durationMs ?? "?"}ms`,
  );
  const totalCount = (s.passed ?? 0) + (s.partial ?? 0) + (s.failed ?? 0) + (s.unverified ?? 0);
  lines.push(
    `- 完成度：${s.score ?? "?"}/100（pass ${s.passed ?? 0}/${totalCount} · partial ${s.partial ?? 0} · fail ${s.failed ?? 0} · unverified ${s.unverified ?? 0}）`,
  );
  if (t.type === "pr") {
    const m = report.prMapping;
    lines.push(
      `- 需求映射：${m ? `${m.status}${m.method ? `（经 ${m.method}）` : ""}${(m.requirements ?? []).length ? ` · Req ${(m.requirements ?? []).join(", ")}` : ""}${(m.goals ?? []).length ? ` · Goal ${(m.goals ?? []).join(", ")}` : ""}` : "（报告未声明 prMapping）"}`,
    );
  }
  lines.push("");

  lines.push("## 结论依据");
  lines.push("");
  for (const r of v.reasons ?? []) lines.push(`- ${r}`);
  if (v.summary) {
    lines.push("");
    lines.push(v.summary);
  }
  lines.push("");

  lines.push("## 逐条判定");
  lines.push("");
  lines.push("| 标准 | 判定 | 权重 | 依据摘要 | 证据 |");
  lines.push("|------|------|------|---------|------|");
  for (const adj of report.adjudications ?? []) {
    const criterion = criteriaById.get(adj.criterionId);
    const links = (adj.evidenceIds ?? [])
      .map((id) => {
        const ev = evidenceById.get(id);
        return ev ? `[${id}](${ev.uri})` : `${id}(缺失)`;
      })
      .join(" ");
    const kindMark = criterion?.kind === "core" ? "【core】" : "";
    const downgrade = adj.downgradedBy ? `（被 ${adj.downgradedBy} 降级）` : "";
    lines.push(
      `| ${adj.criterionId} ${kindMark}${cell(criterion?.text ?? "(标准缺失)")} | ${VERDICT_LABEL[adj.verdict] ?? adj.verdict}${downgrade} | ${criterion?.weight ?? "?"} | ${cell(adj.rationale ?? "")} | ${links} |`,
    );
  }
  lines.push("");

  lines.push("## 红队对抗");
  lines.push("");
  const rt = report.redTeam ?? {};
  const rtStatus = rt.status === "skipped" ? `skipped（${rt.skipReason ?? "未说明原因"}）` : (rt.status ?? "?");
  lines.push(
    `- 状态：${rtStatus} · 挑战：${challenges.length}（upheld blocker ${upheldBy("blocker")} / major ${upheldBy("major")} / minor ${upheldBy("minor")}）`,
  );
  if (rt.summary) lines.push(`- ${rt.summary}`);
  if ((rt.uncoveredAttackSurface ?? []).length > 0) {
    lines.push(`- 未覆盖攻击面：${rt.uncoveredAttackSurface.join("；")}`);
  }
  if (challenges.length > 0) {
    lines.push("");
    lines.push("| 挑战 | 目标 | 类型 | 严重度 | 主张 | 结果 |");
    lines.push("|------|------|------|--------|------|------|");
    for (const c of challenges) {
      lines.push(
        `| ${c.id} | ${c.targetCriterionId} | ${c.attackType} | ${c.severity} | ${cell(c.claim)} | ${c.outcome}${c.arbitrationNote ? `：${cell(c.arbitrationNote)}` : ""} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 风险与遗留");
  lines.push("");
  const risks = [];
  for (const adj of report.adjudications ?? []) {
    if (adj.verdict === "unverified") risks.push(`${adj.criterionId} 无有效证据，无法认证：${adj.rationale}`);
    if (adj.verdict === "partial") risks.push(`${adj.criterionId} 仅部分达成：${adj.rationale}`);
    if (adj.verdict === "fail") risks.push(`${adj.criterionId} 未达成：${adj.rationale}`);
  }
  for (const c of challenges) {
    if (c.outcome === "upheld" && c.severity === "minor") risks.push(`${c.id}（minor upheld）：${c.claim}`);
  }
  const wb = report.writeBack ?? {};
  if (wb.status === "failed") risks.push(`回写失败（attempts=${wb.attempts ?? "?"}）：${wb.error ?? "未记录错误"}`);
  if (risks.length === 0) lines.push("- 无（本次验证未发现遗留风险）");
  else for (const r of risks) lines.push(`- ${r}`);
  lines.push("");

  lines.push("## 证据清单");
  lines.push("");
  lines.push("| ID | 类型 | 可靠性 | 状态 | 摘要 | 链接 |");
  lines.push("|----|------|--------|------|------|------|");
  for (const ev of report.evidence ?? []) {
    lines.push(
      `| ${ev.id} | ${ev.type} | ${ev.reliability} | ${ev.status} | ${cell(ev.excerpt)} | [${ev.uri}](${ev.uri}) |`,
    );
  }
  lines.push("");
  lines.push(`> 回写：${wb.status ?? "?"}${(wb.targets ?? []).length ? ` → ${(wb.targets ?? []).map((x) => `${x.kind}@${x.ref}`).join("、")}` : ""} · schemaVersion ${report.schemaVersion ?? "?"} · criteriaHash ${report.criteriaHash ?? "未记录"}`);

  return lines.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  // 无文件参数且 stdin 非 TTY = 管道输入；"-" 显式表示 stdin
  if (argv.includes("--help") || argv.includes("-h") || (argv.length === 0 && process.stdin.isTTY)) {
    process.stdout.write("用法: node render-report-md.mjs <report.json>\n  或: cat report.json | node render-report-md.mjs\n退出码: 0 成功 / 1 报告非法 / 2 用法或 IO 错误\n");
    return argv.includes("--help") || argv.includes("-h") ? 0 : 2;
  }
  let raw;
  try {
    raw = argv.length === 0 || argv[0] === "-" ? readFileSync(0, "utf8") : readFileSync(argv[0], "utf8");
  } catch (e) {
    process.stderr.write(`ERROR: 读取报告失败: ${e.message}\n`);
    return 2;
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`ERROR: 报告不是合法 JSON: ${e.message}\n`);
    return 1;
  }
  if (!report.target || !report.verdict || !Array.isArray(report.adjudications)) {
    process.stderr.write("ERROR: 报告缺少 target/verdict/adjudications，请先通过 validate-report.mjs 校验\n");
    return 1;
  }
  process.stdout.write(render(report));
  return 0;
}

process.exit(main());
