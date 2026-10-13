# 心伴 v0.11 · 审查守门记录

守门对象：`feat(v0.11)` 当前工作区增量（基线 commit `a92cd5e9f3dbe745714fe6db6e2d233e85415511`）。状态：PASS（deploy 与 deploy 后 smoke 已闭环）。

## 1. 范围守门

| 检查 | 结论 | 证据 |
|---|---|---|
| 只新增端点，不改 v0.9 `/comparison`、v0.10 `/insight` handler | ✓ | `routes/period.ts` diff 仅 additive import/helper/handler/register；冻结 route tests 全绿 |
| Prisma schema diff=0 | ✓ | `schema-diff.exit=0` |
| 零写侧 / 零采集 | ✓ | 新模块无 `prisma`、无 mutation、无 `Date.now` |
| v0.7 渲染 / v0.9 CSV+对比 / v0.10 insight 冻结复跑 | ✓ | `frozen-contract-rerun.meta` 五项 exit=0；smoke 01-52 全绿 |
| v0.10 洞察生成器边界 | additive-only | `moodPeriodInsight.ts` 仅将 `correctedSamplesInPeriod` 导出供复用；行为与 frozen tests 零漂移 |
| v0.9 对比阈值边界 | additive-only | `moodPeriodComparison.ts` 仅新增 `comparisonRelativeTrend` 包装既有 `relativeTrend` |
| 错误码唯一 | ✓ | `PERIOD_INSIGHT_COUNT_REJECTED` / `PERIOD_INSIGHT_TARGET_NOT_FOUND` 不在既有 `ErrorCode` 重复集合 |
| 死测试 | ✓ | `dead-test-scan.count=0` |
| deploy 三复验 | ✓ | `deploy-v02.exit=0`，log anchor `build=0/start=0/test=0` |
| deploy 后冒烟 | ✓ | `deploy-post-smoke.exit=0`，54/54 |

## 2. 契约抽查

- 3 类封顶：server golden type 数组 `[DOMINANT_MOOD, PERIOD_TREND, ANNOTATION_CORRELATION]`；mobile 未知类 degraded。
- 周期维度：`value.direction/rate/fromPeriodId/toPeriodId/fromValue/toValue`，不是新 insight type。
- 空标记：`status=EMPTY + reason + value=null`；全空无 item；降级 `periods=[] + insights=[]`。
- 日志：聚合 catch 输出 `[period] insight comparison degraded`，route 用例断言一次。
- 鉴权：`authenticate` 在参数校验前；无 token 走统一 401。

## 3. 过程缺陷与处置

| # | 缺陷 | 层 | 处置 |
|---|---|---|---|
| 1 | `PeriodInsightComparisonValue` 直接 cast `Record` 导致 mobile typecheck 红 | 实现 | 经 `unknown` 中转，保留运行时防御 |
| 2 | smoke 内 `${period_id}` 被解析为 `${period_idT...}` | 冒烟 | 显式 brace，红转绿 |
| 3 | smoke curl `%-w \n` 导致 status 字符串带 JSON/换行 | 冒烟 | 改为 `%{http_code}`，红转绿 |
| 4 | N=1 会把同一周期当 A→C 对比 | 契约实现 | 修正为不足两个周期时 `insights=[]`，不制造伪对比 |

缺陷均先红/挂后修，最终门禁全绿。

## 4. 结论

范围、契约、兼容、降级、持久化与死测试清账通过；可进入 deploy 复验与 deploy 后 smoke。

---

# R2 · 独立复核轮（本轮 reviewer，commit `183b202`，证据 `evidence/r2/`）

对已交付 v0.11 增量做不采信式独立复核：先重跑门禁，再逐条核对代码与文档声明的真实性。结论：**PASS，零阻塞漂移**。

## R2.1 评审三查（逐字核验）

