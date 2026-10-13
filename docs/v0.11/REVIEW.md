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
