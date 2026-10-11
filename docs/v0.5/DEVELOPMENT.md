# 心伴 v0.5 开发说明：写侧闭环 + JSON 导出

## 1. 基线确认

`main`（v0.4 已交付）上完成三项开工前置：

| 门 | 命令 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| 图谱注册 | `graphify extract/cluster/global add` | 0 | 1,721 nodes / 142 communities / `xinban-v05` | `graphify-register.log` |
| 冒烟 | `npm run smoke` | 0 | 22/22（S01-S22） | `baseline-smoke.log` |
| 单测 | `npm test` | 0 | server 46 + mobile 29 | `baseline-test.log` |
| 构建 | `npm run build` | 0 | tsc + Expo Web | `baseline-build.log` |
| 终验构建 | `npm run build` | 0 | server 13 files / 59 tests + mobile 4 files / 31 tests 前置 | `qa-build.log` |
| 持久 | `npm run persist:check` | 0 | P01-P09 | `baseline-persist.log` |
| 死测试 | `grep` 扫描 | 0 | 0 条 | `baseline-dead-test-scan.log` |

### 死测试台账

本轮基线无 `.skip/.only/todo/xit/xdescribe`。台账保存原始 grep 输出并显式记录：

| 文件 | 测试 | 根因 | 证据 | 处置 | 归档 |
|---|---|---|---|---|---|
| 无 | 无 | — | `baseline-dead-test-scan.log` | 清零 | 不适用（无删除/跳用） |

若后续出现死测试，只允许四类标签：`a-fixture-drift`、`b-async-timing`、`c-contract-drift`、`d-acceptance-change`。前三类必须修复复活，第四类必须产品侧签认后归档且保留文件。

## 2. 范围冻结与任务拆解

| 任务 | 优先级 | 模块 | 交付顺序 |
|---|---|---|---|
| T1 契约冻结 | Gate | `docs/v0.5` | 已冻结 |
| T2 additive schema | P0-1 | `prisma/schema.prisma` | 新增 `MoodCorrection`，不改旧表 |
| T3 修正纯函数 | P0-1/P0-2 | `lib/moodCorrections.ts` | 输入白名单、latest-wins、时间结构 |
| T4 修正路由 | P0-1/P0-2 | `routes/chat.ts` | 归属校验、幂等、404、写失败降级 |
| T5 最小 UI | P0-2 | `MoodTimelinePanel` / Chat | 列表项「修正」、三态情绪、标签/原因、即时更新 |
| T6 JSON 导出 | P1-1 | `lib/exportData.ts` / `routes/export.ts` | 冻结 schema、JSON only、空库空结构 |
| T7 测试/冒烟 | Gate | server / mobile / smoke | 红绿留证、四链路 |
| T8 deploy | Gate | 工作流节点 | 全绿后执行 |

### 停车场捞回

- **会话记忆容量上限/截断策略**：已有 `ConversationMemory` 查询 `take:50`，读契约再裁剪 `MEMORY_LIMIT=20`；文档冻结为“最早进先保留，读取最新 20 条；不自动删除用户数据”。
- **洞察摘要空态文案细化**：冻结为标题「还没有情绪洞察」、正文「完成一句心情记录后，这里会给出可解释的趋势观察。」；不新增外部分析依赖。

### 明确砍单

1. 先砍 CSV/其他格式导出，仅保留 JSON。
2. 若窗口不足，砍 P0-2 标注 UI 的标签选择，但同一「修正」弹窗至少保留原因；不允许把标注另立项。
3. 主轴不保则本轮降级为导出单独成轮。

### 停车场

定时器、通知通道、存储引擎替换、破坏性数据迁移、批量修正、CSV/PDF、协作标注均不进入本轮；口头加需求不受理。

## 3. 冻结契约

统一信封不变：`{ code, message, data }`。所有时间字段是 ISO-8601 字符串；测试只做结构断言和相对时序，不做绝对日期/全文 diff。

### 3.1 `POST /api/v1/conversations/:id/mood-points/:pointId/correction`

**输入白名单**（多余字段忽略；非法值拒绝）：

```json
{
  "mood": "POSITIVE | NEUTRAL | NEGATIVE",
  "tags": ["状态变化", "记录有误"],
  "reason": "当时记错了，其实是平静。",
  "clientMutationId": "optional-max-64"
}
```

- `mood` 必填；`score` 由枚举映射 `1/0/-1`，不由客户端提交。
- `tags` 最多 3 个；每个 trim 后 1-20 字。
- `reason` trim 后最多 160 字；可为空。
- `clientMutationId` trim 后最多 64 字；同一用户内唯一。

**成功 200**：

