# 心伴AI · 后端服务

面向单身中老年男性群体的纯 AI 异性情感陪伴 App「心伴AI」的生产级后端。

基于 **iii engine**（[github.com/iii-hq/iii](https://github.com/iii-hq/iii)）+ **TypeScript Worker（iii-sdk）** 构建。
Worker 通过 `registerWorker(process.env.III_URL)` 连接引擎，用 `worker.registerFunction(...)` 注册业务函数，
再用 `worker.registerTrigger({ type: 'http', function_id, config: { api_path, http_method } })` 绑定为 REST 接口。

## 功能总览

| 模块 | 说明 |
| --- | --- |
| 用户体系 | 手机号验证码登录（短信供应商抽象，开发期固定验证码 123456）、JWT 访问令牌 + 刷新令牌轮换、RBAC（用户/管理员） |
| 角色管理 | 4 位人设（林晚晴·温婉知己 / 阿秀·爽朗直爽 / 小满·俏皮灵动 / 苏雅·成熟通透），职业/方言/性格提示词模板，形象与命名定制 |
| 对话 | LLM 供应商抽象（默认 DeepSeek），按人设生成回复；随机回复间隔 1-3s + 输入中状态；消息落库 + 前端轮询兜底；多角色同台性格隐性博弈 + 好感度进度条；主动分享见闻定时推送 |
| 商业化 | 免费 120 条/日（按用户+日期计数）、会员月/季/年卡权益对比、单点内购（专属剧情/语气包/礼物）、支付网关抽象（微信/支付宝适配器占位 + 订单表 + 回调验签） |
| 礼物系统 | 礼物表 + 送礼接口 → 按人设回语 + 好感度增减 + 浮动动画数据；限量礼物做会员校验 |
| 形象生成 | 图像供应商抽象（默认豆包 Seedream / 火山引擎占位），接收角色名/发型/穿搭/音色生成专属形象 |
| 合规 | AI 虚拟角色提示条、防沉迷（深夜/连续使用拦截）、理性消费（大额支付二次确认）、内容过滤（自建敏感词库 + 审核日志） |

## 技术栈

- **iii-sdk** `0.22` — iii engine 的 TypeScript Worker
- **Prisma** `7.9`（`prisma-client` generator + 驱动适配器，PostgreSQL）
- **jose** `6` — JWT
- **openai** `7` — DeepSeek / OpenAI 兼容 LLM 客户端
- **zod** — 参数校验（可扩展）
- **vitest** — 单元测试

## 目录结构

```
apps/server/
├── config.yaml             # iii engine 配置（iii-http / iii-observability / queue）
├── prisma.config.ts        # Prisma 7 CLI 配置
├── prisma/
│   ├── schema.prisma       # 全量数据模型
│   └── seed.ts             # 种子：4 角色 / 商品 / 礼物 / 管理账号 / 敏感词
├── scripts/dev.mjs         # dev：启动引擎 + 连接 worker
├── src/
│   ├── index.ts            # 入口：registerWorker + 注册所有函数/触发器
│   ├── http.ts             # HTTP 路由层（function + http trigger 封装）
│   ├── db.ts               # Prisma 客户端（PG 适配器）
│   ├── config.ts           # 环境配置
│   ├── lib/                # 基础设施：auth/sms/llm/image/payment/contentFilter/quota/antiAddiction/...
│   ├── routes/             # 业务路由：auth/users/characters/chat/gifts/commerce/images/compliance/admin
│   └── proactive.ts        # 主动分享见闻（cron trigger）
└── .env.example
```

## 快速开始

### 1. 安装依赖

```bash
cd apps/server
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env：
#   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<db>?schema=public
#   DEEPSEEK_API_KEY=sk-xxx        # 未配置时使用离线回退回复
#   SMS_PROVIDER=dev               # 开发期验证码固定 123456
```

### 3. 初始化数据库

```bash
npx prisma generate   # 生成客户端（已跑通）
npx prisma db push    # 建表
npm run prisma:seed   # 初始化种子数据
```

### 4. 启动服务

```bash
npm run dev
```

脚本会：① 启动 iii 引擎（读取 `config.yaml`）；② 等待引擎 WebSocket 就绪；③ 连接 TypeScript Worker。

- HTTP API：`http://localhost:3111`
- 引擎 WebSocket：`ws://localhost:49134`

### 5. 测试 / 构建

```bash
npm test          # vitest 单元测试（20 个用例）
npm run build     # tsc 编译到 dist/
npm start         # node dist/index.js（生产运行）
npm run typecheck # 类型检查
```

## API 一览

### 认证 / 用户
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/sms-code` | 发送验证码（开发期返回 `devCode: 123456`） |
| POST | `/api/v1/auth/login` | 手机号 + 验证码登录，返回 accessToken / refreshToken |
| POST | `/api/v1/auth/refresh` | 刷新令牌轮换 |
| POST | `/api/v1/auth/logout` | 登出（吊销会话） |
| GET | `/api/v1/users/me` | 当前用户信息 |
| PATCH | `/api/v1/users/me` | 更新资料 |
| GET | `/api/v1/users/me/status` | 配额 / 会员 / 防沉迷状态聚合 |

### 角色
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/characters` | 角色列表（会员角色锁定态） |
| GET | `/api/v1/characters/:id` | 角色详情 |
| POST | `/api/v1/characters/:id/customize` | 形象与命名定制（角色名/发型/穿搭/音色） |
| GET | `/api/v1/characters/:id/customization` | 查看定制 |
| GET | `/api/v1/characters/:characterId/affection` | 好感度状态 |

### 对话
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/chat/send` | 单角色发送（TYPING 占位 + 异步生成） |
| POST | `/api/v1/chat/multi/send` | 多角色同台发送 |
| POST | `/api/v1/conversations` | 创建会话 |
| GET | `/api/v1/conversations` | 会话列表 |
| GET | `/api/v1/conversations/:id/messages` | 消息轮询（`?after=&limit=`） |
| POST | `/api/v1/chat/proactive` | 手动触发主动分享（调试） |

### 礼物 / 商业化
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/gifts` | 礼物列表 |
| POST | `/api/v1/gifts/:id/send` | 送礼（回语 + 好感度 + 动画） |
| GET | `/api/v1/products` | 商品列表 |
| GET | `/api/v1/membership/plans` | 会员权益对比表 |
| GET | `/api/v1/membership` | 我的会员 |
| POST | `/api/v1/orders` | 创建订单 |
| POST | `/api/v1/orders/:id/pay` | 发起支付（大额需先 confirm） |
| POST | `/api/v1/orders/:id/confirm` | 大额支付二次确认 |
| POST | `/api/v1/pay/wechat/notify` | 微信支付回调（验签） |
| POST | `/api/v1/pay/alipay/notify` | 支付宝回调（验签） |

### 形象 / 合规
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/images/generate` | 生成专属形象（Seedream 占位） |
| GET | `/api/v1/compliance/status` | AI 提示条 / 防沉迷 / 理性消费 |

### 管理端（RBAC: ADMIN）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/admin/users` | 用户列表 |
| POST | `/api/v1/admin/users/:id/ban` / `/unban` | 封禁 / 解封 |
| GET/POST | `/api/v1/admin/characters` | 角色管理 |
| PUT | `/api/v1/admin/characters/:id` | 更新角色 |
| GET | `/api/v1/admin/audit-logs` | 审计日志 |
| GET | `/api/v1/admin/content-audit-logs` | 内容审核日志 |
| POST | `/api/v1/admin/sensitive-words` | 新增敏感词 |
| GET | `/api/v1/admin/stats` | 统计 |

> 管理账号：种子默认 `13800000000`，开发期验证码 `123456`。

## 供应商抽象

| 抽象 | 默认 | 切换 |
| --- | --- | --- |
| 短信 | `dev`（固定验证码 123456） | `.env` `SMS_PROVIDER=aliyun|tencent` |
| LLM | DeepSeek（OpenAI 兼容） | `LLM_PROVIDER=openai` |
| 图像 | 豆包 Seedream（火山引擎占位） | `IMAGE_PROVIDER=seedream` |
| 支付 | `mock` | `PAY_PROVIDER=wechat|alipay` |

未配置密钥时均提供占位/回退，保证开发与演示环境可用。

## 对话体验设计

- **输入中状态**：`POST /chat/send` 立即返回 `assistantMessage.status = TYPING`；后台在随机 1-3s 延迟后调用 LLM 生成回复并置为 `COMPLETED`。前端通过 `GET /conversations/:id/messages` 轮询状态流转。
- **多角色同台**：每位伴友感知在场他人 → 按性格隐性博弈（吃醋/调侃/争宠）；好感度 `affection.progress` 进度条随对话/送礼变化。
- **主动分享见闻**：cron 触发器（默认每 30 分钟）扫描空闲会话，让伴友主动分享生活见闻（`type=PROACTIVE`）。

## 合规说明

- 登录与所有会话响应携带 `compliance.aiNotice`（AI 虚拟角色提示条）。
- 防沉迷：深夜时段（23:00-06:00）与连续使用时长拦截。
- 理性消费：单笔 ≥ `LARGE_PAYMENT_THRESHOLD_CNY`（默认 500 元）需二次确认。
- 内容过滤：自建敏感词库（内置 + 数据库可扩展），输入/输出双向过滤，命中写入 `ContentAuditLog`。

## 环境变量

完整配置见 [`.env.example`](./.env.example)。

## License

Apache-2.0
