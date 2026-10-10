# 心伴 v0.7 质量验收

结论：**通过 / DEPLOY CLOSED**。阻塞 0，Major 0；独立审查 PASS。

## 1. 门禁机判

| 门 | 命令 | 机判结果 | 证据 |
|---|---|---|---|
| build | `npm run build` | exit 0 | `qa-build.log` |
| start | `node dist/localServer.js` + `/health` | exit 0，`status=up` | `qa-start.log`、`qa-health.json` |
| test | `npm test` | exit 0；server 16 files / 76 tests；mobile 5 files / 33 tests | `qa-test.log` |
| smoke | `npm run smoke` | exit 0；42 / 42 | `qa-smoke.log` |
| persist | `npm run persist:check` | exit 0；9 / 9 | `qa-persist.log` |
| dead tests | 四口径扫描 | 0 | `qa-dead-test-scan.log` |
| lint | `apps/mobile && npx eslint src` | exit 0 | `implementation-mobile-src-lint.log` |

## 2. DoD 机判

- [x] F1 路由：`chat.routes.test.ts > exposes the weekly mood report read API`；用户已登录后可请求新接口。
- [x] F2 窗口/趋势：`moodWeeklyReport.test.ts > builds a 7 day explainable trend from valid corrected points`；用户看到 `WORSENING` 与一句均分解释。
- [x] F3 归因/脏点：`moodWeeklyReport.test.ts > includes exact window boundaries and skips out of window dirty and unattributed points`；越窗、无 ACTIVE 归因、非法分数不显示。
- [x] F4 空态：`chat.routes.test.ts > serves the explicit weekly report empty state before enough valid points` + smoke 40；空库/1 条样本显示固定空态。
- [x] F5 修正：`chat.routes.test.ts > reads persisted corrections into the weekly report` + smoke 39；修正为 NEGATIVE 后负向计数为 2。
- [x] F6 降级：`chat.routes.test.ts > degrades the weekly report when persistence or aggregation fails` + smoke 42；用户只见「暂不可用」。
- [x] F7 客户端：`weeklyReport.test.ts > maps ready empty and degraded weekly report states` + smoke 41；面板三种状态文案齐备。
- [x] F8 Mock/类型：`npm run typecheck` 和全部测试通过；离线 API 暴露同一 `getMoodWeeklyReport`。
- [x] F9 兼容：smoke 01-38 全绿、persist 9/9；轨迹、修正、导出导入无回退。

## 3. 红绿证据链

- 红：服务端 4 个路由/行为用例失败 + mobile 模块缺失；`red_server_exit=1`、`red_mobile_exit=1`。
- 绿：新增 server 周报纯函数/路由 20 tests、mobile 状态映射 2 tests；随后全仓 76+33 tests 全绿。
- 内容断言非渲染烟雾：趋势、窗口、计数、修正后 mood/score、reason 文案、空态和降级状态均有具名断言。

## 4. 兼容与安全复核

- `git diff` 无 `prisma/schema.prisma` 变更；无 destructive migration。
- 旧路由名、path、method、请求/响应字段未删除或改义；新路由 additive。
- 鉴权先行，`conversation.findFirst({ id, userId })` 阻断越权；失败路径不透出原始行数据。
- `reason` 只包含样本量和均分规则；keywords 只来自既有结构化关键词。

## 5. 遗留停车场

图表渲染、推送、环比、跨会话聚合、自定义窗口、行动建议、真实 LLM 文案；均不阻塞本轮签收。

## 6. 部署后终态

- `npm run deploy:v02` exit 0；build/start/test 复跑全绿，见 `deploy-replay.log`。
- 部署后 smoke 42 / 42、persist 9 / 9，与部署前一致，见 `post-deploy-smoke.log`、`post-deploy-persist.log`。
- AppHost 发布包 PUT 200、签名回读 200、SHA256 一致，见 `apphost-upload.log`、`apphost-download-check.log`。
- 独立代码审查 Agent 复验 PASS，0 blocker / 0 major；4 个 minor 全部记录且不阻塞，见 `evidence/independent-code-review.md`。
