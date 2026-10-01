# 机制一：验收标准核对（Criteria Adjudication）

> 上游：[总纲](./README.md) · 下游消费方：[证据链](./02-evidence-chain.md)、[评分与结论](./04-scoring-and-report.md)

## 1. 目标

把自由文本/JSON 形态的验收标准，转换为**编号明确、权重明确、可判定**的标准清单，并对每条独立做出四态判定。核验的最小单元是「单条验收标准」，永远不允许对整份需求做整体性模糊结论。

## 2. 标准解析（S1）

### 2.1 输入形态

| 来源字段 | 形态 | 解析规则 |
|---------|------|---------|
| `Requirement.acceptanceCriteria` | JSON 数组（每项一条）或纯文本 | JSON 优先；纯文本按「编号行 / 空行 / 分号」切分 |
| `Goal.acceptanceCriteria` | 纯文本为主 | 同上；另可从 `subGoals` 标题补充聚合子标准（标记来源 `subgoal`） |
| PR 场景 | 映射到的 Requirement/Goal 的标准集合 | 每条标准保留 `originTarget` 指回来源对象 |

### 2.2 解析输出：Criterion 结构

```json
{
  "id": "AC-01",
  "text": "skill 能逐条输出 pass/fail/partial 判定，且每条判定均附可追溯证据",
  "weight": 1,
  "kind": "core",
  "verifiable": true,
  "originTarget": { "type": "requirement", "id": "…" },
  "parseNote": ""
}
```

- `id`：`AC-` + 两位序号，全报告唯一，判定/证据/挑战均通过它引用。
- `weight`：显式声明（如 `[w:2]`）优先，缺省 1。
- `kind`：`core`（核心）/ `normal`。显式标记（`[core]`、`必须`、`硬性`）优先；无任何标记时全部 `normal`。
- `verifiable`：条目必须是**含可观察谓词的陈述句**（能/必须/至少/不超过/返回…）。不可判定条目（纯愿望式描述、无法观测）标 `verifiable:false`，判定固定为 `unverified`，`parseNote` 说明原因。

### 2.3 解析的确定性要求

- 同一输入两次解析必须产出完全相同的 `Criterion[]`（纯函数，禁止 LLM 参与切分编号）。
- 解析器输出必须可快照（报告里存 `criteriaHash` = 对解析结果的 sha256），防止「验证时标准」与「被验证方声称的标准」错位。
- 空清单 / 解析失败 → 不进入核验，直接产出 `NEEDS_WORK`，缺口注明「无有效验收标准」。

## 3. 逐条核验（S3）

### 3.1 四态判定

| 判定 | 分值 | 判定条件（确定性，按序匹配） |
|------|------|---------------------------|
| `pass` | 1.0 | 存在 ≥1 条**直接或间接**可靠性证据，直接支持该条全部谓词 |
| `partial` | 0.5 | 证据只支持部分谓词；或存在替代实现只覆盖部分场景；或红队 major 挑战 upheld 后由 pass 降级 |
| `fail` | 0.0 | 存在**直接反证**（测试失败、API 返回缺失/错误、代码中无对应实现、文档与行为矛盾） |
| `unverified` | 0.0 | 无证据，或仅有传闻级（agent 自述）证据，或 `verifiable:false` |

匹配顺序即上表顺序：先找反证（fail），再确认全谓词支持（pass），再部分支持（partial），兜底 unverified。**这个顺序不可调换**——宁可误判 partial/fail 也不允许无反证时轻易 pass。

### 3.2 判定记录（Adjudication）强制字段

```json
{
  "criterionId": "AC-01",
  "verdict": "pass",
  "rationale": "CI run #1234 中 verify 相关 12 个用例全部通过，覆盖逐条判定与证据绑定路径",
  "evidenceIds": ["EV-03", "EV-07"],
  "checkedAt": "2026-09-11T12:00:00Z",
  "downgradedBy": null
}
```

- `evidenceIds` 非空是 **schema 层强制约束**（`unverified` 允许空数组，但必须填 `rationale` 说明缺什么证据）。
- `rationale` 必须引用证据内容，不允许「已实现」「已完成」这类结论性空话。
- `downgradedBy`：被红队挑战降级时填 challengeId，形成审计闭环。

### 3.3 特殊场景规则

**Goal（含子目标）**：子目标标准需先核验自身，再核验「父目标聚合断言」（如所有子目标完成）。聚合断言 fail 时，`rationale` 必须列出未达成的子目标 id。

**Requirement**：`gateResult`（准入把关）不作为验收证据——那是入口质量，不是出口质量。但 `gateResult.passed=false` 的需求到达验收环节时，报告需附风险提示。

**PR**：每条标准都要回答「这个 PR 的 diff 是否就是实现该标准的载体」——diff 中无对应改动区域时不得凭「别的 PR 已实现」判 pass，只能 partial（并注明替代实现位置）或 unverified。

### 3.4 输出

`Adjudication[]`（与 Criterion 等长、按 id 对齐），连同未消费的证据清单进入红队阶段。核验过程必须留存「逐条进度输出」（每完成 5 条或单条耗时 >30s 输出一次），避免长静默。
