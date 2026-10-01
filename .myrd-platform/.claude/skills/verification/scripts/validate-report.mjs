#!/usr/bin/env node
/**
 * Verification skill 出口门禁：结构化验证报告校验（零依赖，仅 Node 内置）。
 *
 * 三层校验（任一层失败即 exit 1，报告不得落库/回写 —— references/04 §4「不允许降级为警告」）：
 *   ① schema：verification-report.schema.json（draft-07 子集自实现，见下方支持关键字）
 *   ② 证据链完整性硬检查（references/02 §5 四条）
 *   ③ 确定性复核：按 references/04 §1/§2 重算评分与结论，与报告声明比对（P2 的机器落点）
 *
 * 用法：
 *   node validate-report.mjs <report.json>        # 校验文件
 *   cat report.json | node validate-report.mjs    # 校验 stdin（管道友好）
 *   node validate-report.mjs <report.json> --schema <schema.json>  # 覆盖默认 schema 位置
 *
 * 退出码：0 通过；1 校验失败（errors 明细逐行输出）；2 用法/IO 错误。
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.resolve(SCRIPT_DIR, "..", "verification-report.schema.json");

/** 校验错误：path 为 JSON Pointer 风格位置，便于定位 */
class ValidationErrors {
  constructor() { this.items = []; }
  add(pointer, message) { this.items.push({ pointer, message }); }
  get empty() { return this.items.length === 0; }
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value; // number / string / boolean / object
}

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function isDateTime(value) {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

/** 递归校验。schemaRoot 用于解析 $ref（#/definitions/...） */
function validateNode(schema, value, pointer, root, errors) {
  if (!schema || typeof schema !== "object") return;

  if (schema.$ref) {
    if (typeof schema.$ref !== "string" || !schema.$ref.startsWith("#/")) {
      errors.add(pointer, `不支持的 $ref: ${schema.$ref}`);
      return;
    }
    let target = root;
    for (const seg of schema.$ref.slice(2).split("/")) {
      target = target?.[seg];
      if (target === undefined) {
        errors.add(pointer, `$ref 无法解析: ${schema.$ref}`);
        return;
      }
    }
    validateNode(target, value, pointer, root, errors);
    return;
  }

  // type：字符串或数组（如 ["string","null"]）
  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    // JSON Schema 语义：integer ⊆ number（JSON 中 1.0 解析即整数）
    const typeOk = expected.includes(actual) || (actual === "integer" && expected.includes("number"));
    if (!typeOk) {
      errors.add(pointer || "/", `类型应为 ${expected.join("|")}，实际 ${actual}`);
      return;
    }
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.add(pointer, `必须等于 ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum !== undefined && !schema.enum.some((v) => deepEqual(v, value))) {
    errors.add(pointer, `值 ${JSON.stringify(value)} 不在枚举 [${schema.enum.join(", ")}] 内`);
  }

  if (typeof value === "string") {
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.add(pointer, `不匹配模式 ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.add(pointer, `长度 ${value.length} < minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.add(pointer, `长度 ${value.length} > maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.add(pointer, `值 ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.add(pointer, `值 ${value} > maximum ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.add(pointer, `值 ${value} <= exclusiveMinimum ${schema.exclusiveMinimum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.add(pointer, `元素数 ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.add(pointer, `元素数 ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => validateNode(schema.items, item, `${pointer}/${i}`, root, errors));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required !== undefined) {
      for (const key of schema.required) {
        if (!(key in value)) errors.add(pointer || "/", `缺少必填字段 ${key}`);
      }
    }
    if (schema.properties !== undefined) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in value) validateNode(sub, value[key], `${pointer}/${key}`, root, errors);
      }
    }
    if (schema.additionalProperties === false && schema.properties !== undefined) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) {
          errors.add(pointer || "/", `不允许的额外字段 ${key}（additionalProperties:false）`);
        }
      }
    }
  }

  if (schema.format === "date-time" && typeof value === "string" && !isDateTime(value)) {
    errors.add(pointer, `不是合法的 ISO8601 date-time: ${value}`);
  }

  if (schema.allOf !== undefined) {
    for (const sub of schema.allOf) validateNode(sub, value, pointer, root, errors);
  }
  if (schema.anyOf !== undefined) {
    const branchErrors = schema.anyOf.map((sub) => {
      const branch = new ValidationErrors();
      validateNode(sub, value, pointer, root, branch);
      return branch;
    });
    if (branchErrors.every((b) => !b.empty)) {
      errors.add(pointer, `anyOf 全部分支不匹配: ${branchErrors.map((b) => b.items.map((e) => e.message).join("; ")).join(" | ")}`);
    }
  }
  if (schema.if !== undefined) {
    const cond = new ValidationErrors();
    validateNode(schema.if, value, pointer, root, cond);
    if (cond.empty && schema.then !== undefined) {
      validateNode(schema.then, value, pointer, root, errors);
    } else if (!cond.empty && schema.else !== undefined) {
      validateNode(schema.else, value, pointer, root, errors);
    }
  }
}

// ---------------------------------------------------------------------------
// ② 证据链完整性 + ③ 评分/结论确定性复核
// ---------------------------------------------------------------------------

const VERDICT_SCORE = { pass: 1, partial: 0.5, fail: 0, unverified: 0 };

/** ② references/02 §5 四条硬检查（fail-fast 语义：全部执行后统一报告） */
function checkEvidenceChain(report, errors) {
  const evidenceById = new Map((report.evidence ?? []).map((e) => [e.id, e]));
  const criterionIds = new Set((report.criteria ?? []).map((c) => c.id));
  const adjudicatedIds = new Set();

  for (const adj of report.adjudications ?? []) {
    adjudicatedIds.add(adj.criterionId);
    if (!criterionIds.has(adj.criterionId)) {
      errors.add(`/adjudications/${adj.criterionId}`, `判定引用了不存在的标准 ${adj.criterionId}`);
    }
    for (const evId of adj.evidenceIds ?? []) {
      const ev = evidenceById.get(evId);
      if (!ev) {
        errors.add(`/adjudications/${adj.criterionId}`, `引用了不存在的证据 ${evId}`);
        continue;
      }
      if (adj.verdict === "pass" && ev.status !== "ok") {
        errors.add(`/adjudications/${adj.criterionId}`, `pass 判定引用了 status=${ev.status} 的证据 ${evId}（非 ok 证据不得支撑 pass）`);
      }
      if (adj.verdict === "pass" && ev.reliability === "hearsay" && adj.evidenceIds.every((id) => evidenceById.get(id)?.reliability === "hearsay")) {
        errors.add(`/adjudications/${adj.criterionId}`, `pass 判定仅引用传闻级证据（hearsay 不得支撑 pass）: ${evId}`);
      }
    }
  }

  // 硬检查 1：pass 判定至少 1 条 direct/indirect 证据（与 ② 中的 hearsay 检查互补，显式给出规则编号）
  for (const adj of report.adjudications ?? []) {
    if (adj.verdict !== "pass") continue;
    const solid = (adj.evidenceIds ?? []).some((id) => {
      const r = evidenceById.get(id)?.reliability;
      return r === "direct" || r === "indirect";
    });
    if (!solid) errors.add(`/adjudications/${adj.criterionId}`, "硬检查①：pass 判定没有 direct/indirect 证据支撑");
  }

  // 硬检查 3：每条标准至少出现在一条判定中（无遗漏）
  for (const c of report.criteria ?? []) {
    if (!adjudicatedIds.has(c.id)) {
      errors.add(`/criteria/${c.id}`, "硬检查③：标准没有任何判定记录（标准无遗漏）");
    }
  }
  // 硬检查 4 的格式部分由 schema digest pattern 承担；同源性（生成时计算）属过程约束，见 SKILL.md §3。
}

/** ③ 按 references/04 §1/§2 重算 counts/score 与结论三态，返回 {errors, computed} */
function recomputeScoringAndVerdict(report, errors) {
  const adj = report.adjudications ?? [];
  const criteriaById = new Map((report.criteria ?? []).map((c) => [c.id, c]));
  const counts = { pass: 0, partial: 0, fail: 0, unverified: 0 };
  let weightSum = 0;
  let weightedSum = 0;

  for (const a of adj) {
    counts[a.verdict] = (counts[a.verdict] ?? 0) + 1;
    const w = criteriaById.get(a.criterionId)?.weight;
    if (typeof w !== "number" || w <= 0) continue;
    weightSum += w;
    weightedSum += w * VERDICT_SCORE[a.verdict];
  }

  const total = (report.criteria ?? []).length;
  const score = weightSum > 0 ? Math.round((weightedSum / weightSum) * 100) : 0;

  // scoring 与判定集合一致性
  const s = report.scoring ?? {};
  if (s.passed !== counts.pass || s.partial !== counts.partial || s.failed !== counts.fail || s.unverified !== counts.unverified) {
    errors.add("/scoring", `四态计数与判定不一致：报告 {passed:${s.passed},partial:${s.partial},failed:${s.failed},unverified:${s.unverified}}，重算 {passed:${counts.pass},partial:${counts.partial},failed:${counts.fail},unverified:${counts.unverified}}`);
  }
  if (s.total !== total) errors.add("/scoring", `total=${s.total} 与标准数 ${total} 不一致`);
  if (s.score !== score) errors.add("/scoring", `score=${s.score} 与重算值 ${score} 不一致（公式见 references/04 §1.2）`);

  // breakdown 与判定逐条对齐
  const breakdownById = new Map((s.breakdown ?? []).map((b) => [b.criterionId, b]));
  for (const a of adj) {
    const b = breakdownById.get(a.criterionId);
    if (!b) {
      errors.add("/scoring/breakdown", `缺少 ${a.criterionId} 的分值明细`);
      continue;
    }
    if (b.verdict !== a.verdict) errors.add(`/scoring/breakdown/${a.criterionId}`, `breakdown.verdict=${b.verdict} 与判定 ${a.verdict} 不一致`);
    const w = criteriaById.get(a.criterionId)?.weight;
    if (typeof w === "number" && Math.abs(b.weighted - w * VERDICT_SCORE[a.verdict]) > 1e-9) {
      errors.add(`/scoring/breakdown/${a.criterionId}`, `weighted=${b.weighted} 应为 weight(${w}) × 分值(${VERDICT_SCORE[a.verdict]})`);
    }
  }

  // 结论三态重算（按序匹配，命中即停）
  const challenges = report.redTeam?.challenges ?? [];
  const upheldBlocker = challenges.filter((c) => c.outcome === "upheld" && c.severity === "blocker");
  const upheldMajor = challenges.filter((c) => c.outcome === "upheld" && c.severity === "major");
  const evidenceById = new Map((report.evidence ?? []).map((e) => [e.id, e]));
  const fraudAdj = adj.filter((a) => a.verdict === "pass" && (a.evidenceIds ?? []).some((id) => ["digest_mismatch", "unreachable"].includes(evidenceById.get(id)?.status)));
  const coreFails = adj.filter((a) => a.verdict === "fail" && criteriaById.get(a.criterionId)?.kind === "core");
  const isPr = report.target?.type === "pr";
  const mappingStatus = report.prMapping?.status;

  let value;
  const reasons = [];
  if (coreFails.length > 0) {
    value = "REJECTED";
    reasons.push(`RULE_CORE_FAIL: ${coreFails.map((a) => a.criterionId).join(",")}`);
  } else if (upheldBlocker.length >= 2) {
    value = "REJECTED";
    reasons.push(`RULE_REDTEAM_BLOCKER_X2: ${upheldBlocker.map((c) => c.id).join(",")}`);
  } else if (fraudAdj.length > 0) {
    value = "REJECTED";
    reasons.push(`RULE_EVIDENCE_FRAUD: ${fraudAdj.map((a) => `${a.criterionId}(${(a.evidenceIds ?? []).join("+")})`).join(", ")}`);
  } else if (score < 40) {
    value = "REJECTED";
    reasons.push(`RULE_SCORE_TOO_LOW: ${score}`);
  } else if (
    counts.fail === 0 && counts.unverified === 0 && counts.partial === 0 &&
    report.redTeam?.status === "completed" && // P3：无对抗不得 CERTIFIED（红队 skipped 封顶 NEEDS_WORK）
    upheldBlocker.length === 0 && upheldMajor.length === 0 &&
    (!isPr || mappingStatus === "mapped")
  ) {
    value = "CERTIFIED";
    reasons.push(`RULE_ALL_PASS: ${adj.map((a) => a.criterionId).join(",")}`);
    reasons.push(`RULE_REDTEAM_CLEAN: upheld blocker=${upheldBlocker.length} major=${upheldMajor.length}`);
    if (isPr) reasons.push(`RULE_MAPPING_MAPPED: ${(report.prMapping?.requirements ?? []).concat(report.prMapping?.goals ?? []).join(",")}`);
  } else {
    value = "NEEDS_WORK";
    const fails = adj.filter((a) => a.verdict === "fail");
    if (fails.length > 0) reasons.push(`RULE_FAIL_PRESENT: ${fails.map((a) => a.criterionId).join(",")}`);
    const partials = adj.filter((a) => a.verdict === "partial");
    if (partials.length > 0) reasons.push(`RULE_PARTIAL_PRESENT: ${partials.map((a) => a.criterionId).join(",")}`);
    const unverifieds = adj.filter((a) => a.verdict === "unverified");
    if (unverifieds.length > 0) reasons.push(`RULE_UNVERIFIED_PRESENT: ${unverifieds.map((a) => a.criterionId).join(",")}`);
    if (upheldBlocker.length > 0) reasons.push(`RULE_REDTEAM_BLOCKER_UPHELD: ${upheldBlocker.map((c) => c.id).join(",")}`);
    if (upheldMajor.length > 0) reasons.push(`RULE_REDTEAM_MAJOR_UPHELD: ${upheldMajor.map((c) => c.id).join(",")}`);
    if (report.redTeam?.status !== "completed") reasons.push("RULE_REDTEAM_NOT_COMPLETED: 无对抗不得 CERTIFIED，封顶 NEEDS_WORK");
    if (isPr && mappingStatus !== "mapped") reasons.push("RULE_MAPPING_ORPHAN: prMapping.status != mapped");
  }

  if (report.verdict?.value !== value) {
    errors.add("/verdict/value", `结论 ${report.verdict?.value} 与确定性重算值 ${value} 不一致（规则见 references/04 §2；reasons 提示：${reasons.join("；")}）`);
  }

  return { value, score, counts };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readReport(argv) {
  const hasFile = argv.length > 0 && !argv[0].startsWith("--");
  if (hasFile) return readFileSync(argv[0], "utf8");
  if (argv.includes("--help") || argv.includes("-h")) return null;
  return readFileSync(0, "utf8"); // stdin
}

function main() {
  const argv = process.argv.slice(2);
  // 无文件参数且 stdin 非 TTY = 管道输入（cat report.json | node validate-report.mjs）
  if (argv.includes("--help") || argv.includes("-h") || (argv.length === 0 && process.stdin.isTTY)) {
    process.stdout.write(
      "用法: node validate-report.mjs <report.json> [--schema <schema.json>]\n" +
      "  或: cat report.json | node validate-report.mjs\n" +
      "退出码: 0 通过 / 1 校验失败 / 2 用法或 IO 错误\n",
    );
    return argv.includes("--help") || argv.includes("-h") ? 0 : 2;
  }

  let reportRaw;
  try {
    reportRaw = readReport(argv);
  } catch (e) {
    process.stderr.write(`ERROR: 读取报告失败: ${e.message}\n`);
    return 2;
  }

  let report;
  try {
    report = JSON.parse(reportRaw);
  } catch (e) {
    process.stderr.write(`ERROR: 报告不是合法 JSON: ${e.message}\n`);
    return 1;
  }

  const schemaIdx = argv.indexOf("--schema");
  const schemaPath = schemaIdx >= 0 ? path.resolve(argv[schemaIdx + 1]) : DEFAULT_SCHEMA;
  let schema;
  try {
    schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  } catch (e) {
    process.stderr.write(`ERROR: 读取 schema ${schemaPath} 失败: ${e.message}\n`);
    return 2;
  }

  const errors = new ValidationErrors();

  // ① schema
  validateNode(schema, report, "", schema, errors);

  // ② 证据链 + ③ 确定性复核（schema 失败仍继续跑，一次给出全量问题）
  let computed = null;
  try {
    checkEvidenceChain(report, errors);
    computed = recomputeScoringAndVerdict(report, errors);
  } catch (e) {
    errors.add("/", `复核过程异常（报告结构可能严重不完整）: ${e.message}`);
  }

  if (!errors.empty) {
    process.stderr.write(`FAIL ${report.reportId ?? "(无 reportId)"}: ${errors.items.length} 处问题\n`);
    errors.items.forEach((e, i) => process.stderr.write(`  ERROR[${i}] ${e.pointer || "/"}: ${e.message}\n`));
    return 1;
  }

  const totalCount = computed.counts.pass + computed.counts.partial + computed.counts.fail + computed.counts.unverified;
  process.stdout.write(
    `OK ${report.reportId}: verdict=${computed.value} score=${computed.score} ` +
    `(pass ${computed.counts.pass} partial ${computed.counts.partial} fail ${computed.counts.fail} unverified ${computed.counts.unverified} total ${totalCount})\n`,
  );
  return 0;
}

process.exit(main());
