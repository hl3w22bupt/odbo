# 心伴AI · 前后端测试脚本

一套整理好的启动 / 停止 / 测试脚本，统一管理服务端与客户端。

## 端口约定

| 服务 | 端口 | 说明 |
|---|---|---|
| 服务端 HTTP API | **3888** | 心伴独立端口（iii 引擎 iii-http） |
| iii 引擎 WebSocket | **49144** | Worker 连接引擎（iii-worker-manager） |
| Expo Metro | 8081 | 客户端开发服务器 |

> 原端口 3111 / 49134 与其他 app 的 iii 引擎冲突，已整体迁移。

## 使用

```bash
# 一键启动服务端
./scripts/dev-up.sh

# 启动服务端 + Expo 客户端（iOS 模拟器，连真实后端）
./scripts/dev-up.sh --client

# 启动客户端（离线 mock 模式，不连后端）
./scripts/dev-up.sh --mock

# 一键停止（只停心伴进程，不动其他 app 的引擎）
./scripts/dev-down.sh

# 后端 API 全链路测试（健康检查 → 验证码 → 登录 → 鉴权 → 数据 → 刷新）
./scripts/api-test.sh
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `API_BASE` | `http://localhost:3888` | 测试目标地址 |
| `TEST_PHONE` | `13800138000` | 测试手机号（换一个可避开验证码防刷） |
| `TEST_CODE` | `123456` | 开发期固定验证码 |
| `API_URL` | `http://localhost:3888` | dev-up 时注入客户端的 API 地址 |

## 文件说明

| 文件 | 作用 |
|---|---|
| `api-test.sh` | curl 全链路测后端：健康检查、验证码、登录、鉴权拦截、角色/会话/礼物/会员/商品/合规、token 刷新、建会话。输出 ✅/❌ 并统计通过数，退出码 0=全过 |
| `dev-up.sh` | 启动服务端（后台，日志 `logs/server.log`）；`--client` 追加 Expo，`--mock` 走离线数据。写 PID 到 `logs/*.pid` |
| `dev-down.sh` | 按 PID 递归停止服务端与客户端；兜底按特征清理本项目 tsx worker 与 `iii -c config.yaml` 引擎。**不会**动其他 app 的 `iii --use-default-config` 引擎 |

## 排查要点（本次整理踩过的坑）

1. **不要在有 shell 里残留的手动启动的 worker** —— 旧 worker 可能连错引擎 / 用错 `DATABASE_URL`，导致 `prisma.*: Database dev.db does not exist`。统一用 `dev-up.sh` / `dev-down.sh` 管理。
2. **`.env` 必须存在**：`apps/server/.env` 里 `DATABASE_URL` 指向本机 PostgreSQL 的 `xinban_dev`（`postgresql://leo@localhost:5432/xinban_dev?schema=public`），否则默认 `file:./dev.db` 会连错。
3. **验证码防刷**：同一手机号 60 秒内不能重发，测试换手机号或等待。
4. **cron worker 缺失**：`iii-cron` 未启用时，"主动分享见闻"定时任务不注册，不影响登录等核心链路。
