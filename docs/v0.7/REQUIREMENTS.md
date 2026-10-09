# 心伴 v0.7 P0 · 近 7 日情绪周报最小版

状态：FROZEN（本轮执行期不接受口头扩需求）。

## 1. 冻结目标

在既有会话情绪读侧派生层上，补一个用户可触达的「近 7 日情绪报告」：固定 7 日窗口、输出一个趋势方向和一句可解释文案；空态/降级态明确，不新增 schema、不破坏既有对外契约。

## 2. 范围裁决

基线三判据复核结论：v0.6 情绪轨迹可视化已实质落地，见 `docs/v0.7/BASELINE.md`。因此本轮选择 **P0 = 周报最小版**，不重复做轨迹可视化。

### 本轮交付

| # | 冻结项 | 内容 |
|---|---|---|
| F1 | 周报 API | 新增 `GET /api/v1/conversations/:id/mood-weekly-report`；Bearer 鉴权；只允许本人会话 |
| F2 | 7 日窗口 | 以服务端 `now` 倒推 7×24h；仅聚合窗口内、可归因到 ACTIVE 记忆、经 latest-wins 修正后的有效情绪点 |
| F3 | 趋势方向 | 有效样本 ≥2 时输出 `IMPROVING / STABLE / WORSENING`；按时间序前半段均分与后半段均分比较 |
| F4 | 一句解释 | `report.reason` 恒为一句中文；只描述样本量、均分/规则，不输出用户消息原文 |
| F5 | 客户端入口 | 聊天页挂载「近 7 日情绪报告」面板；进入既有会话、发送消息、修正情绪后刷新 |
| F6 | 空态/降级 | 空库或有效样本 <2 显示固定空态；读失败/聚合失败显示固定降级态 |

### 明确停车场

图表渲染、推送/定时报告、环比、跨会话聚合、用户自定义窗口、多周期对比、行动建议、真实 LLM 文案均不入本轮。

## 3. 契约四件套

### 3.1 接口契约

统一响应信封不变：`{ code, message, data }`。

成功：

```json
{
  "conversationId": "conv_1",
  "available": true,
  "degraded": false,
  "report": {
    "sampleSize": 2,
    "counts": { "positive": 1, "neutral": 1, "negative": 0 },
    "trend": "STABLE",
    "headline": "近7日情绪比较平稳",
    "reason": "近7日样本2条，前后两段均分接近，情绪平稳。",
    "keywords": ["平稳"],
    "window": { "from": "2026-10-01T00:00:00.000Z", "to": "2026-10-08T00:00:00.000Z" }
  }
}
```

- `window.from = now - 7d`，`window.to = now`，时间均为 ISO-8601 字符串。
- `trend` 只能取 `IMPROVING / STABLE / WORSENING`。
- `report` 缺失或 null 表示空态；客户端不得编造趋势。

### 3.2 数据契约

- 只读既有 `Conversation`、`ConversationMemory`、`MoodSnapshot`、`MoodCorrection`；不迁移、不新增表和字段。
- 复用 v0.3/v0.4 读侧序列化与 latest-wins 修正逻辑；周报输入是修正后的 `MoodTimelineContract` 与 `MemoryReadContract`。
- 周报派生器保持纯函数：`memory + timeline + now` 入参，不直接触库；HTTP 层单向调用派生层。

### 3.3 状态与错误契约

| 场景 | HTTP | data 行为 | 用户可见文案 |
|---|---:|---|---|
| 空库新用户 | 200 | `available=true/degraded=false/report=null` | 标题「近7日还没有足够的情绪记录」；正文「完成至少两条心情记录后，这里会给出趋势和一句解释。」 |
| 窗口内有效样本 <2 | 200 | 同空库空态 | 同上 |
| 读/聚合失败 | 200 | `available=false/degraded=true/report=null` | 标题「近7日情绪报告暂不可用」；正文「数据已安全隐藏，请稍后重试。」 |
| 未登录/token 无效 | 401 | 既有 `UNAUTHORIZED` | 既有登录引导 |
| 会话不存在/越权 | 404 | 既有 `NOT_FOUND` | 既有「会话不存在」 |

### 3.4 兼容契约

- v0.4 `GET /insight-summary`、v0.3 `GET /mood-timeline`、v0.5 correction、v0.5/v0.6 export/import 的请求与响应均不改。
- 本轮 API 为 additive；不改 route 名称、字段语义、错误码。
- v0.4–v0.6 冒烟命令语义不变：`npm run smoke`、`npm run persist:check`、`npm run deploy:v02`。

## 4. DoD 双锚定打勾表

- [ ] F1 路由契约：`chat.routes.test.ts > exposes the weekly mood report read API` + 用户可通过已登录会话请求新周报接口。
- [ ] F2 窗口与趋势：`moodWeeklyReport.test.ts > builds a 7 day explainable trend from valid corrected points` + 用户看到趋势方向和一句原因。
- [ ] F3 归因与脏点：`moodWeeklyReport.test.ts > skips out of window dirty and unattributed points` + 畸形/越窗/无 ACTIVE 记忆数据不进入报告。
- [ ] F4 空态：`chat.routes.test.ts > serves the explicit weekly report empty state before enough valid points` + 空库/1 条样本用户看到固定空态。
- [ ] F5 修正数据：`chat.routes.test.ts > reads persisted corrections into the weekly report` + 用户修正某点位后周报按修正后值解释。
- [ ] F6 降级：`chat.routes.test.ts > degrades the weekly report when persistence or aggregation fails` + 用户看到「暂不可用」，不见部分脏数据。
- [ ] F7 客户端契约：`weeklyReport.test.ts > maps ready empty and degraded weekly report states` + 聊天页面板按三种状态显示对应文案。
- [ ] F8 Mock 对齐：`mock.test`/类型编译锁定 `getMoodWeeklyReport` + 离线演示也能打开周报入口。
- [ ] F9 兼容回归：`npm run smoke` 38 项既有步骤全绿并追加周报步骤 + 用户既有聊天、轨迹、修正、导出导入不回退。

窗口不足处置：只保 F1-F9 构成的 P0；若窗口不足，砍周报步骤扩展和 Mock 对齐细化，但不允许砍空态/降级/内容断言三底线。
