# 心伴 v0.6 质量验收报告

结论：**开发、质量、仓库 production deploy 复验与 AppHost 资产导出通过**；见 `DEPLOY.md`。

## 1. 门禁

| 门 | 命令 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| 构建 | `npm run build` | 0 | server tsc + mobile typecheck + Web export | `qa-build.log` |
| 全量测试 | `npm test` | 0 | server 15 files / 70 tests；mobile 4 files / 31 tests | `qa-test.log` |
| 冒烟 | `npm run smoke` | 0 | 38/38 | `qa-smoke.log` |
| 持久 | `npm run persist:check` | 0 | 9/9 | `qa-persist.log` |
| 死测试 | 四类 grep + Vitest 输出 | 0 | 0 skipped/todo | `final-dead-test-scan.log` |
| Mobile lint | `npx eslint src --max-warnings 0` | 0 | 通过 | `mobile-src-lint.log` |
| deploy | `npm run deploy:v02` | 0 | build/start/test 全 0 | `deploy-replay.log` |
| 部署后冒烟 | `npm run smoke` | 0 | 38/38 | `post-deploy-smoke.log` |
| 部署后持久 | `npm run persist:check` | 0 | 9/9 | `post-deploy-persist.log` |
| 红测 | targeted Vitest | 1 | 模块缺失 2 suites 红 | `red-server.log` |
| 绿锚点 | targeted Vitest | 0 | 11 passed | `green-import-pure.log`、`green-import-anchor.log` |

## 2. DoD 机判映射

| DoD | 机判方式 | 结论 |
|---|---|---|
| F1 API 契约 | route capture + HTTP 200 response keys | PASS |
| F2 实体恢复 | SQLite count 6 类业务记录 | PASS |
| F3 分列 | 422 零写入 + mixed batch imported/skipped | PASS |
| F4 版本门 | missing/higher fixed codes + HTTP 422 | PASS |
| F5 幂等 | same payload twice + counts unchanged | PASS |
| F6 往返 | export→import→export JSON equality | PASS |
| 兼容 | v0.4/v0.5 smoke 01-31 + persist P01-P09 | PASS |

## 3. 冒烟增量

- 33：备份导入后 `imported==received`。
- 34：导出 conversations 与导入源逐字段一致。
- 35：重复导入全部 `CONVERSATION_EXISTS`，导出不变。
- 36/37：版本缺失/高版本 422。
- 38：schema 非法 422。

## 4. 安全与兼容

- 全部写入强制 Bearer 鉴权并绑定 `authUser.id`。
- 只恢复用户业务数据；不导入凭据、验证码、刷新会话、订单。
- 主键保留作为幂等锚点，禁止静默覆盖已存在 conversation。
