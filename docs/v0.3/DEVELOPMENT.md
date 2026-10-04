# 心伴 v0.3 开发说明：核心交互价值闭环

## 1. 范围冻结

- **P0**：多轮会话记忆展示与利用。用户单角色消息提交后生成一条结构化记忆点；聊天页展示“TA 记住的”；后续回复 system prompt 注入长期记忆。
- **P1**：情绪轨迹可视化。只有 P0 记忆保存成功才派生情绪快照；聊天页展示结构化 emoji/标签读视图。
- **窗口不足处置**：砍 P1、保 P0；P1 转 `v0.3+ 停车场`。
- **表外冻结**：真实供应商、PostgreSQL/iii 生产编排、浏览器 UI 自动化、真机上架合规、支付/会员扩展全部不进本轮。

## 2. 技术选型与模块边界

| 模块 | 选型/路径 | 本轮职责 |
|---|---|---|
| 记忆/情绪纯函数 | `apps/server/src/lib/conversationInsights.ts` | 提取、契约序列化、空态/降级态、写失败统一降级 |
| SQLite 持久层 | `ConversationMemory`、`MoodSnapshot` | 新增数据跨进程可读；不改变既有消息表契约 |
| HTTP 读契约 | `apps/server/src/routes/chat.ts` | 鉴权读取 memory / mood-timeline；存储异常返回显式降级 |
| 回复利用 | `apps/server/src/lib/characters.ts`、`chatEngine.ts` | 最多 20 条 ACTIVE 记忆自然注入提示词 |
| Web 展示 | `MemoryPanel`、`MoodTimelinePanel`、`utils/insights.ts` | 空态、就绪态、降级态；不展示 QUARANTINED/半写内容 |
| 验证 | Vitest + shell smoke + persistence shell | 单元契约、路由注册契约、17 步端到端、9 步重启硬门槛 |

## 3. 交付顺序

1. 基线确认并补齐缺失的 `docs/smoke/v0.2-base.md`。
2. P0 schema + 纯函数 + API + 提示词利用 + Web 展示，先过空态/脏数据/降级测试。
3. P1 只从 P0 成功记忆派生快照，再开读接口和可视化。
4. 将 smoke 扩为 01-13 基线段 + 14-17 增量段。
5. 新增 `persist:check` 硬门槛：写 → kill → 重启 → 读回一致 + 写失败降级。
6. 质量审查三点一线后，交默认工作流 deploy 节点执行部署并重跑冒烟。

## 4. 冻结 DoD

| # | 验收项 | 可判定口径 | 验证锚点 | 状态 |
|---|---|---|---|---|
| V3-1 | P0 会话记忆展示利用 | 空态返回 `available=true/items=[]`；写后返回原文规范化内容；`degraded=true` 时不返回内容；prompt 包含记忆 | `conversationInsights.test.ts`、`chat.routes.test.ts > serves the explicit empty memory state for a fresh conversation / degrades the memory read to an empty list when storage fails`、`smoke.sh` 14-15、18 | [x] |
| V3-2 | P1 情绪轨迹读视图 | 从 memoryId 派生结构化 `mood/score/keywords`；读接口按内容断言；降级态为空 | `conversationInsights.test.ts`、`insights.test.ts`、`chat.routes.test.ts > serves the explicit empty mood timeline before the first snapshot / degrades the mood timeline read to an empty list when storage fails`、`smoke.sh` 16-17、19 | [x] |
| V3-3 | 新增数据跨重启持久 | `npm run persist:check` exit 0，含 P02 写、P05 kill、P06 重启、P07/P08 读回一致 | `scripts/persistence-regression.sh` P01-P08 | [x] |
| V3-4 | 写失败降级 | writer throw 后返回 `available=false/degraded=true/items=[]`，无脏数据 | `conversationInsights.test.ts > maps a memory write failure...`；`chat.routes.test.ts > degrades the memory read...`；persist P09 | [x] |
| V3-5 | v0.3 冒烟全局项 | 01-13 基线全绿且 14-19 增量全绿，exit 0 | `npm run smoke`；`docs/smoke/v0.3.md` | [x] |
| V3-6 | v0.2 死测试处置 | 基线 0 个 → 修 0 / 删 0 / 缓 0，全仓无死测试标记 | `docs/smoke/v0.2-base.md`、本轮 grep | [x] |

## 5. 契约增量

统一信封不变：`{ code, message, data }`。

### `GET /api/v1/conversations/:id/memory`

```json
{
  "conversationId": "cuid",
  "available": true,
  "degraded": false,
  "items": [
    {
      "id": "cuid",
      "conversationId": "cuid",
      "characterId": "cuid|null",
      "sourceMessageId": "cuid|null",
      "content": "规范化记忆内容",
      "status": "ACTIVE|QUARANTINED",
      "createdAt": "ISO8601"
    }
  ]
}
```

存储读取失败：`available=false, degraded=true, items=[]`。

### `GET /api/v1/conversations/:id/mood-timeline`

```json
{
  "conversationId": "cuid",
  "available": true,
  "degraded": false,
  "points": [
    {
      "id": "cuid",
      "conversationId": "cuid",
      "characterId": "cuid|null",
      "sourceMessageId": "cuid|null",
      "memoryId": "cuid|null",
      "mood": "POSITIVE|NEUTRAL|NEGATIVE",
      "score": 1,
      "keywords": ["开心"],
      "createdAt": "ISO8601"
    }
  ]
}
```

`POST /api/v1/chat/send` 只做向后兼容增量：`data.memory`、`data.moodTimeline` 可选新增；既有字段不变。

### 契约测试绑定（冻结后以测试红为契约被改的判定）

| 接口 | 绑定契约测试 |
|---|---|
| `GET /api/v1/conversations/:id/memory` | `apps/server/src/routes/chat.routes.test.ts > exposes the conversation memory read API`（路由注册）；`> serves the explicit empty memory state for a fresh conversation`（空态）；`> degrades the memory read to an empty list when storage fails`（降级态）；`apps/server/src/lib/conversationInsights.test.ts > returns an explicit empty state before any memory is written`（信封形状） |
| `GET /api/v1/conversations/:id/mood-timeline` | `chat.routes.test.ts > exposes the structured mood timeline read API`（路由注册）；`> serves the explicit empty mood timeline before the first snapshot`（空态）；`> degrades the mood timeline read to an empty list when storage fails`（降级态）；`conversationInsights.test.ts > serializes mood snapshots with structured keywords`（内容快照） |
| `POST /api/v1/chat/send`（`data.memory` / `data.moodTimeline` 增量） | `conversationInsights.test.ts > maps a memory write failure to the degraded read contract`（写失败降级回填）；`scripts/persistence-regression.sh` P02-P04（写后返回字段） |
| Web 展示层（空态/就绪态/降级态） | `apps/mobile/src/utils/insights.test.ts`（`renders an explicit empty state...`、`hides dirty data and enters the degraded state`、`asserts timeline content instead of pixels`、`uses empty and degraded states without exposing partial rows`） |
