---
name: verification
description: "平台 Verification skill：对目标（Goal）、需求（Requirement）、PR（Pull Request）做认证评估。逐条核验验收标准（pass/partial/fail/unverified，每条判定绑定可追溯证据）、红队对抗核验结果、确定性评分与三态结论（CERTIFIED / NEEDS_WORK / REJECTED），产出结构化验证报告并回写平台。当任务是对目标/需求/PR 做验收、认证、核验评估、完成度判定，或用户要求 /verify 时使用。"
---

# Verification Skill（平台认证评估）

> 一句话定位：**把「声称已完成」变成「可审计的认证」**。
> 对象是 Goal / Requirement / PR 三类；方法是一条六阶段流水线；出口是一道机器门禁
> （`scripts/validate-report.mjs`）——没过门禁的报告不允许落库、不允许回写平台。

---

## 0. 何时用本技能 / 资产清单

**触发**（对应需求验收标准 3 的三类场景）：

| 场景 | 触发点 | 对象 | 时延要求 |
|------|--------|------|---------|
| T1 状态变更自动 | Requirement.status → done/待验收；Goal → completed/待验收 | 该对象 | 异步 ≤10 分钟 |
| T2 PR 创建/更新 | PR opened / synchronize | PR + 关联需求 | **同步 ≤5 分钟** |
| T3 显式调用 | 用户 `/verify <goal:id\|requirement:id\|pr:repo#n>` | 任意单个对象 | 流式，边验边输出 |

**本技能目录**（注入到 `.myrd-platform/.claude/skills/verification/`，或仓库内 `std-skills/verification/`）：

| 资产 | 用途 |
|---|---|
| `references/README.md` | 方法论总纲：对象模型、六阶段流水线、触发契约、落地路线图、验收自查表 |
| `references/01-criteria-adjudication.md` | 验收标准解析与四态判定（S1/S3 的完整规则） |
| `references/02-evidence-chain.md` | 证据结构、可靠性三级、采集纪律、完整性硬检查、回放与撤销 |
| `references/03-red-team.md` | 红队独立性硬约束、三类攻击、确定性仲裁、不可用降级 |
| `references/04-scoring-and-report.md` | 评分公式、结论三态映射、报告模板、回写契约 |
| `verification-report.schema.json` | 报告 JSON Schema（draft-07），字段完整性的唯一依据 |
| `scripts/validate-report.mjs` | **出口门禁**：schema + 证据链完整性 + 评分/结论确定性复核（零依赖，Node 内置） |
| `scripts/render-report-md.mjs` | 报告 → Markdown（PR 评论 / 通知用，与 04 §5 模板逐字段对应） |
| `scripts/resolve-pr-mapping.mjs` | PR→需求/Goal 映射解析（三级优先级纯函数，stdin 进 stdout 出） |
| `scripts/selftest.mjs` | 门禁自测：正例 + 反例双向用例，改脚本后必跑 |
| `examples/sample-report.json` | Requirement 场景样例（NEEDS_WORK 路径） |
| `examples/sample-report-pr.json` | PR 场景样例（CERTIFIED 路径，含 prMapping） |

> 方法论源头是 `docs/verification-skill/`（PR #601）；本目录为自包含运行时副本，注入工作区后不依赖 repo 其它路径。schema 相对源头有一处**向后兼容扩展**：新增可选 `prMapping`（PR 场景必填），承载 PR→需求映射（验收标准 2），并使 CERTIFIED 规则 2c 可机判。

---

## 1. 五条设计原则（全程不得违背）

| # | 原则 | 一句话 |
|---|------|--------|
| P1 | 证据优先 | 无证据不判 pass；无证据 = unverified |
| P2 | 确定性结论 | 结论由评分与硬门槛规则机械推导，禁止主观裁量 |
| P3 | 对抗验证 | 红队独立上下文执行；无对抗不得 CERTIFIED |
| P4 | 可回放 | 证据带 digest，第三方可脱离原会话复现核验 |
| P5 | 最小侵入 | 回写只追加，不覆盖对象既有业务语义 |

---

## 2. 六阶段流水线（S1→S6）

```
S1 标准解析 → S2 证据采集 → S3 逐条核验 → S4 红队对抗 → S5 评分与结论 → S6 报告与回写
 criteria[]    evidence[]   adjudications  challenges    score+verdict  report+writeBack
```

