# Verification Skill 方法论框架（总纲）

> 需求：cmtwygpt8005im9wnm4wyucnj《平台 Verification skill：可对目标/需求/PR 做认证评估的验证技能》
>
> 本文是方法论总纲。四个子机制各有专文：[验收标准核对](./01-criteria-adjudication.md) · [证据链](./02-evidence-chain.md) · [红队对抗](./03-red-team.md) · [评分与报告](./04-scoring-and-report.md)。报告的机器可校验结构见 [verification-report.schema.json](../verification-report.schema.json)。

> 本文为技能内置运行时副本（`std-skills/verification/references/`）；设计源头是 `docs/verification-skill/`（PR #601）。技能目录自包含，注入工作区后不依赖 repo 其它路径；两处演进时以本目录为准同步。

## 0. 定位与设计原则

**一句话定位**：把「声称已完成」变成「可审计的认证」——对 Goal / Requirement / PR 三类对象逐条核验验收标准，产出证据完备、结论确定、可回写平台的结构化验证报告。

五条设计原则（实现与演进时不得违背）：

| # | 原则 | 含义 |
|---|------|------|
| P1 | 证据优先 Evidence-first | 任何 `pass` 判定必须绑定可追溯证据；无证据 = `unverified`，不允许凭叙述通过 |
| P2 | 确定性结论 Deterministic verdict | 结论（CERTIFIED / NEEDS_WORK / REJECTED）由评分与硬门槛规则**机械推导**，不允许主观裁量 |
| P3 | 对抗验证 Adversarial | 自证不等于他证：红队由独立上下文执行，专司推翻 pass 判定 |
| P4 | 可回放 Replayable | 报告记录输入快照与证据 digest，第三方可脱离原会话独立复现核验过程 |
| P5 | 最小侵入 Least intrusion | 回写只新增字段/追加记录，不覆盖对象既有业务语义（如不直接改 Requirement.status） |

## 1. 验证对象模型

三类对象统一抽象为 `VerificationTarget`，方法论对三者共用同一条流水线，差异只在「标准来源、证据来源、回写位置」：

| 对象 | 标识 | 验收标准来源 | 证据来源 | 结论回写位置 |
|------|------|-------------|---------|-------------|
| Goal | `goal:{id}` | `Goal.acceptanceCriteria`（文本或 JSON） | `loopHistory` 的 goal_review 节点复盘（`verification` / `evidenceRef`）、`artifacts`、`evaluation` | `loopHistory` 追加 `{type:'verification'}` 记录（复盘包 buildGoalReviewPacket 可读） |
| Requirement | `requirement:{id}` | `Requirement.acceptanceCriteria` | `gateResult`、关联 PR 的 CI/测试、`agentExecutionTrajectory`、知识文档 | `Requirement.verificationResult`（Json，与 `gateResult` 同构，前端可复用展示） |
| PR | `pr:{repo}#{number}` | 映射到的 Requirement/Goal 的验收标准 | PR diff、CI checks、test runs、review comments | PR 评论（结论徽标）+ 可选 commit status |

```json
{
  "type": "goal | requirement | pr",
  "id": "cmtwygpt8005im9wnm4wyucnj",
  "ref": "平台 API URL 或 repo#number",
  "title": "…",
  "criteriaSource": { "kind": "field", "path": "acceptanceCriteria" },
  "evidenceSources": ["platform_api", "ci", "git", "trajectory"]
}
```

## 2. 方法论总流程（六阶段流水线）

```
S1 标准解析 → S2 证据采集 → S3 逐条核验 → S4 红队对抗 → S5 评分与结论 → S6 报告与回写
        │            │            │            │             │            │
     criteria[]   evidence[]   adjudications  challenges    score+verdict  report+writeBack
```

| 阶段 | 职责 | 关键规则 | 失败处理 |
|------|------|---------|---------|
| S1 标准解析 | 把 acceptanceCriteria 解析为可判定的 `Criterion[]` | 逐条编号 AC-01…；不可判定条目标 `not_verifiable` | 空清单 → 直接 NEEDS_WORK（无标准不可认证），报告注明缺口 |
| S2 证据采集 | 按对象类型拉取证据，产出 `Evidence[]` | 每条证据带 digest 与可靠性分级；PR 场景受 5 分钟总预算约束 | 单源超时 → 标记 `timeout` 降级为间接证据，不阻断整体 |
| S3 逐条核验 | 每条标准独立判定 pass/partial/fail/unverified | 判定必须绑定 evidenceIds + rationale（schema 强制） | 证据仅传闻级 → 强制 unverified |
| S4 红队对抗 | 独立上下文执行反证/抽查/范围三类攻击 | blocker 级 upheld 可降级判定甚至整体 REJECTED | 红队不可用 → 结论封顶 NEEDS_WORK（不允许无对抗即 CERTIFIED） |
| S5 评分与结论 | 加权完成度评分 + 确定性结论映射 | 结论必附机器可读 `reasons[]`（规则命中说明） | 规则冲突按文档固定优先级取更严结论 |
| S6 报告与回写 | 结构化报告 + 回写平台 + 通知 | 幂等（verificationId 区分多次验证）；回写不覆盖业务语义 | 回写失败 → 报告标记 `writeBack.status=failed` 并重试 ≤2 次 |

