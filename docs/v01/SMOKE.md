# 心伴 v0.1 冒烟复现文档

本文档描述与 `scripts/smoke.sh` 相同的主链路；自动脚本是最快验收方式，人读步骤用于演示和排查。

## 0. 前置

- Node.js 22+（当前验证环境 Node 26）、npm 11+。
- macOS/Linux shell；Windows 建议 WSL。
- 不需要预装数据库：v0.1 默认使用 SQLite 文件。
- 不依赖任何 Open Design daemon；只依赖本 worktree 与本地 Node/npm。

## 1. 一条命令自动冒烟

```bash
npm run smoke
```

成功判据：

1. 命令退出码为 `0`。
2. 输出最后一行包含：`心伴 v0.1 冒烟通过：13 项 / 13 项`。
3. 步骤 01 到 13 每行均以 `✅` 开头，其中 10-12 证明服务重启后消息仍在。

脚本行为：创建临时目录和临时 SQLite → Prisma push/seed → 启动 standalone API → 注册/登录 → 读角色 → 建会话 → 发消息 → 等 AI 回复完成 → 重启同一数据库 → 轮询消息 → 刷新 token → 清理进程/临时目录。可用 `KEEP_SMOKE_DIR=1 npm run smoke` 保留日志与数据库，`XINBAN_SMOKE_PORT=13888` 换端口。

## 2. 人工启动后端

```bash
npm run setup          # 首次执行：安装 server/mobile 依赖，生成 Prisma client，push schema，seed
npm run server:dev     # 默认 http://127.0.0.1:3888
```

另开终端检查：

```bash
curl http://127.0.0.1:3888/health
```

成功：返回 `{"code":"OK",...,"data":{"service":"xinban-ai","status":"up",...}}`。

如 3888 被占用，用其他端口：

```bash
HTTP_PORT=13888 npm run server:dev
```

## 3. 人工启动 Expo Web 展示

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:3888 npx expo start --web
```

浏览器打开终端显示的 Local 地址。Android 模拟器将 API 地址换为 `http://10.0.2.2:3888`；真机使用电脑局域网 IP。

也可先导出静态站点：

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://127.0.0.1:3888 npm run export -- --platform web --output-dir dist-web --clear
python3 -m http.server 4173 --directory dist-web
```

浏览器打开 `http://127.0.0.1:4173`。

> **重要**：`EXPO_PUBLIC_API_URL` 在构建期固化进产物。根目录 `npm run build` 已默认注入 `http://127.0.0.1:3888` 并加 `--clear` 清 Metro 缓存（Metro transform 缓存不感知该环境变量变化，缺 `--clear` 时可能导出旧配置/演示数据模式）。手动导出务必带 `--clear`。

## 4. 人读主链路步骤

1. **注册/登录**：打开 Web 页，输入任意合法 11 位手机号（如 `13900001234`），点击获取验证码。开发 SMS 返回/接受验证码 `123456`。输入后登录，应进入首页且无登录页弹回。
2. **展示角色**：从首页/角色入口进入选择页，应看到“林晚晴”“阿秀”等免费角色。选择林晚晴进入聊天。
3. **核心交互**：输入“冒烟测试：今天想听你说说话”并发送。用户气泡立即出现；短暂输入中后，助手气泡出现非空内容。
4. **持久化检查**：回到后端终端 `Ctrl+C` 停止，再次 `HTTP_PORT=3888 npm run server:dev`。刷新 Web 页或重新登录后进入同一会话，原用户与助手消息仍存在。
5. **退出登录**：执行退出后返回登录页；刷新页面也不会自动恢复已退出会话。

## 5. 与脚本判据对照

| 人读步骤 | 脚本步骤 | 判定 |
|---|---|---|
| 2 后端健康 | 01 | `/health` 包含 `status=up` |
| 4.1 发码/登录 | 02-04 | 返回 token；无 token 401 |
| 4.2 角色展示 | 05 | 返回林晚晴 |
| 4.3 发消息/回复 | 07-09 | USER 落库，ASSISTANT 最终 `COMPLETED` |
| 4.4 重启保留 | 10-12 | 重启后消息与状态存在 |
| 登录态维持 | 13 | refresh token 换新 access token |

## 6. 常见失败

| 现象 | 处理 |
|---|---|
| `EADDRINUSE` / 3888 占用 | 换 `HTTP_PORT=13888 npm run server:dev`，同时把 `EXPO_PUBLIC_API_URL` 指向同端口 |
| 首次报 Prisma client 未生成 | 在 `apps/server` 执行 `npx prisma generate`，或重跑 `npm run setup` |
| Web 页网络失败 | 确认 `EXPO_PUBLIC_API_URL` 在启动/导出前设置；静态导出后环境变量已固化 |
| Web 页显示演示数据、不走真实登录 | 导出时缺 `EXPO_PUBLIC_API_URL` 或缺 `--clear`（Metro 缓存）；重跑 `npm run build`，或手动导出补两个参数 |
| `apps/server/.env` 覆盖了文档默认端口 | `.env` 优先级高于默认值；以 `npm run server:dev` 启动日志打印的 `port` 为准，或直接改 `.env` 的 `HTTP_PORT` |
| 验证码 60 秒限制 | 换一个手机号，或等待 60 秒 |
| 冒烟端口占用 | `XINBAN_SMOKE_PORT=13889 npm run smoke` |
