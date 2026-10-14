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

---

# R2 · 独立验收复核（本轮，commit `183b202`，证据 `evidence/r2/`）

上轮 T1-T12 锚点**逐条实测重跑**，全部复核通过；下表为 R2 复跑实测（不采信上轮打勾表）：

| # | 验收锚点 | R2 实测证据 | 状态 |
|---|---|---|---|
| T1 | `golden：A vs C 三类映射与周期趋势值级断言` | `gate-test.log` server 140 passed 含该用例；golden 文案「主导情绪记录数上升趋势 +100%。」逐字断言实测存在（`moodPeriodInsightComparison.test.ts:124`） | ✓ |
| T2 | ±5% 阈值边界 | `0 / +0.05 / -0.05 → STABLE/UP/DOWN` 用例实测存在（`test.ts:153-172`） | ✓ |
| T3-T5 | 空态矩阵 ①②③ | 用例实测存在且断言 `EMPTY/PERIOD_EMPTY/value=null`、全空 `[true,true,true]`（`test.ts:196-236`） | ✓ |
| T6 | ④聚合失败降级 | route 用例 `degrades aggregation failures...` + `errorSpy` 调用一次断言实测存在（`periodInsightComparison.routes.test.ts:135-154`） | ✓ |
| T7-T8 | ⑤超限/非法参 | route 400/404 专用码用例实测存在；smoke 54 实测绿（`gate-smoke.log`） | ✓ |
| T9 | 3 类封顶 | server `PERIOD_INSIGHT_TYPES` 长度 3 断言 + mobile 第 4 类判红用例实测存在 | ✓ |
| T10 | 冻结契约零漂移 | REVIEW R2.2 三重证明（套件计数一致 + e2e 逐行比对零漂移 + 门禁全绿） | ✓ |
| T11 | additive/schema/死测试 | R2 自证：schema diff=0 行、边界 grep 干净、死测试=0 | ✓ |
| T12 | 持久化 | `r2/gate-persist.log` 9/9，exit 0（07:32:55–07:32:59） | ✓ |

## R2 门禁真实结果（四要素：命令 / 锚点 / 时间戳 / SHA，证据 `evidence/r2/`）

| 门禁 | 命令 | 结果 | 输出锚点 | 时间戳 |
|---|---|---|---|---|
| build | `npm run build` | exit 0 | `Exported: dist-web` | 07:32:38–07:32:43 |
| start | `npm run server:start` + curl `/health` | `status="up"` / `mode="standalone"` | `health.json`；路由注册含 `insight/comparison` | 07:34:41–07:34:45 |
| test | `npm test` | exit 0；140+49 | `Test Files 24 passed / 8 passed` | 07:32:43–07:32:45 |
| smoke | `npm run smoke` | exit 0；54/54 | `✅ 心伴 v0.11 冒烟通过：54 项 / 54 项` | 07:32:45–07:32:55 |
| persist | `npm run persist:check` | exit 0；9/9 | `9 项，exit=0` | 07:32:55–07:32:59 |
| deploy | `npm run deploy:v02` | exit 0 | `build=0 start=0 test=0` | `deploy-v02.meta` 07:47:30 |
| deploy 后 smoke | `npm run smoke` | exit 0；54/54 | `deploy-post-smoke.log` | `deploy-post-smoke.meta` 07:47:40 |

全部命令于 commit `183b2020886dce4bd0082fd6e6ba2379b305a13a` 下执行。

## R2 结论

**CERTIFIED 级复核通过**：五节点（基线复核 → 范围冻结 → 实现 → 质量验收 → deploy 闭环）在 R2 独立重放全部成立，无阻塞漂移、无死测试、无契约违约。