## 3. 触发场景与编排契约

| 场景 | 触发点 | 对象 | 时延要求 | 编排方式 |
|------|--------|------|---------|---------|
| T1 状态变更自动 | Requirement.status → `done`/待验收；Goal → `completed`/待验收 | 该对象 | 异步 ≤10 分钟 | 状态变更路径挂钩（workflow 节点或路由侧事件） |
| T2 PR 创建/更新 | PR opened / synchronize | PR + 关联需求 | **同步 ≤5 分钟**（验收标准 2） | workflow 节点，预算分配见 02 文档 |
| T3 显式调用 | `/verify <goal:id|requirement:id|pr:repo#n>` | 任意单个对象 | 流式，边验边输出 | agent 技能直接调用 |

PR → 需求映射的确定性优先级（T2 必需，缺失则结论封顶 NEEDS_WORK）：
1. PR 描述中的显式标记 `Req: <requirementId>`（含多条，逐行解析）
2. 分支名与需求/goal 关联（如 `myrd/verification-skill-goal-<runId>` 与 goal 执行记录匹配）
3. commit message 中的 `Refs:/Closes: <id>`
均未命中 → 报告标记 `mappingStatus: "orphan"`。

## 4. 与既有平台实现的衔接（复用清单，不重复造轮子）

| 既有实现 | 位置 | 本方法论如何复用 |
|---------|------|----------------|
| `[GOAL_VERDICT]` 三态协议（achieved/not_achieved/blocked） | `src/services/goal-master-agent/index.ts:984-1025` | Goal 场景结论换算：CERTIFIED→achieved；NEEDS_WORK→not_achieved（gaps=未达标条目）；REJECTED→not_achieved。Verification skill 是 goal_review 的强化版（逐条 AC + 证据链 + 红队），两者并存：goal_review 管「继续/停止」决策，verification 管「对外认证」 |
| GoalReviewPacket 证据锚点 | `src/lib/goal-review-packet.ts`（`nodes[].verification` / `evidenceRef`） | S2 阶段 Goal 证据源的直接读取目标；节点级 `evidenceRef`（分支@commit/PR 号）作为证据 `uri` 的规范化来源 |
| Requirement.gateResult `{passed,score,issues[],summary}` | `prisma/schema.prisma` Requirement 模型 | 回写字段 `verificationResult` 采用同构 shape，前端把关结果展示组件可复用 |
| Skill 组织形态 | `std-skills/<name>/SKILL.md + references/ + scripts/` | 实现落地为 `std-skills/verification/SKILL.md`，方法论四文作为 references，报告校验脚本入 scripts/ |
| 准入把关（Clarify Gate） | `src/routes/requirements-gate.ts` | 同为「机器可审计结论」范式；本 skill 是出口侧把关，与入口侧把关对称 |

## 5. 结论三态与回写（摘要，细则见 04 文档）

- **CERTIFIED**：全部标准 pass 且证据完备且红队无 upheld blocker/major（PR 场景还须需求映射存在）。
- **NEEDS_WORK**：存在 partial / fail（非 core）/ unverified，或红队仅 minor 挑战成立。
- **REJECTED**：任一 core 标准 fail；或红队 ≥2 条 blocker upheld；或证据造假实锤；或 score < 40。

回写均落 `verificationResult`（Requirement）/ `loopHistory` verification 记录（Goal）/ PR 评论（PR），并保留完整报告 JSON 供 API 查询（验收标准 4）。

## 6. 落地路线图（给实现节点）

| 里程碑 | 内容 | 验证方式 |
|--------|------|---------|
| M1 数据模型 | `Requirement.verificationResult Json?`（复用 gateResult 同构） | prisma migrate + 类型导出 |
| M2 核心 engine | `src/services/verification/`：`criteria-parser.ts`、`evidence-collector.ts`、`adjudicator.ts`、`red-team.ts`、`scorer.ts`、`reporter.ts`（纯函数优先，与 GoalReviewPacket 同风格） | 单测：parser/scorer 确定性用例 + schema 契约测试 |
| M3 触发接入 | T1 状态变更挂钩；T2 workflow PR 节点；T3 `/verify` 指令 | 各 1 条端到端用例（验收标准 3） |
| M4 回写与通知 | verificationResult 写回 + PR 评论 + 相关方通知 | API 查询断言（验收标准 4） |
| M5 skill 封装 | `std-skills/verification/`（SKILL.md + references + scripts/validate-report） | 用本需求自身作为第一个被验证对象 |

## 7. 需求验收标准 → 本设计映射（自查表）

| 需求验收标准 | 由哪个机制保证 |
|-------------|---------------|
| 1. 逐条 pass/fail/partial + 可追溯证据 | S1+S3（01 文档）+ 证据链强制绑定（02 文档，schema 校验 `evidenceIds` 非空） |
| 2. PR 场景 5 分钟内出报告且含需求映射 | T2 预算分配（02 文档 §4）+ 映射优先级（本文件 §3） |
| 3. 三类触发各 ≥1 条端到端用例 | §6 M3 的验证方式 |
| 4. 结论三态且回写可查 | §5 确定性映射 + S6 回写契约 |
| 5. 结构化报告字段完整可 API 校验 | `verification-report.schema.json`（required 全覆盖）+ scripts/validate-report |
