# 心伴 v0.1（可运行 / 可演示 / 可验收）

心伴是面向单身中老年男性用户的 AI 情感陪伴原型。v0.1 只交付并冻结主链路：

**注册/登录 → 选择角色 → 发送消息并收到回复 → SQLite 持久化 → Expo Web 展示**

完整冻结范围、DoD、盘点清单、契约与审查结论见 [`docs/v01/DELIVERY_REPORT.md`](docs/v01/DELIVERY_REPORT.md)。
人工冒烟步骤见 [`docs/v01/SMOKE.md`](docs/v01/SMOKE.md)。

## 快速验收

```bash
npm run setup   # 首次：安装依赖、生成 Prisma Client、同步 SQLite、写入种子数据
npm run build   # 后端编译 + 移动端类型检查 + Expo Web 静态导出
npm test        # server 20 tests + mobile 21 tests
npm run smoke   # 一条命令：登录、聊天、重启、验证持久化，预期 13/13
```

## 本地启动

```bash
# 后端 standalone HTTP API，默认 http://127.0.0.1:3888
npm run server:dev

# Expo Web / RN 开发服务
npm run mobile:start
```

如 3888 被占用：

```bash
HTTP_PORT=13888 npm run server:dev
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:13888 npx expo start --web
```

开发验证码：`123456`（`SMS_PROVIDER=dev`）。未配置真实 LLM 时，聊天使用离线确定性回复，保证演示不依赖外部 API。

## 模块边界

| 模块 | 路径 | v0.1 职责 |
|---|---|---|
| Mobile 展示 | `apps/mobile` | 登录、首页、角色选择、聊天、token 持久化、Web 导出 |
| HTTP runtime | `apps/server/src/localServer.ts` | CORS、JSON body、路由调度、standalone 启动 |
| 业务 handlers | `apps/server/src/routes` | auth/users/characters/chat 等主链路；商业化等表外能力不验收 |
| 路由适配 | `apps/server/src/http.ts` | 同一 handler 支持 standalone 与 iii 注册 |
| 持久化 | `apps/server/prisma` | SQLite schema、seed、用户/会话/消息/配额/JWT 会话 |
| 冒烟 | `scripts/smoke.sh` | 临时数据库、真实 HTTP、服务重启、13 项断言 |

## v0.1 技术选型

- **Expo / React Native + Expo Web**：复用既有移动端资产，一次源码可演示 Web。
- **Node.js 内置 HTTP + 原有 TypeScript handlers**：避免原型验收依赖进程编排；生产 iii 编排进入 v0.2+。
- **Prisma 7 + better-sqlite3 adapter**：文件级持久化，冷启动可复现，重启冒烟可验证。
- **Vitest + shell smoke**：单元测试保护纯逻辑，端到端脚本保护真实主链路与数据一致性。
