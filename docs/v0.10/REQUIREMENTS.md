# 心伴 v0.10 P0 · 情绪洞察最小版（insight）

状态：FROZEN（节点 1 三证据 AND 复核通过，v0.9 实质落地；本契约执行期不接受口头扩需求）。

## 0. 基线裁决（节点 1 结论）

- 证据①：smoke 步骤 46 通过，`trend` 三值 `currentAverage/previousAverage/deltaScore` 与完整度标记均为值级断言；`periodComparison.test.ts` 以 `toEqual` 全值断言。
- 证据②：smoke 步骤 47/48 通过，CSV 表头 14 列 exact、无 `row_count`/`rowCount`；`periodCsv.test.ts` 全行值级断言 + 字节稳定测试。
- 证据③：build 全绿（server tsc + mobile typecheck + Expo Web 导出）；`npm test` exit 0；`npm run smoke` 48/48 exit 0。
- 漂移清单：仅 1 条非阻塞文档漂移——`docs/smoke/v0.9.md` 步骤 46 记述 `coverageDays=2`，实际断言与运行为 `coverageDays=1`（2 条样本同属一个东八区自然日）。本版顺手修正该记述，代码零改动。
- 结论：v0.9 实质落地，**不触发备选切换**，P0 = insight 照常执行。

## 1. 范围

1. `GET /api/v1/periods/:periodId/insight`：单周期情绪洞察（三类封顶）。
   - 路由前缀裁决：任务书原文写 `GET /api/periods/:periodId/insight`；本仓库 periods 路由族既有前缀为 `/api/v1`（comparison、report.csv 同族），为保持路由族同构落位于 `/api/v1` 前缀下。
2. 移动端：`ApiClient` additive 方法 + 视图状态纯函数 + 只读展示 Panel，挂载于对话页报告列（周期报告只读展示位），不新增图表组件。
3. 服务端确定性纯函数规则产出洞察：无 ML、无随机、无外部调用。

不做：多周期洞察对比（留后续）、跨用户统计、任何写侧/采集/Prisma schema 改动、独立图表组件、v0.7 轨迹渲染文件改动。

## 2. 契约

- 鉴权：Bearer；未登录 401。`periodId` 必须是真实公历日期且为东八区自然周周一（`YYYY-MM-DD`）；否则 400（与 v0.9 comparison 路由同规则）。
- 数据边界：仅读取当前用户 `ACTIVE` 会话；零新采集、零写侧、零跨用户。
- 输入 = 既有聚合输出：v0.8 `readableMoodPeriodReport`（周期报告）+ v0.7 修正应用后的 `readableMoodTimeline`（点位含 `correctionId`）；周期口径（UTC+8 / ISO 周一 / 左闭右开）复用 `moodPeriodReport.ts` 冻结模块（引用非复制）。

### 2.1 三类洞察（枚举闭合，封顶 3 类）

每条洞察 = `{ type, value, evidence, message }` 四元组：

| type | 产出条件（确定性） | value（结论值） | evidence.source（依据数据引用） |
|---|---|---|---|
| `DOMINANT_MOOD` | 周期 `sampleSize > 0` | `{ mood, count, share }`；mood 为计数最高者，平票按 `NEGATIVE > NEUTRAL > POSITIVE` 固定优先级 | `moodPeriodReport.summary.counts` |
| `PERIOD_TREND` | 周期 `sampleSize > 0` | `{ trend, sampleSize, averageScore, coverageDays }`；trend 与 coverageDays 直接取自周期聚合，averageScore 由 `moodPeriodAverageScore` 重算，四舍五入 4 位 | `moodPeriodReport.summary.trend` |
| `ANNOTATION_CORRELATION` | 周期内带 `correctionId` 的有效点数 `> 0` | `{ correctedSamples, sampleSize }` | `moodTimeline.points[correctionId]` |

- `evidence` 固定含 `{ periodId, from, to, sampleSize, source }`，全部引用既有聚合输出字段，不新造数据。
- `message` 为确定性可解释中文文案（无随机、无模型调用）。
- `share` 四舍五入 4 位；类型枚举闭合于 `DOMINANT_MOOD / PERIOD_TREND / ANNOTATION_CORRELATION` 三值，第 4 类不存在（机判：闭合测试判红）。

### 2.2 空态与降级

- 空库/无该周期（`sampleSize = 0`）：HTTP 200 + `available=true / degraded=false / insights=[]` 合法空结构（禁 404/500）。
- 聚合失败（读库/派生抛错）：HTTP 200 + `available=false / degraded=true / insights=[]` + `logger.error` 非静默留痕，禁脏值与 500。
- 成功信封：`{ conversationId, available, degraded, periodId, insights }`，仅 insight 命名空间新增字段，不动既有对外 schema。

### 2.3 时钟注入

- 纯函数不调用 `Date.now`；`now` 一律入参注入。测试使用固定时钟；UTC+8 周界用例覆盖周日 23:59（CST）与周一 00:00（CST）归属不同周期。

## 3. 兼容边界

- Prisma schema 零 diff；既有路由/API/schema 零修改；既有测试零修改。
- v0.7 轨迹渲染文件（`MoodTimelinePanel.tsx` 等）零触碰。
- 移动端新增仅限：`types` insight 命名空间类型、`api` 方法（mock 返回合法空结构）、`utils/moodPeriodInsight` 纯函数、`MoodPeriodInsightPanel` 组件、ChatScreen 一行挂载 + 一次取数。
- 客户端当前周期 ID 由本地纯函数按 UTC+8 自然周周一计算（客户端无法引用服务端模块，口径一致并以周界用例锚定）。

## 4. DoD

| # | 验收 | 机判 |
|---|---|---|
| T1 | 三类洞察值级一致 | 洞察 `value` = 按规则从同一聚合输入重算值 `toEqual` 断言（非元素存在） |
| T2 | 三层独立用例 | 空态 / 降级 / 正常各自独立测试（纯函数层 + 路由层） |
| T3 | 输出稳定 + 黄金用例 | 同输入多次调用 `toEqual` 全等；黄金用例全结构快照 |
| T4 | 类型枚举闭合 | 类型集合长度 3；未知第 4 类输入在客户端视图状态判红（拒绝） |
| T5 | UTC+8 周界 | 周日 23:59 与周一 00:00（CST）归属不同周期，双端纯函数用例 |
| T6 | 兼容回归 | build、全量 test、smoke（含 v0.10 增量步）全绿、persist:check 通过 |
| T7 | 红绿证据 | 先红后绿日志归档 `docs/v0.10/evidence/` |
| T8 | 范围外 diff 拒收 | diff 仅含本契约 additive 清单；v0.7 轨迹渲染零触碰 |
