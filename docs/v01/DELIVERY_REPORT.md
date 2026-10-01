# 心伴 v0.1 交付报告（冻结执行版）

- 分支：`myrd/v01-cancelled-dod-v02-cmuq57cax00aym9dhcxbj8pqw`
- 结论：**可交付**。主链路“注册/登录 → 核心交互 → 持久化 → 展示”已实现、可构建、可启动、可验收。
- 技术路径：沿用既有 Expo/React Native 前端与 TypeScript/Prisma 后端资产；为 v0.1 增加**零第三方框架的 standalone Node HTTP runtime**，复用原有 iii handler，避免演示启动依赖外部引擎进程。持久化采用 SQLite 文件数据库（`file:./data/xinban-dev.db`），保证一条命令冷启动、种子化与重启数据可复现。PostgreSQL/iii 生产编排延后到 v0.2+。

## 1. 现状盘点

### 1.1 已有能力清单（按主链路覆盖度）

| 环节 | 能力 | v0.1 覆盖度 |
|---|---|---|
| 注册/登录 | 手机号验证码、开发码 `123456`、JWT access/refresh、刷新轮换、401 拦截、Expo 登录页 | 覆盖 |
| 核心交互 | 角色列表、单角色会话、用户消息、后台 AI 回复、配额、内容过滤、好感度 | 主链路覆盖；真实 LLM 可配置，未配置时确定性离线回复 |
| 持久化 | Prisma schema：用户/会话/消息/配额/JWT 会话；种子角色 | 覆盖；SQLite 冷启动与重启校验 |
| 展示 | 登录页、首页、角色选择、聊天页、状态条；Expo Web 静态导出 | 覆盖；原生/桌面模拟器非 v0.1 阻塞 |

### 1.2 缺口清单

| 分类 | 缺口 | 处理 |
|---|---|---|
| 必需 | 原 HTTP 路由只绑定 iii 引擎，演示启动受外部进程/端口影响 | 已补 standalone runtime |
| 必需 | 默认 Prisma 数据源与运行适配器不一致，新环境无确定性数据库 | 已切 SQLite + 驱动适配器 |
| 必需 | 无一条命令跑注册/聊天/重启持久化 | 已补 `scripts/smoke.sh` |
| 必需 | Expo Web 缺少 `react-dom` / `react-native-web`，静态导出失败 | 已补依赖并通过导出 |
| 必需 | 端口文档不一致（3111/3888） | 统一默认 3888，脚本可用环境变量覆盖 |
| 可延后 | 真实短信、微信/支付宝、真实 DeepSeek、Seedream 图像 | v0.2+，保留 provider 抽象 |
| 可延后 | 礼物、会员、多角色、形象定制、防沉迷深夜策略、管理后台 | v0.2+ |
| 可延后 | iii 引擎部署、Prisma migrations、PostgreSQL 生产库 | v0.2+ |
| 可延后 | 自动化浏览器 UI 断言、iOS/Android 真机冒烟 | v0.2+ |

### 1.3 测试结果清单

| 测试 | 基线结果 | 当前结果 |
|---|---|---|
| `apps/server` Vitest | 初次安装后 3 个 suite 因未生成 Prisma client 导入失败；生成后 5/5 过、20/20 过 | 过：5 suite / 20 tests |
| `apps/mobile` Vitest | 过：2 suite / 21 tests | 过：2 suite / 21 tests |
| `npm run smoke` | 原脚本仅覆盖 API 建会话，未覆盖聊天回复/重启 | 过：13/13 |
| 主链路死测试 | 无 | 无 |
| Skip 测试 | 无 | 无；本轮未删除测试 |

基线技术建议：**部分可构建 → 修复续用**。不重写；保留前端、业务 handler、Prisma 模型与测试。

## 2. 冻结范围与 DoD

范围冻结原则：只保主链路四环节 + 四个全局项。表外能力进入 v0.2+ 停车场，不在本轮扩范围。

### 2.1 DoD 打勾表

