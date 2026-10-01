# 机制二：证据链（Evidence Chain）

> 上游：[验收标准核对](./01-criteria-adjudication.md) · 下游消费方：[红队对抗](./03-red-team.md)、[评分与结论](./04-scoring-and-report.md)

## 1. 目标

让每一条判定**可追溯、可复核、可回放**。证据链是认证结论的唯一事实来源：红队攻击证据，评分采信证据，「可审计」三个字完全落在这一层。

## 2. 证据（Evidence）结构

```json
{
  "id": "EV-03",
  "type": "test_run",
  "uri": "https://github.com/owner/repo/actions/runs/1234",
  "fetchedAt": "2026-09-11T12:00:00Z",
  "digest": "sha256:9f2c…e1",
  "excerpt": "tests/verification: 12 passed, 0 failed",
  "reliability": "direct",
  "source": "ci",
  "status": "ok"
}
```

| 字段 | 强制 | 说明 |
|------|------|------|
| `id` | ✅ | `EV-` 两位序号，判定与挑战通过它引用 |
| `type` | ✅ | 枚举：`test_run` / `ci_check` / `api_response` / `git_commit` / `pr_diff` / `doc_link` / `screenshot` / `log` / `trajectory` / `platform_record` |
| `uri` | ✅ | 可定位地址（URL、`branch@sha`、`repo#pr`、平台 API 路径）。不可定位 = 不得作为 pass 依据 |
| `fetchedAt` | ✅ | 采集时间（ISO8601），超过 24h 的存量证据在报告中降级提示 |
| `digest` | ✅ | 证据核心内容的 sha256（hex），防篡改 + 支持回放比对 |
| `excerpt` | ✅ | ≤200 字符的关键片段，评审者不点开 uri 也能判断相关性 |
| `reliability` | ✅ | 可靠性三级，见 §3 |
| `status` | ✅ | `ok` / `timeout` / `unreachable` / `digest_mismatch` |

## 3. 可靠性分级（reliability）

| 级别 | 定义 | 例子 | 判定效力 |
|------|------|------|---------|
| `direct` 直接 | 本次验证运行中现场产生的第一手结果 | 本次触发的 CI run、本次 curl 的 API 响应、本次 checkout 后的 git log | 可独立支撑 `pass` |
| `indirect` 间接 | 平台已落库的结构化记录（非本次产生但可定位） | GoalReviewPacket 的 `evidenceRef`、trajectory 记录、历史 artifact | 可支撑 `pass`，红队对其抽样更严 |
| `hearsay` 传闻 | 产出方/agent 的自述文本 | 「我已跑过测试」「文档里写了」 | **不得单独支撑任何 pass**；仅可作为 partial 辅助或 unverified 的说明 |

规则：`pass` 判定的 `evidenceIds` 中必须至少含一条 direct 或 indirect 证据；否则核验器必须把判定强制改写为 `unverified`。

## 4. 采集（S2）

### 4.1 按对象类型的证据源清单

| 对象 | 必采 | 按需 |
|------|------|------|
| Goal | loopHistory goal_review（节点 verification + evidenceRef）、artifacts 聚合 | evaluation、配额/注意力记录（佐证执行真实性） |
| Requirement | 关联 PR 的 CI/测试结果、verificationResult 历史、知识文档 | trajectory 中该需求相关执行轨迹、gateResult（仅风险提示） |
| PR | PR diff（`git fetch origin pull/<n>/head` 或 API）、CI checks 汇总、测试结果 | review comments、commit 链、关联需求对象全文 |

### 4.2 PR 场景 5 分钟预算分配（验收标准 2）

| 步骤 | 预算 | 超时处理 |
|------|------|---------|
| 对象与映射解析 | 30s | 映射失败 → `orphan`，继续验证但结论封顶 NEEDS_WORK |
| diff 获取与摘要 | 60s | 失败 → REJECTED（无法审 diff 的 PR 认证无意义） |
| CI/测试结果获取 | 120s（10s 轮询） | 未跑完 → 标 `timeout`，相应标准 unverified，结论封顶 NEEDS_WORK |
| 红队抽查 | 60s | 见 03 文档 |
| 报告生成与回写 | 30s | 回写重试 ≤2 次 |
| 缓冲 | 30s | — |

每个阶段超时即降级并继续，**禁止整体挂死**（对应平台防卡死纪律：任何单命令 60s 无输出必须中止并报告）。

### 4.3 采集纪律

- 证据采集是 IO 层，全部经平台既有 API/CLI（`gh`、`git`、平台 REST），不新造存储。
- 每条证据落盘时同步计算 digest；uri 不可达（网络/权限）→ `status: unreachable`，该证据不得被引用。
- 采集过程输出逐条进度（每 5 条或 >30s 一条），防长静默。

## 5. 证据链完整性校验（报告出口前的硬检查）

以下任一不满足 → 报告生成失败（fail-fast，不允许带病出报告）：

1. 每条 `pass` 判定至少引用 1 条 direct/indirect 证据；
2. 每条证据 `uri` 可定位且 `status=ok`（unreachable/timeout 的证据不得被任何 pass 引用）;
3. 每个 `criterionId` 至少出现在一条判定中（标准无遗漏）;
4. `digest` 与报告内 excerpt 同源（生成时计算，非事后补填）。

## 6. 回放（Replay）

第三方复核一份历史报告时：按 `uri` 重新拉取 → 计算 digest → 与报告内 `digest` 比对 → 一致则该证据可信。≥1 条关键证据 digest 不一致 → 该报告应被标记 `REVOKED`（在 verificationResult 中追加撤销记录，不删除原报告——审计链只追加、不抹除）。
