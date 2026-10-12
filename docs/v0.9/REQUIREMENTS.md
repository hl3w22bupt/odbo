# 心伴 v0.9 P0 · 多周期对比 + 周期 CSV 导出

状态：FROZEN（基线裁决触发 v0.9 还账，执行期不接受口头扩需求）。

## 1. 范围

1. `GET /api/v1/periods/:periodId/comparison`：当前周期与上一自然周对比。
2. `GET /api/v1/periods/:periodId/report.csv`：单周期聚合 CSV 导出。
3. 客户端只新增纯读契约/视图状态函数与离线空态，不新增图表、不改 v0.7 轨迹渲染。

不做：insight 三类洞察（留待 v0.10）、跨用户统计、schema/写侧/采集改动、独立外部数据库。

## 2. 契约

- 鉴权：Bearer；未登录 401。`periodId` 必须是真实公历日期且为东八区自然周周一（`YYYY-MM-DD`）；否则 400。
- 数据边界：仅读取当前用户 `ACTIVE` 会话；所有 memory/correction 查询带 `userId`；零跨用户。
- 聚合：复用 v0.8 `moodPeriodReport` 模块与 UTC+8 / ISO 周一 / 左闭右开口径；latest-wins 修正不变；缺省天不零填充。

### 2.1 Comparison 成功结构

`data` 固定包含：

- `available=true`、`degraded=false`、`periodId`、`previousPeriodId`（当前 ID 减 7 天）。
- `current` / `previous`：`periodId/from/to/sampleSize/coverageDays/totalDays/averageScore/completeness`。
- `trend` 三值：`currentAverage`、`previousAverage`、`deltaScore`；均四舍五入 4 位。
- `completeness`：`current`、`previous`、`overall`，枚举闭合 `FULL/PARTIAL/EMPTY`。
  - 周期样本 0 = EMPTY；覆盖 7 天 = FULL；其余 = PARTIAL；overall 双 FULL 才 FULL，双 EMPTY 才 EMPTY。

空库/空周期是合法空结构：HTTP 200，样本为 0，均分为 0，不编造趋势；仍返回周期边界与 EMPTY 标记。

### 2.2 Comparison 降级

读库或聚合失败返回 HTTP 200：`available=false / degraded=true`；两期样本 0、均分 0、EMPTY，禁止脏值和 500；`logger.error` 非静默留痕。

### 2.3 CSV

- 200，`Content-Type: text/csv; charset=utf-8`；standalone 原样返回，不经 JSON envelope。
- 表头列序冻结：`period_id,date,available,degraded,from,to,positive,neutral,negative,sample_size,average_score,coverage_days,total_days,completeness`。
- 每个有数据自然日一行；空周期只有表头；不得输出 `row_count`、行数、导出时间等元信息行。
- 读失败降级为可解析 CSV 空表 + 非静默错误日志。

## 3. 兼容边界

- Prisma schema 零 diff；既有路由/API/schema 零修改。
- v0.7 轨迹渲染文件零触碰。
- `localServer` 只 additive 支持 `rawBody`；未设置时既有 JSON 输出路径不变。
- 客户端 `ApiClient` 新增方法为接口必要 additive；mock 返回合法空结构。

## 4. DoD

| # | 验收 | 机判 |
|---|---|---|
| T1 | 对比三值 + 完整度 | 双周期具名纯函数测试值级 `toEqual/matchObject` |
| T2 | 空库/空周期合法 | route 空会话 + comparison all-empty 逐字段 |
| T3 | 失败降级 | route reject + `logger.error` + 完整 degraded 结构 |
| T4 | CSV 列序 | 表头 exact array/line；3 行；无 row_count；空周期 1 行 |
| T5 | 授权边界 | 401、用户 ID 过滤；脏数据不进聚合 |
| T6 | 兼容回归 | build、全量 test、v0.4–v0.9 smoke 48/48、persist 9/9 |
| T7 | 红绿证据 | server/mobile 红日志早于绿；退出码归档 |
