# 机制三：红队对抗（Red Team Adversarial Pass）

> 上游：[逐条核验](./01-criteria-adjudication.md)与[证据链](./02-evidence-chain.md) · 下游：[评分与结论](./04-scoring-and-report.md)

## 1. 目标

核验者与被核验产物往往同源（同一个 agent 产出并自证），存在系统性「自证偏置」。红队是**独立于核验者的第二意见**，其唯一职责是推翻已有判定——红队不负责补充正面证据。

## 2. 独立性要求（硬约束）

| 约束 | 内容 |
|------|------|
| 上下文独立 | 红队必须在新会话/新 agent 实例中执行，禁止复用核验者的对话上下文与推理链 |
| 输入受限 | 红队只拿到：标准清单、判定结果（含 rationale）、证据清单（uri+digest）。**不给**核验者的中间推理过程 |
| 目标单一 | 红队 KPI 是「找到能推翻判定的问题」，不允许输出「整体不错」式总结 |
| 结论权 | 红队只有「挑战权」，最终改判由仲裁规则（§5）机械执行，不允许双方协商折中 |

## 3. 三类攻击

### 3.1 反证攻击（Falsification）

对**每一条 pass / partial 判定**主动构造反例：

- 边界输入：空值、超长、并发、重复执行、极端数据；
- 未覆盖场景：验收标准里的「任一」「所有」量词逐个构造反例；
- 时序/幂等：重跑一次验证，结果是否稳定。

产出：每条 pass 至少尝试 1 个反例；尝试成功（反例成立）→ 挑战。

### 3.2 证据真实性抽查（Evidence Probing）

- 抽样规则：**≥20% 且 ≥2 条**被 pass 引用的证据（不足 2 条全查）。
- 抽查内容：`uri` 可达、`digest` 与现取内容一致、`excerpt` 确实支持对应判定的 rationale。
- `indirect` 级证据优先抽（非现场产生，风险最高）。
- 任一抽查失败（digest 不符/不可达/excerpt 张冠李戴）→ blocker 级挑战，并触发对该证据**全量**复核。

### 3.3 范围攻击（Scope Attack）

检查「标准之外但实质破坏交付」的问题，主要面向 PR 场景：

- diff 引入的明显副作用（删掉的测试、放宽的断言、被绕过的校验）；
- 报告声明覆盖的范围 vs 实际改动范围不匹配；
- 安全红线（凭据、注入、权限提升）无论是否在标准内，发现即 blocker。

## 4. 挑战（Challenge）结构

```json
{
  "id": "RT-01",
  "targetCriterionId": "AC-03",
  "attackType": "falsification | probing | scope",
  "severity": "blocker | major | minor",
  "claim": "断言 AC-03 的 pass 不成立：并发场景下状态回写丢失",
  "evidenceIds": ["EV-11"],
  "outcome": "upheld | overturned",
  "arbitrationNote": ""
}
```

严重度定义：
- `blocker`：推翻判定核心主张，或触及证据造假/安全红线；
- `major`：判定主张在重要场景不成立（判定应从 pass 降 partial）；
- `minor`：瑕疵但不影响主张（记录，不改判）。

## 5. 仲裁规则（确定性，禁止协商）

红队提交挑战后，仲裁按以下顺序机械执行：

1. **反证复核**：核验侧（原核验者）获得**一轮**补充直接证据的机会（如现场重跑测试）；提供不出 → 挑战 upheld。
2. **upheld 的效力**：
   - blocker upheld → 目标判定改 `fail`；若目标为 core 标准 → 整体结论直接 REJECTED；
   - major upheld → 目标判定由 pass 降 `partial`（`downgradedBy` 记 challengeId）；
   - minor upheld → 不改判，计入报告风险清单。
3. **overturned 的效力**：挑战被更强直接证据驳回 → 不改判，仲裁说明留档（审计要求：每次 overturn 必须写明依据的证据 id）。
4. **统计效力**：单次验证中 blocker upheld ≥2 → 整体 REJECTED（系统性不可信，逐条修补已无意义）。

## 6. 红队不可用的降级路径

红队执行失败（超时、实例不可用）**不允许静默跳过**：

- 报告 `redTeam.status = "skipped"`，附失败原因；
- 结论封顶 `NEEDS_WORK`（总纲 P3：无对抗不得 CERTIFIED）。

## 7. 对红队自身的质量约束

- 挑战必须绑定证据或可复现步骤，纯观点不构成挑战；
- 红队不得修改判定，只能产出挑战与证据；
- 时间盒：PR 场景红队总预算 60s（见 02 文档 §4.2），Goal/Requirement 场景 ≤10 分钟；超时未完成的攻击点在报告中列为「未覆盖攻击面」而非含糊带过。