| 阶段 | 你要做什么 | 硬规则 |
|------|-----------|--------|
| S1 | 把验收标准解析为编号 `Criterion[]`（AC-01…） | 纯手工规则切分也要确定性；空清单 → 直接 NEEDS_WORK；不可判定条目 `verifiable:false` |
| S2 | 按对象类型拉证据，每条算 digest | 证据全走既有 API/CLI（gh / git / 平台 REST）；不可达 → 不得被引用。**先读工作区 `.myrd-platform/FEATURE_MAP.md`**（若存在）：按受影响功能条目的「前置状态 → 入口 → 验证步骤」逐条对照采集证据，而非自由发挥；地图缺失/条目不覆盖时按既有方式采集 |
| S3 | 每条标准独立四态判定 | 判定顺序不可调换：先反证(fail) → 全谓词支持(pass) → 部分支持(partial) → 兜底(unverified) |
| S4 | 独立上下文红队攻击 | 只发挑战不改判；不可用 → 结论封顶 NEEDS_WORK，不许静默跳过 |
| S5 | 加权评分 + 三态结论 | 命中即停；结论必附机器可读 `reasons[]`（`RULE_*:` 前缀） |
| S6 | 报告落盘 → 过门禁 → 回写 | **validate 不过 = 报告不存在**；回写重试 ≤2 次，失败标记 `writeBack.status=failed` |

各阶段完整规则（判定条件、权重标记、特殊场景）见 `references/01`～`04`，本文件只保留执行所需的速查表。

---

## 3. 快速上手：一次显式验证（T3）的完整命令序列

```bash
SKILL_DIR=<技能目录>   # 注入后是 .myrd-platform/.claude/skills/verification；仓库内是 std-skills/verification

# ⓪ 读功能导航地图（存在时）：按「验证步骤」逐条对照采集证据（入口/前置/预期结果都在条目里）
cat .myrd-platform/FEATURE_MAP.md 2>/dev/null

# ① 取对象与标准（平台 API 优先；PR 用 gh）
curl -s "$MYRD_API/api/v1/requirements/<id>" | jq '{title, acceptanceCriteria}'
gh pr view <n> --repo <owner/repo> --json title,body,headRefName,commits,statusCheckRollup

# ② PR→需求映射（纯函数，stdin 进 stdout 出）
gh pr view <n> --repo <owner/repo> --json body,headRefName,commits \
  | node "$SKILL_DIR/scripts/resolve-pr-mapping.mjs"

# ③ 采集证据：每条证据记录 uri + digest + excerpt + reliability
#    digest 统一算法：sha256(证据核心内容全文)；excerpt ≤200 字符
git log --oneline -5 origin/<branch>                                   # git_commit
gh pr diff <n> --repo <owner/repo> | shasum -a 256                      # pr_diff
shasum -a 256 <测试输出文件>                                             # test_run / log

# ④ 逐条判定 → 填报告 JSON（以 examples/ 两份样例为骨架）

# ⑤ 出口门禁：不过 = 报告不存在，禁止落库/回写
node "$SKILL_DIR/scripts/validate-report.mjs" report.json

# ⑥ 渲染人类可读报告（PR 评论 / 通知附件）
node "$SKILL_DIR/scripts/render-report-md.mjs" report.json > verification-report.md
```

PR 场景（T2）总预算 5 分钟，按 `references/02` §4.2 分配：映射 30s / diff 60s / CI 120s / 红队 60s / 报告与回写 30s / 缓冲 30s。**任一阶段超时即降级并继续，禁止整体挂死**；diff 拿不到 → REJECTED，CI 没跑完 → 相关标准 unverified 且封顶 NEEDS_WORK。

---

## 4. 判定与评分速查表

### 4.1 四态判定（顺序不可调换）

| 判定 | 分值 | 条件 |
|------|------|------|
| pass | 1.0 | ≥1 条 direct/indirect 证据直接支持全部谓词 |
| partial | 0.5 | 只支持部分谓词；或替代实现只覆盖部分场景；或红队 major upheld 降级 |
| fail | 0.0 | 存在直接反证（测试失败 / API 缺失 / 无对应实现 / 文档与行为矛盾） |
| unverified | 0.0 | 无证据，或仅传闻级（agent 自述）证据，或 `verifiable:false` |

- `pass` 的 `evidenceIds` 必须含 ≥1 条 direct/indirect（hearsay 不得单独支撑 pass）。
- `rationale` 必须引用证据内容；「已实现」「已完成」这类结论性空话不合格。
- 判定记录四强制字段：`criterionId / verdict / rationale / evidenceIds / checkedAt`（schema 强制）。

### 4.2 评分（确定性公式）

```
score = round( Σ(weight_i × verdict_i) / Σ(weight_i) × 100 )
```

`scoring.breakdown` 逐条给 `weighted = weight × 分值`，分数必须可手算复核；`weight` 显式声明（`[w:2]`）优先，缺省 1；`kind` 显式标记（`[core]`/`必须`/`硬性`）为 core，否则 normal。

### 4.3 结论三态（按序匹配，命中即停）

