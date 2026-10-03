# 心伴 v0.2 开发说明：冒烟基线固化 + 持久化增量

## 1. 交付顺序与技术选型

1. **IN-1 基线固化**：在装配工作区实测 `build` / `start` / `test`，把命令、退出码与过/挂/死计数写入 `docs/smoke/v0.2-base.md`。
2. **停车场映射**：按三判据逐项分流；满足者进入 IN-2，其余明确留在 v0.2+。
3. **持久层增量**：沿用 Prisma 7 + SQLite 与现有 standalone HTTP runtime，不引入新数据库，不改既有对外请求/响应契约，只新增受保护的情绪状态资源。
4. **降级边界**：会话与消息是主链路数据；情绪状态是伴生数据。情绪写入失败仅记日志，不阻断聊天主链路。
5. **脚本验收**：用真实 HTTP + 独立 SQLite 临时库验证“写入 → kill → 重启 → 读回一致”，并用 SQLite 删除情绪表制造真实持久层失败，断言主链路仍可写消息。
6. **部署复验**：build 后用 `server:start` 部署，健康探针通过，再重跑 build/start/test 并回填 deploy 段。

## 2. 模块边界

| 模块 | 职责 | 不做 |
|---|---|---|
| `prisma/schema.prisma` | 新增 `ConversationEmotion`，绑定会话并级联删除 | 不修改既有模型字段与 API 契约 |
| `src/lib/emotion.ts` | 情绪 CRUD、旧值兼容归一化、安全写入 | 不处理聊天配额、内容过滤、回复生成 |
| `src/routes/chat.ts` | 既有聊天流程成功后安全更新情绪；新增情绪 CRUD 路由 | 不让情绪 CRUD 失败影响既有端点路由 |
| `scripts/persistence-v02.sh` | 临时 SQLite、真实 HTTP、kill/重启、一致性与写失败降级断言 | 不替代 Vitest CRUD 单测 |
| `docs/smoke/v0.2-base.md` | 唯一基线/deploy 留档 | 不重复保存运行日志 |

## 3. 停车场款项映射（三判据：不改既有对外接口 / 单命令可判定 / 失败不阻塞主链路）

| 停车场项 | 判定 | 本轮归属 |
|---|---|---|
| 会话/情绪数据持久化与兼容降级 | 持久化域且三项均满足 | **IN-2** |
| PostgreSQL 生产迁移 | 需要外部数据库凭据/实例，单命令无法在本工作区判定；库不可用会引入主链路故障面 | v0.2+ |
| iii 生产编排 | 需要外部引擎编排，单工作区无法单命令闭环；失败会阻塞启动主链路 | v0.2+ |
| 真实短信/LLM/支付/图像供应商 | 依赖外部服务凭据；无法单命令稳定判定 | v0.2+ |
| 礼物/会员/多角色/形象定制/管理后台扩展 | 展示或商业化增量，非本轮持久化域 | v0.2+ |
| 防沉迷深夜策略 | 策略域且会影响主链路可用性 | v0.2+ |
| 浏览器自动化 UI 测试 / 真机上架合规 | 超出本持久化域，且真机/账号依赖外部环境 | v0.2+ |

## 3.1 新增情绪状态 API（纯增量）

统一挂在既有鉴权后：

- `POST /api/v1/conversations/:id/emotion`：创建，重复创建返回 409。
- `GET /api/v1/conversations/:id/emotion`：读取；不存在或坏值回退 `NEUTRAL`。
- `PATCH /api/v1/conversations/:id/emotion`：更新；不存在返回 404。
- `DELETE /api/v1/conversations/:id/emotion`：删除；不存在返回 404。

请求体：`{ "emotion": "NEUTRAL|POSITIVE|CALM|ANXIOUS|SAD", "score": -1..1, "version": >=1, "payload": {} }`；`payload` 不可读时读取侧整体丢弃。

## 4. 旧数据兼容与失败降级


- **升级路径**：`prisma db push` 为旧 SQLite 增量创建 `ConversationEmotion`；既有用户、会话、消息、好感度字段不变。
- **旧/坏情绪值**：读取时发现不在允许情绪集、分数非法或 JSON 结构不可读，统一丢弃并回退 `NEUTRAL / 0 / version 1`。
- **缺表/持久层异常**：聊天消息已落库后调用 `safeUpsertEmotionFromContent`；异常只写日志，HTTP 仍返回成功。
- **显式定义**：无法迁移或读取的旧情绪伴生态按“丢弃”处理；会话与消息仍以既有 SQLite 数据为准。

## 5. 验收锚点

| DoD | 锚点 |
|---|---|
| IN-1 基线 | `docs/smoke/v0.2-base.md` 基线段 |
| 重启持久性 | `npm run persistence:v02`；退出码 0 |
| 新增量覆盖 | `apps/server/src/lib/emotion.test.ts`（happy + 边界/失败）与 `scripts/persistence-v02.sh` |
| 部署复验 | `docs/smoke/v0.2-base.md` deploy 段 |