| # | 检查 | 核验方式 | 结论 |
|---|---|---|---|
| 1 | 空标记口径与 v0.9 逐字对齐 | `moodPeriodComparison.ts:263-268` 的 `comparisonRelativeTrend` 是既有 `relativeTrend`（:158-168）的 additive 导出——同一函数、同一 ±5% 阈值、同一 `previous===0/null → empty` 判定；「任何周期空/源失败都不做跳空对比」语义（v0.9 `:237` 注释）在 v0.11 对应为 `EMPTY/PERIOD_EMPTY/value=null`（`moodPeriodInsightComparison.ts:231-233`） | ✓ 同源复用，非平行实现 |
| 2 | 降级枚举封闭可机判 | `InsightComparisonDegradedReason = 'SOURCE_DEGRADED' \| 'AGGREGATION_FAILED'`、`InsightComparisonEmptyReason = 'PERIOD_EMPTY' \| 'METRIC_MISSING' \| 'ZERO_BASE'` 均为字面量联合类型，无 `string` 逃逸；route 降级路径只产 `AGGREGATION_FAILED`，lib 长度失配只产 `SOURCE_DEGRADED` | ✓ 封闭 |
| 3 | 错误码唯一且无冲突 | `errors.ts:25-26` additive 两个码；v0.9 `PERIOD_COUNT_REJECTED` 仍仅在 `routes/moodComparison.ts:52` 使用；v0.10 既有端点的 400 `badRequest` 行为未改（`period.ts:60-64` vs 新 `:32-37` 的 404 专用码并存） | ✓ 无冲突 |

## R2.2 冻结契约复跑零漂移（三重证明）

1. **冻结测试套件计数比对**（`r2/frozen-*.log`，全部 exit 0）：
   - v0.9 CSV+对比 `periodComparison+periodCsv+moodComparison.routes` = **19 passed**，与上轮 `frozen-v09.log` 计数逐字一致；
   - v0.10 insight server `moodPeriodInsight+period.routes` = **25 passed**（11+14），与上轮 `frozen-v10-server.log` 一致；
   - v0.10 insight mobile `moodPeriodInsight` = **10 passed**，与上轮 `frozen-v10-mobile.log` 一致。
   - 说明：上轮 `frozen-v07-*.log`（1 文件 6 测试 / 1 文件 8 测试）无法从现存产物复现其文件组合（候选逐一实测：`emotion.test.ts`=6 属 v0.3 语义、`-t weekly`=4、`-t report`=8、`insights.test.ts`=8 属轨迹语义）；R2 改以 e2e 冻结基线比对作为 v0.7 周报契约的零漂移证明（见 2）。
2. **e2e 冻结基线逐行比对**：`v010-frozen-baseline/gate-smoke.log` vs `r2/gate-smoke.log` 兼容段 01-52 —— 步骤 01-45 **逐字一致**；唯一差异是 v0.11 在 46 位 additive 插入「周期对比 CSV 导出产物探针」，原 46-51 顺移为 47-52 且名称逐一对应（v0.7 周报段 39-42 逐字一致）。
3. **R2 门禁全绿**：build / test(140+49) / smoke(54/54) / persist(9/9) exit 全 0（`r2/gate-*.exit`）。

## R2.3 边界自证（R2 重做，不沿用上轮）

- schema diff（`git diff a92cd5e..HEAD -- apps/server/prisma/schema.prisma`）= **0 行**（`r2/schema-diff.exit`）。
- 新库 `moodPeriodInsightComparison.ts` 无 prisma import、无写操作、无 `Date.now`/`Math.random`（`r2/boundary-audit.meta`）。
- 死测试扫描（skip/only/todo/xit/failing）= **0**（R2 独立重扫）。
- 导出包真实指向后端：bundle 含 `127.0.0.1:3888` 与新端点路径 `insight/comparison`，未落入 mock 模式；洞察面板两条用户可见文案以 `\uXXXX` 转义形式存在于 bundle（`ChatScreen.tsx:527` 挂载实锚）。
