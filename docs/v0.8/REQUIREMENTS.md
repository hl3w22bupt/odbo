# 心伴 v0.8 P0 · 周期情绪报告最小版（自然周口径）

状态：FROZEN（本轮执行期不接受口头扩需求）。

## 1. 范围裁决（二选一分支）

节点 1 三证据 AND 复核全部通过（`ChatScreen.tsx:519` 可触达视图 ∧ `chat.routes.test.ts:164` 持久层 latest-wins ∧ `insights.test.ts:60` 值级断言；见 `BASELINE.md` §2）。按冻结裁决规则：**P0 = 周期情绪报告最小版**，不做轨迹可视化还账。

与 v0.7 的关系：v0.7 已交付「近 7 日滚动窗口周报」；本轮 P0 是**自然周（周一起算）口径的周期报告**，为 additive 读侧能力，不替换、不修改 v0.7 既有契约。

## 2. 聚合口径（四条定死，逐字冻结）

1. **自然周周一起算**：周期 = 服务端 `now` 所在的自然周，周一开始；周界按东八区（固定 UTC+8，无夏令时）计算。`period.from` = 本周一 00:00:00.000+08:00 对应的 UTC 瞬间，`period.to` = 下周一 00:00:00.000+08:00 对应的 UTC 瞬间（左闭右开）。`period.id` = 东八区周一日期 `YYYY-MM-DD`。`totalDays` 恒为 7。
2. **缺省剔除不零填充**：仅聚合周期内、可归因到 ACTIVE 记忆、经 latest-wins 修正后的有效情绪点（有效判据与 v0.7 相同：`point.id` 存在、`memoryId` 命中 ACTIVE 集合、时间可解析且落在 `[from, to)`、mood ∈ {POSITIVE, NEUTRAL, NEGATIVE}、score ∈ {-1, 0, 1}）。无数据的天**不得**在 `moods` 数组中出现零值占位。
3. **显式披露覆盖率**：`coverageDays` = 有效点位覆盖的去重天数（按东八区自然日），`totalDays` = 7；二者均始终返回。
4. **空周期返回合法空结构**：周期内有效点位为 0 时返回 HTTP 200 与完整结构 `{ period: {...}, coverageDays: 0, totalDays: 7, moods: [], summary: null }`（`available=true / degraded=false`），**禁止** 404/500 或字段缺失。
5. **聚合失败降级禁静默吞错**：读库或聚合抛错时返回 HTTP 200、`available=false / degraded=true`、`period=null`、`coverageDays=0`、`totalDays=7`、`moods=[]`、`summary=null`，且 HTTP 层**必须记录非静默日志**（logger.error，含会话 ID 与错误消息），不得吞掉异常继续装作正常。

## 3. 契约四件套

### 3.1 输入（含边界值）

`GET /api/v1/conversations/:id/mood-period-report`，Bearer 鉴权，仅本人会话（非本人/不存在 → 既有 404 `NOT_FOUND`；未登录 → 401）。

边界值集合（测试须覆盖）：
- 恰好等于 `period.from`（周一 00:00:00.000+08:00）的点 → **计入**；
- 恰好等于 `period.to`（下周一 00:00:00.000+08:00）的点 → **不计入**（左闭右开）；
- 周期外（上周/下周）点、无 ACTIVE 记忆归因点、畸形 score/mood 脏点 → 剔除；
- 5/7 天有数据 → `coverageDays=5`；仅 1 个有效点 → `summary` 输出但 `trend='STABLE'`（样本不足不做趋势判断）。

### 3.2 输出字段级定义

成功信封沿用 `{ code, message, data }`；`data`：

```json
{
  "conversationId": "conv_1",
  "available": true,
  "degraded": false,
  "period": { "id": "2026-10-05", "from": "2026-10-04T16:00:00.000Z", "to": "2026-10-11T16:00:00.000Z" },
  "coverageDays": 5,
  "totalDays": 7,
  "moods": [
    { "date": "2026-10-05", "count": 2, "positive": 1, "neutral": 1, "negative": 0, "averageScore": 0 }
  ],
  "summary": { "sampleSize": 2, "counts": { "positive": 1, "neutral": 1, "negative": 0 }, "trend": "STABLE", "headline": "本周记录2条，情绪平稳" }
}
```