```json
{
  "point": {
    "id": "mood_id",
    "conversationId": "conv_id",
    "mood": "NEUTRAL",
    "score": 0,
    "tags": ["状态变化"],
    "reason": "当时记错了",
    "originalMood": "POSITIVE",
    "originalScore": 1,
    "correctionId": 1,
    "correctedAt": "ISO_TIME"
  },
  "correction": { "id": 1, "moodSnapshotId": "mood_id" },
  "persisted": true,
  "degraded": false
}
```

**空态 / 降级 / 错误**：

- 目标或会话不存在、跨用户访问：HTTP 404，`NOT_FOUND`，message=`情绪记录不存在`；禁止 500。
- 输入非法：HTTP 400，`BAD_REQUEST`。
- 未登录：HTTP 401。
- 同一 `clientMutationId` 重放：返回首次结果且不再追加。
- 存储写失败：HTTP 200，`data.persisted=false,data.degraded=true,correction=null,point=原值`；读侧旧值继续可读，UI 回显降级。
- timeline 继续返回旧契约字段；未修正点新增 `tags:[],reason:"",originalMood/originalScore=null,correctionId=null,correctedAt=null`。

### 3.2 `GET /api/v1/export`

- JSON only；`Content-Type: application/json; charset=utf-8`。
- 空库：HTTP 200 + `{"schemaVersion":1,"format":"xinban-json","exportedAt":"ISO","conversations":[]}`，禁止 404/500。
- 授权后只导出当前用户数据。
- 顶层和数组字段冻结；不承诺字段顺序，调用方必须用 JSON 字段断言。
- conversation 内嵌 `messages`、`memories`、`emotion`、`moodSnapshots`；每个 mood snapshot 内嵌 `corrections`。
- 不导出令牌、验证码、支付凭据、刷新会话；财务与合规表不进入本 schema。

## 4. 可机判 DoD 与三元组

| # | 验收项 | 具名测试 | 冒烟步骤 | 状态 |
|---|---|---|---|---|
| V5-1 | 编辑重启持久 | `test_edit_persists_across_restart` | `scripts/smoke.sh` 23-25 | [x] |
| V5-2 | 不存在明确 404 | `test_edit_nonexistent_returns_defined_error` | 26 | [x] |
| V5-3 | latest-wins | `test_correction_latest_wins` | 25 | [x] |
| V5-4 | 写失败保旧值 | `test_correction_write_failure_preserves_old_value` | 28 | [x] |
| V5-5 | 导出空库 | `test_export_empty_db_returns_valid_empty` | 29-30 | [x] |
| V5-6 | v0.4 数据兼容 | `test_v04_data_readable_by_v05` | 23/P01-P09 全链 | [x] |
| V5-7 | UI 即时更新 | `creates the minimal correction form from a selected point`、`applies a correction result immediately or preserves the old point` | 27 | [x] |
| V5-8 | 导出字段/类型 | `serializes the frozen export schema and redacts credential tables` | 29-31 | [x] |

状态必须在三元组证据齐备后才改 `[x]`。

## 5. 终验结果

| 门 | 命令 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| 构建 | `npm run build` | 0 | server tsc + mobile typecheck + Expo Web | `qa-build.log` |
| 全量测试 | `npm test` | 0 | server 13 files / 59 tests；mobile 4 files / 31 tests | `qa-test.log` |
| 持久 | `npm run persist:check` | 0 | P01-P09 | `qa-persist.log` |
| 冒烟 | `npm run smoke` | 0 | 31/31（01-22 基线 + 23-31 增量） | `qa-smoke.log` |
| 死测试 | grep 扫描 | 0 | 0 条 | `final-dead-test-scan.log` |
| 源码 lint | `npx eslint src --max-warnings 0` | 0 | mobile src 通过 | `mobile-src-lint.log` |
| 锚点 | server/mobile targeted Vitest | 0 | 23 + 2 passed | `green-server.log` / `green-mobile.log` / `anchor-tests.txt` |

deploy 脚本已在 build 后对既有 deploy SQLite 执行 additive `prisma db push`，只补齐 `MoodCorrection`，不做破坏性迁移；实际 deploy 仅由工作流 deploy 节点触发。

## 6. 测试与部署顺序

1. 先提交红测并保存 `red-server.log` / `red-mobile.log`。
2. 实现 additive schema、纯函数、路由、UI、导出。
3. `npx vitest run -t '<具名锚点>'` 逐点转绿并保存 `green-server.log` / `green-mobile.log`。
4. `npm run build && npm test && npm run smoke && npm run persist:check`。
5. 全绿后由工作流 deploy 节点部署；本地不手工部署冒充 deploy。
