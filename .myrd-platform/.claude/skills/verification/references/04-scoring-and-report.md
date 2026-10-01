# 机制四：评分与报告（Scoring & Report）

> 上游：[逐条核验](./01-criteria-adjudication.md)、[证据链](./02-evidence-chain.md)、[红队对抗](./03-red-team.md) · 报告机器校验：[verification-report.schema.json](../verification-report.schema.json)

## 1. 完成度评分（确定性公式）

### 1.1 判定分值

| 判定 | 分值 |
|------|------|
| pass | 1.0 |
| partial | 0.5 |
| fail | 0.0 |
| unverified | 0.0 |

### 1.2 加权完成度

```
score = round( Σ(weight_i × score_i) / Σ(weight_i) × 100 )    // Σweight_i > 0，否则 S1 已拦截
```

- `core` 标准不额外加权（core 的意义在结论门槛，不在分值放大）；
- 分值明细进 `scoring.breakdown`（每条：id、verdict、weighted），保证分数可手算复核。

### 1.3 聚合视图

`scoring` 同时给出四态计数（passed/partial/failed/unverified/total），前端可直接渲染进度条与四态分布。

## 2. 结论三态映射（确定性规则，按序判定，禁止裁量）

按下列顺序匹配，**命中即停**：

| 顺序 | 结论 | 命中条件（任一） |
|------|------|----------------|
| 1 | `REJECTED` | a) 任一 `core` 标准 `fail`；b) 红队 blocker upheld ≥2；c) 证据造假实锤（digest_mismatch 或 unreachable 却被判 pass）；d) `score < 40` |
| 2 | `CERTIFIED` | a) 四态计数满足 `failed=0 ∧ unverified=0 ∧ partial=0`；b) 红队无 upheld blocker/major；c) PR 场景：需求映射存在（非 orphan） |
| 3 | `NEEDS_WORK` | 其余一切情况 |

结论必须附机器可读 `reasons[]`，格式 `RULE_<名称>: <参数>`，例：

```json
{ "value": "NEEDS_WORK", "reasons": ["RULE_UNVERIFIED_PRESENT: AC-05", "RULE_PARTIAL_PRESENT: AC-02,AC-07"] }
```

**禁止**：输出三态之外的值（对应需求验收标准 4）；「基本完成」「大致通过」等模糊结论；无 reasons 的结论。

## 3. 与既有平台协议的换算

| Verification 结论 | `[GOAL_VERDICT]`（Goal 场景） | `gateResult` 同构字段（Requirement 场景） |
|------------------|------------------------------|----------------------------------------|
| CERTIFIED | `achieved` | `{passed: true, score, issues: [], summary}` |
| NEEDS_WORK | `not_achieved`（gaps = 非 pass 条目） | `{passed: false, score, issues: 缺口清单, summary}` |
| REJECTED | `not_achieved`（gaps 含 REJECTED 原因） | `{passed: false, score, issues, summary}` |

## 4. 结构化报告（JSON，字段以 schema 为准）

顶层必填（对应需求验收标准 5）：验证对象 `target`、时间 `createdAt`/`durationMs`、逐条判定明细 `criteria[]`+`adjudications[]`、完成度评分 `scoring`、结论 `verdict`、证据清单 `evidence[]`。其余：`redTeam`、`writeBack`、`triggeredBy`、`criteriaHash`。

机器校验：实现 `scripts/validate-report.mjs`（Node 内置无依赖，ajv 可选），在报告落库/回写前强制执行——校验失败即生成失败，不允许降级为警告。

## 5. 人类可读报告模板（Markdown）

```markdown
# 验证报告：<对象标题>

- 报告 ID：<reportId> · 结论：<CERTIFIED|NEEDS_WORK|REJECTED>
- 验证对象：<type>:<id>（<ref>）
- 触发：<scenario> · 完成：<时间> · 耗时：<durationMs>
- 完成度：<score>/100（pass x/n · partial x/n · fail x/n · unverified x/n）

## 结论依据
- RULE_…: …（逐条列出）

## 逐条判定
| 标准 | 判定 | 依据摘要 | 证据 |
|------|------|---------|------|
| AC-01 <文本> | pass | <rationale 摘要> | [EV-01](<uri>) |

## 红队对抗
- 状态：<completed|skipped> · 挑战：<n>（upheld blocker x / major x / minor x）
| 挑战 | 目标 | 类型 | 严重度 | 结果 |
|------|------|------|--------|------|
| RT-01 | AC-03 | falsification | major | upheld → pass 降 partial |

## 风险与遗留
- …

## 证据清单
| ID | 类型 | 可靠性 | 摘要 | 链接 |
|----|------|--------|------|------|
| EV-01 | test_run | direct | 12 passed | <uri> |
```

渲染规则：表格列固定，判定与结论使用文本徽标（禁止 emoji 图标，符合项目规范）；证据一律超链接到 `uri`。

## 6. 回写与通知（S6 契约）

| 对象 | 回写动作 | 通知 |
|------|---------|------|
| Requirement | `verificationResult` = `{reportId, verdict, score, reasons, adjudications 摘要, evidence 摘要, updatedAt}`（与 gateResult 同构，可数组追加保留最近 3 次） | NEEDS_WORK/REJECTED → 通知 assignee；CERTIFIED → 通知 author/owner |
| Goal | `loopHistory` 追加 `{type:'verification', verdict, score, reportRef, timestamp}`（复盘包可读；报告全文存 artifacts） | NEEDS_WORK/REJECTED → 通知执行 agent 所在 channel |
| PR | PR 评论（第 5 节模板渲染）+（可选）commit status：CERTIFIED→success，NEEDS_WORK→neutral，REJECTED→failure | 评论 @ 产出者 |

幂等与追溯：每次验证生成唯一 `reportId`；回写为**追加式**（保留历史，取 latest 生效），审计链只增不删；撤销走 `REVOKED` 标记（02 文档 §6）。