- `moods[]` 按东八区日期升序；只含有数据的天（口径 2）。
- `summary.trend` 取值 `IMPROVING / STABLE / WORSENING`，判定规则与 v0.7 相同（按时间序前后半段均分比较，样本 <2 恒 STABLE）。
- `summary.headline` 为一句中文，只描述样本量与情绪方向，不输出用户消息原文。

### 3.3 空态

HTTP 200；`data = { conversationId, available: true, degraded: false, period: {...}, coverageDays: 0, totalDays: 7, moods: [], summary: null }`。逐字段断言（见 DoD T2）。

### 3.4 降级

HTTP 200；`data = { conversationId, available: false, degraded: true, period: null, coverageDays: 0, totalDays: 7, moods: [], summary: null }`，并伴随非静默错误日志（见 DoD T3）。

## 4. 兼容契约

- 不动 schema（`prisma` 零 diff）；不改 v0.7 `GET /mood-weekly-report` 及任何既有路由、字段、错误码；本轮 API 纯 additive。
- 派生器保持纯函数（`memory + timeline + now` 入参，不触库），HTTP 层单向调用派生层，先经既有 latest-wins 修正与契约序列化。
- v0.4–v0.7 冒烟命令语义不变：`npm run smoke`、`npm run persist:check`、`npm run deploy:v02`。

## 5. DoD 可机判打勾表

| # | 验收项 | 判定口径 | 测试名 / 冒烟锚点 | 状态 |
|---|---|---|---|---|
| T1 | 自然周聚合与覆盖率披露 | 5/7 天有效点 → `coverageDays=5`、`totalDays=7`、`moods` 恰 5 项无零填充；边界点从入/到出 | `moodPeriodReport.test.ts > aggregates a natural week with per-day coverage and excludes missing days without zero fill` | □ |
| T2 | 空周期合法空结构 | 0 有效点 → 200 且五字段逐字段断言（`coverageDays===0`、`totalDays===7`、`moods` 数组空、`summary===null`、`available===true/degraded===false`） | `moodPeriodReport.test.ts > returns the legal empty period structure field by field when the week has no valid points` | □ |
| T3 | 失败降级 + 非静默日志 | 派生层/读库抛错 → `degraded===true` 且 `logger.error` 被调用（非静默） | `chat.routes.test.ts > degrades the period report and logs loudly when persistence or aggregation fails` | □ |
| T4 | 路由契约 additive | 新路由 200 + 本人会话可达 + 越权 404，既有 v0.7 周报路由行为不变 | `chat.routes.test.ts > exposes the natural week period mood report read API` | □ |
| T5 | 修正数据入报告 | latest-wins 修正后的值参与自然周聚合 | `chat.routes.test.ts > reads persisted corrections into the period report` | □ |
| T6 | 兼容回归 | smoke 42 项既有步骤全绿 + 追加周期报告步骤（43）；persist 9/9；schema 零 diff | `npm run smoke` 步骤 43；`npm run persist:check` | □ |

断言三件套 = T1（正常聚合）+ T2（空库合法空结构）+ T3（失败降级），**缺一不合入**。

## 6. 范围与窗口处置

- **P0（不可砍）**：T1–T6 构成的服务端读侧周期报告（派生器 + 路由 + 三件套断言 + 兼容回归）。
- **P1（窗口不足可砍）**：客户端「本周」入口（ChatScreen 周报面板扩展 + mock 对齐 + mobile util 测试）。
- **停车场（不入本轮）**：图表渲染、推送/定时、环比、用户自定义周期、多周期对比、历史周期回看参数、真实 LLM 文案；另继承 v0.7 REVIEW §5 的 7 条 minor 与 BASELINE §4 五候选。
