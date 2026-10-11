# 心伴 v0.6 基线确认

## 1. 装配修正

- 平台初始分支只包含 `main@c63cd3b`（v0.4 合入），缺少 v0.5 交付。
- 本轮已从远端装配分支 `myrd/v05-json-deploy-id-cmuvv1ya80154icry4hbxbhgj` 显式合并为 v0.6 基线，未使用纸面假设。
- 合并后复跑下列门槛，作为本轮增量前证据。

## 2. 复跑结果

| 门 | 命令 | 退出码 | 对照 docs/smoke/v0.5.md | 证据 |
|---|---|---:|---|---|
| build | `npm run build` | 0 | server tsc + mobile typecheck + Web export | `baseline-build.log` |
| start | standalone `/health` | 0 | `status=up / mode=standalone` | `baseline-start.log`、`baseline-health.json` |
| test | `npm test` | 0 | server 13 files / 59 tests；mobile 4 files / 31 tests | `baseline-test.log` |
| smoke | `npm run smoke` | 0 | `31 项 / 31 项` | `baseline-smoke.log` |
| persist | `npm run persist:check` | 0 | `9 项，exit=0` | `baseline-persist.log` |

结论：与 v0.5 基线一致，无阻塞级漂移。

## 3. 死测试清账

| 口径 | 扫描模式 | 数量 |
|---|---|---:|
| skip | `\.skip\b` | 0 |
| only | `\.only\b` | 0 |
| todo | `\.todo\b` | 0 |
| xit/xdescribe | `\<xit\(|\<xdescribe\(` | 0 |

合并扫描与 Vitest 输出复核：`DEAD_TEST_COUNT=0`，无 skipped/todo。证据：`baseline-dead-test-scan.log`。

## 4. 情绪轨迹可视化三证据结论

判据：代码接线、具名测试、端到端冒烟三者齐备才可判“已落地”。

1. **代码接线**：`ChatScreen.tsx` 调用 `api.getMoodTimeline`，渲染 `MoodTimelinePanel`；后端注册 `GET /api/v1/conversations/:id/mood-timeline`。
2. **具名测试**：`conversationInsights.test.ts` 锁定结构化快照；`chat.routes.test.ts` 锁定路由、空态与降级。
3. **端到端冒烟**：v0.5 冒烟步骤 16/17/19/20/23/25 全绿，覆盖结构化输出、非像素契约、空态、修正写侧与 latest-wins。

落地结论：情绪轨迹可视化已达到“三证据落地”，本轮只做兼容回归，不改 UI。
