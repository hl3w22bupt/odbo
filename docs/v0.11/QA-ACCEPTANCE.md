# 心伴 v0.11 P0 · QA 验收记录（情绪洞察跨周期对比）

状态：PASS（deploy 与 deploy 后 smoke 已闭环）。

## 1. DoD 机判结果

| # | 验收 | 锚点 | 实测 | 状态 |
|---|---|---|---|---|
| T1 | 三类洞察跨周期具体值 | `golden：A vs C 三类映射与周期趋势值级断言`；smoke 53 | DOM `{UP,rate=1,1→2}`；TREND `{UP,rate=1,0.5→1}`；标注 `{STABLE,rate=0,1→1}`；message 均含 `A vs C` | ✓ |
| T2 | ±5% 阈值 | `±5% 阈值边界：20→20 持平，20→21 上升，20→19 下降` | `0 / +0.05 / -0.05` 分别 `STABLE/UP/DOWN` | ✓ |
| T3 | ①目标周期空 | 同名用例 + smoke 53 | `EMPTY/PERIOD_EMPTY/value=null`，C evidence 样本 `0→2` | ✓ |
| T4 | ②任一对比周期空 | `②中间周期空：不产出跳空方向，全部空标记` | 不编造 `direction/rate` | ✓ |
| T5 | ③全部空 | `③全部周期空：200 语义合法空态` | available=true、degraded=false、insights=[] | ✓ |
| T6 | ④聚合失败 | 纯函数 SOURCE_DEGRADED + route `degrades aggregation failures` | reason 封闭，logger.error=1 | ✓ |
| T7 | ⑤超限/非法参 | route 专用码 + smoke 54 | 400 `PERIOD_INSIGHT_COUNT_REJECTED` | ✓ |
| T8 | periodId 404 约定 | route invalid target | 404 `PERIOD_INSIGHT_TARGET_NOT_FOUND` | ✓ |
| T9 | 3 类封顶 | `PERIOD_INSIGHT_TYPES` 长度3 + mobile 第4类判红 | 无第 4 类 | ✓ |
| T10 | 冻结契约零漂移 | `frozen-v07-*`、`frozen-v09.log`、`frozen-v10-*` 全部 exit 0；smoke 01-52 全过 | 0 漂移 | ✓ |
| T11 | additive/schema/死测试 | `schema-diff.exit=0`；`dead-test-scan.count=0`；boundary audit | schema 零 diff；死测试 0 | ✓ |
| T12 | 持久化 | `gate-persist.log` | 9/9，exit 0 | ✓ |

## 2. 门禁真实结果

| 门禁 | 命令 | 结果 | 日志 |
|---|---|---|---|
| build | `npm run build` | exit 0 | `gate-build.log` / `.exit` / `.meta` |
| test | `npm test` | exit 0；server 140 + mobile 49 | `gate-test.log` / `.exit` / `.meta` |
| smoke | `npm run smoke` | exit 0；54/54 | `gate-smoke.log` / `.exit` / `.meta` |
| persist | `npm run persist:check` | exit 0；9/9 | `gate-persist.log` / `.exit` / `.meta` |
| deploy | `npm run deploy:v02` | exit 0；build=0 / start=0 / test=0（server 140 + mobile 49） | `deploy-v02.log` / `.exit` / `.meta` |
| deploy 后 smoke | `npm run smoke` | exit 0；54/54 | `deploy-post-smoke.log` / `.exit` / `.meta` |

## 3. 空态/降级枚举

- comparison item 空原因：`PERIOD_EMPTY / METRIC_MISSING / ZERO_BASE`。
- 整体降级原因：`SOURCE_DEGRADED / AGGREGATION_FAILED`。
- 未知第 4 类在 mobile 视图整体判 degraded，不展示半可信脏结构。