| 顺序 | 结论 | 命中条件（任一） |
|------|------|----------------|
| 1 | REJECTED | a) 任一 core 标准 fail；b) 红队 blocker upheld ≥2；c) 证据造假实锤（digest_mismatch/unreachable 却被判 pass）；d) score < 40 |
| 2 | CERTIFIED | a) failed=0 ∧ unverified=0 ∧ partial=0；b) 无 upheld blocker/major；c) PR 场景映射非 orphan |
| 3 | NEEDS_WORK | 其余一切情况 |

`validate-report.mjs` 会按同一规则**重算评分与结论**并与报告比对——不一致即校验失败。这是 P2（确定性结论）的机器落点，不要试图手工绕过。

---

## 5. 红队对抗（S4 执行要点）

1. **独立性硬约束**：红队必须用**新会话/子 agent**执行，只喂给它：标准清单、判定结果（含 rationale）、证据清单（uri+digest）；不给核验者的中间推理。
2. **三类攻击**：反证（每条 pass 至少 1 个反例：空值/超长/并发/重复执行/量词反例）、证据抽查（≥20% 且 ≥2 条被 pass 引用的证据，indirect 优先，查 uri 可达 + digest 一致 + excerpt 对得上）、范围（diff 副作用：删测试/放宽断言/绕校验/安全红线——发现即 blocker）。
3. **仲裁机械化**：核验侧一轮补证机会 → 提供不出即 upheld；blocker upheld → 判定改 fail（core 则整体 REJECTED）；major upheld → pass 降 partial（`downgradedBy` 记 challengeId）；minor → 记录不改判。
4. **降级路径**：红队超时/不可用 → `redTeam.status="skipped"` + skipReason，结论封顶 NEEDS_WORK。超时未覆盖的攻击点列进 `uncoveredAttackSurface`，不许含糊带过。

---

## 6. 报告与回写（S6）

**报告字段完整性以 schema 为准**（顶层必填 13 项 + PR 场景 `prMapping`）；`validate-report.mjs` 同时执行证据链四条硬检查：

1. 每条 pass 判定至少引用 1 条 direct/indirect 证据；
2. pass 引用的证据 `status` 必须为 `ok`（unreachable/timeout/digest_mismatch 不得被 pass 引用）；
3. 每条 criterion 至少出现在一条判定中（标准无遗漏）；
4. digest 为合法 sha256 格式（生成时计算，非事后补填）。

**回写契约**（幂等：每次验证唯一 `reportId`；追加式，审计链只增不删）：

| 对象 | 回写动作 | 通知 |
|------|---------|------|
| Requirement | `verificationResult`（与 gateResult 同构：`{passed, score, issues, summary}` + reportRef），保留最近 3 次 | NEEDS_WORK/REJECTED → assignee；CERTIFIED → author/owner |
| Goal | `loopHistory` 追加 `{type:'verification', verdict, score, reportRef, timestamp}`；报告全文存 artifacts | NEEDS_WORK/REJECTED → 执行 agent 所在 channel |
| PR | `render-report-md.mjs` 渲染结果发 PR 评论；（可选）commit status：CERTIFIED→success / NEEDS_WORK→neutral / REJECTED→failure | 评论 @ 产出者 |

与既有平台协议的换算：CERTIFIED → `[GOAL_VERDICT] achieved` / `{passed:true}`；NEEDS_WORK → `not_achieved`（gaps=非 pass 条目）/ `{passed:false}`；REJECTED → `not_achieved`（gaps 含 REJECTED 原因）。Goal 场景与 goal_review 分工：goal_review 管「继续/停止」决策，verification 管「对外认证」。

**活文档闭环（S6 收尾，可选但推荐）**：本次验证中若发现 FEATURE_MAP.md 条目漂移（入口路径变了、前置状态不对、验证步骤不可复现、预期结果与实际不符），顺手 Edit 该条目修正（`[curated]` 标记的条目照改，人工会复审）。地图由此在使用中保鲜，而不是等定时任务重扫。

---

## 7. 执行纪律（与平台防卡死规范对齐）

- 采集与核验全程流式输出进度：每完成 5 条证据/判定，或单条 >30s，必须输出一行进度。
- 单条命令 60s 无输出即中止（SIGTERM→10s SIGKILL）并报告，按阶段降级规则继续，不整体挂死。
- 三类证据来源（gh / git / 平台 API）全部非交互调用；凭据缺失属于环境阻塞，显式失败上报而非空转。

---

## 8. 自测与维护

```bash
# 改任何脚本后必跑（正例 + 反例双向，含 validator/renderer/mapping 三件套）
node "$SKILL_DIR/scripts/selftest.mjs"
```

- 新增校验规则时：先在 `selftest.mjs` 加一条**必须被拒绝**的反例，再改 validator。
- schema 只允许向后兼容扩展（新增可选字段）；动 `required` 或收紧既有字段属于破坏性变更，需同步 `docs/verification-skill/` 设计源头并升级 `schemaVersion`。
- 撤销历史报告走 `writeBack.status="revoked"` 追加记录，不删除原报告（审计链只增不删）。