| # | 验收项 | 可判定口径 | 验证锚点 | 状态 |
|---|---|---|---|---|
| F-1 | 注册/登录 | 新手机号可获取开发验证码并以 `123456` 登录；返回 access/refresh token；无 token 访问受保护 API 返回 401 | `npm run smoke` 步骤 02-04；`apps/server/src/lib/auth.test.ts` | [x] |
| F-2 | 核心交互 | 能读取至少 1 个可用角色；向会话发送文本后创建 USER 消息并生成 ASSISTANT 回复；回复最终 `COMPLETED` | `npm run smoke` 步骤 05、08-09；`apps/server/src/lib/chatEngine.ts` | [x] |
| F-3 | 持久化 | 服务使用同一 SQLite 文件重启后，会话、用户消息、助手消息仍可读取且消息状态一致 | `npm run smoke` 步骤 07、10-12 | [x] |
| F-4 | 展示 | Expo Web 可构建出静态 `index.html`；登录页可调用后端登录，聊天页可显示用户与助手消息 | `npm run build`；`docs/v01/SMOKE.md` 人读步骤 W1-W5 | [x] |
| F-5 | 全局构建 | 根目录一条命令完成后端编译、前端类型检查与 Web 静态导出 | `npm run build` | [x] |
| F-6 | 全局启动 | 后端 standalone 服务一条命令启动，`/health` 返回 `status=up` | `npm run server:dev` + `curl /health`；smoke 步骤 01 | [x] |
| F-7 | 冒烟脚本 | 一条命令创建临时 SQLite、启动、登录、发消息、重启、校验持久化并返回 0 | `npm run smoke` 输出 13/13 | [x] |
| F-8 | 冒烟文档 | 人读复现步骤与脚本步骤一致，包含环境变量、成功判据、常见失败 | `docs/v01/SMOKE.md` | [x] |

### 2.2 v0.2+ 停车场

真实短信/LLM/支付/图像供应商、礼物与会员完整商业化、多角色同台、形象定制、管理后台、防沉迷深夜策略、PostgreSQL 生产迁移、iii 生产编排、浏览器自动化 UI 测试、真机上架合规。

## 3. 主链路 API 契约

统一响应信封：HTTP 200/201/4xx/5xx + `{ "code": string, "message": string, "data": unknown }`；错误码示例 `BAD_REQUEST`、`UNAUTHORIZED`、`NOT_FOUND`。

### `GET /health`

响应 `data`：`{ service: 'xinban-ai', status: 'up', mode: 'standalone', time: string }`

### `POST /api/v1/auth/sms-code`

```json
{ "phone": "13900000000", "purpose": "LOGIN" }
```

响应 `data`：`{ sent: true, expiresIn: 300, devCode?: '123456' }`；开发 SMS provider 固定返回 `devCode`。

### `POST /api/v1/auth/login`

```json
{ "phone": "13900000000", "code": "123456" }
```

响应 `data`：

```ts
{
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; phone: string; nickname?: string | null; avatarUrl?: string | null; role: 'USER' | 'ADMIN' }
  compliance: { aiNotice: string }
}
```

后续受保护请求带 `Authorization: Bearer <accessToken>`。

### `GET /api/v1/characters`

响应 `data`：`Character[]`；列表只查询 `ACTIVE` 角色，序列化项含 `id/name/title/isMemberOnly/locked/affection`。

### `POST /api/v1/conversations`

```json
{ "characterId": "<id>", "mode": "SINGLE" }
```

响应 201，`data.conversationId` 使用字段 `id`；包含 `userId`、`characterId`、`mode`、`messages: []`。

### `POST /api/v1/chat/send`

```json
{
  "conversationId": "<id>",
  "characterId": "<id>",
  "content": "今天想听你说说话"
}
```

响应 `data`：`{ conversationId, userMessage: Message, assistantMessage: Message, quota, affection, typing: true }`。
`assistantMessage` 初始为 `TYPING`，后台落库完成后通过消息列表轮询为 `COMPLETED`。

### `GET /api/v1/conversations/:id/messages`

响应 `data`：`{ items: Message[], hasMore: boolean }`；`Message.role` 为 `USER|ASSISTANT`，`Message.status` 为 `TYPING|COMPLETED`。

### `GET /api/v1/users/me/status`

响应 `data.quota`：`{ used, limit, remaining, unlimited }`；`data.compliance.aiNotice` 必须展示。

## 4. 交付顺序与增量审查

| 顺序 | 增量 | 审查结论 |
|---|---|---|
| 1 | 冻结报告/契约/清单 | 通过 |
| 2 | standalone router + Node HTTP + SQLite 适配 + 端口统一 | 通过 |
| 3 | 全链路冒烟脚本与重启持久化断言 | 通过 |
| 4 | Expo Web build + 根编排 + 人读冒烟文档 | 通过+建议：v0.2 增加浏览器 UI 自动断言 |

阻塞级审查项均未发现；不阻塞交付的建议已写入停车场或下节。

## 5. 终检

- 冒烟实跑：`npm run smoke` 通过 13/13，退出码 0。
- 冒烟文档：`docs/v01/SMOKE.md` 与脚本 13 个判据一致。
- DoD 表：F-1 到 F-8 全勾。
- 命令：`npm run build`、`npm test` 通过。
- 红线遵守：未探测、未依赖、未记录 Open Design daemon 7456；所有验证均在本平台装配 worktree 与继续分支执行；部署保留给默认工作流 deploy 节点。
