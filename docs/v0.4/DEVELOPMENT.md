# 心伴 v0.4 开发说明：情绪洞察摘要

## 1. 任务拆解与交付顺序

1. **基线确认**：复跑 build/start/test/smoke/persist，留证据；确认 v0.3 P1 已落地；死测试清账（`docs/v0.4/BASELINE.md`）。
2. **范围冻结**：只在既有会话记忆 + 情绪轨迹之上做读侧派生；冻结契约与 DoD。
3. **服务端派生层**：新增情绪洞察纯函数、路由注册与读 handler；空态、脏数据、聚合失败降级、鉴权兼容先红后绿。
4. **客户端展示层**：新增 API/类型/状态纯函数/摘要面板；空态、降级态、可解释文案内容断言先红后绿。
5. **端到端锚点**：扩展 smoke 20-22，不改 01-19 基线；v0.3 persist 保持 P01-P09。
6. **质量与部署**：DoD 逐项锚点验收，build/test/smoke/persist 复跑后进入 deploy，部署侧重跑冒烟。

## 2. 技术选型与模块边界

| 模块 | 路径 | 边界 |
|---|---|---|
| 洞察纯函数 | `apps/server/src/lib/moodInsight.ts` | 只消费 memory / timeline 读契约；聚合趋势、关键词、可解释文案；不访问 Prisma |
| HTTP 读路由 | `apps/server/src/routes/chat.ts` | 鉴权、复用读契约；只读 `ConversationMemory` 与 `MoodSnapshot`；异常返回显式降级 |
| 客户端类型/API | `apps/mobile/src/types/index.ts`、`src/api/index.ts` | 新增读方法，不改既有方法 |
| 展示状态 | `apps/mobile/src/utils/insights.ts` | 空态 / 降级态 / 就绪态判定，隐藏无效摘要 |
| 展示组件 | `apps/mobile/src/components/MoodInsightPanel.tsx`、`ChatScreen.tsx` | 读侧文案展示；不触发任何写入 |
| 端到端 | `scripts/smoke.sh` | 01-19 不变，20-21 就绪摘要与样本口径、22 空摘要 |

禁止：schema migration、Prisma create/update/upsert/delete、修改既有 HTTP 字段、移动端既有组件契约变更。

## 3. 冻结契约

统一信封不变：`{ code, message, data }`。

### `GET /api/v1/conversations/:id/insight-summary`

空态（没有可归因于 ACTIVE 记忆的有效情绪点）：

```json
{
  "conversationId": "cuid",
  "available": true,
  "degraded": false,
  "summary": null
}
```

就绪态：

```json
{
  "conversationId": "cuid",
  "available": true,
  "degraded": false,
  "summary": {
    "sampleSize": 3,
    "counts": { "positive": 1, "neutral": 1, "negative": 1 },
    "trend": "STABLE",
    "headline": "整体情绪比较平稳",
    "reason": "前后两段均分接近，最近情绪以积极为主。",
    "keywords": ["开心", "女儿"],
    "window": {
      "from": "2026-01-01T00:00:00.000Z",
      "to": "2026-01-03T00:00:00.000Z"
    }
  }
}
```

降级态：`available=false, degraded=true, summary=null`。触发条件为会话不存在以外的存储读取/序列化/聚合失败；绝不暴露脏点或半写数据。

### 输入与派生规则

- 输入 A：鉴权后当前用户可见的 `MemoryReadContract`，只接受 `ACTIVE`、非空 id 记忆。
- 输入 B：`MoodTimelineContract.points`，只接受 `memoryId` 映射到输入 A、`id/createdAt/mood/score` 可解析的情绪点。
- 脏点策略：跳过，不阻断其他有效点；无有效点时进入空态。
- 趋势：样本 <3 为 `STABLE`；否则比较前半段与后半段平均分，差值 `> 0` 为 `IMPROVING`，`< 0` 为 `WORSENING`，否则 `STABLE`。
- 关键词：只聚合有效点 `keywords`，按频次、首现顺序去重，最多 3 个。
- 兼容：现有 `/memory`、`/mood-timeline`、`/chat/send` 字段不删除、不改名、不改类型。

## 4. 可机判 DoD

| # | 验收项 | 可判定口径 | 测试 / 冒烟锚点 | 状态 |
|---|---|---|---|---|
| V4-1 | 服务端洞察契约 | 空态 `summary=null`；有效输入产出 `trend/counts/keywords/reason/window` | `moodInsight.test.ts > returns an explicit empty insight before any valid mood point`、`aggregates an explainable trend from active memory-backed snapshots` | [ ] |
| V4-2 | 脏数据与降级 | 脏点被跳过；memory/timeline/聚合失败返回 `available=false/degraded=true/summary=null` | `moodInsight.test.ts > skips dirty points that are not backed by an active memory`、`degrades when either source read is degraded`；`chat.routes.test.ts > serves the explicit empty insight summary before any valid point`、`> degrades the insight summary when storage fails`、`> degrades the insight summary when aggregation cannot safely complete` | [ ] |
| V4-3 | HTTP 兼容 | 新路由注册；旧 memory / mood-timeline 契约测试不修改且全绿 | `chat.routes.test.ts > exposes the insight summary read API`；v0.3 既有四个 read handler 行为测试 | [ ] |
| V4-4 | 客户端读视图 | 空态 / 降级态 / 就绪态判定正确，文案内容可见，不断言像素 | `insights.test.ts > treats an insight summary as empty before the first valid point`、`> hides dirty or degraded insight data`、`> asserts explainable insight content instead of pixels`；`MoodInsightPanel` | [ ] |
| V4-5 | 全链路 | 01-19 v0.3 冒烟无回归；20-21 就绪摘要与样本口径；22 新会话空摘要；exit 0 | `scripts/smoke.sh` 20-21；`docs/smoke/v0.4.md` | [ ] |
| V4-6 | v0.3 持久门无回归 | `npm run persist:check` exit 0，P01-P09 | `docs/smoke/v0.4.md` | [ ] |
| V4-7 | 死测试清账 | 新旧测试无 skipped/todo/only，台账清零 | `docs/v0.4/BASELINE.md` §3 | [ ] |

窗口不足：只保 V4-1 至 V4-7（即 P0 整体）；不允许砍掉三件套换取功能上线。

## 5. 新增停车场

| 项 | 说明 |
|---|---|
| 多情绪周期聚合 | 周报、多会话对比、用户自定义时间窗 |
| 洞察行动建议 | 在摘要后给出安全、可执行的情绪调节建议 |
| v0.3 review 加固 | M1-M4 与 S1-S8 清偿 |
| 真实 LLM 摘要 | 用模型生成自然语言洞察；需先完成安全评测 |
