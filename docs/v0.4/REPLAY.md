# 心伴 v0.4 复跑验收（2026-10-05，R2 轮）

本轮为 v0.4 交付后的独立复跑轮：不新增功能，全部门禁重新实跑，并对照 `docs/smoke/v0.3.md`、`docs/smoke/v0.4.md` 逐条判定一致/漂移。

## 1. 三命令 + 双硬门复跑结果

| 门 | 命令 | 实跑结果 | 对照文档 | 判定 |
|---|---|---|---|---|
| build | `npm run build` | exit `0`；server tsc + mobile typecheck + Expo Web 导出（332 modules） | `docs/smoke/v0.3.md` §3 构建产物门 | 一致 |
| start | `apps/server` `npm run start:standalone`（产物 `dist/localServer.js`） | `/health` → `{"status":"up","mode":"standalone"}`，退出信号正常关闭 | `docs/smoke/v0.3.md` §3 产物启动门 | 一致 |
| test | `npm test` | exit `0`；server 9 files / 46 tests，mobile 3 files / 29 tests | `docs/smoke/v0.4.md` §3 测试门 | 一致 |
| smoke | `npm run smoke` | exit `0`；`心伴 v0.4 冒烟通过：22 项 / 22 项`（01-19 全绿 + 20-22 增量） | `docs/smoke/v0.4.md` §1-§2 | 一致 |
| persist | `npm run persist:check` | exit `0`；P01-P09 共 9 项（含 P05 kill → P06 重启 → P07/P08 读回一致 → P09 降级） | `docs/smoke/v0.4.md` §3 持久门 | 一致 |

漂移清单：**0 条阻塞级、0 条非阻塞级**。文档引用的证据文件（含 `v04-smoke.log`、`v04-persist.log`）全部存在。

## 2. v0.3 P1（情绪轨迹可视化）落地复核

以代码 + 测试双证据复核，结论不变：**已实际落地**。

| 证据 | 本轮复核结果 |
|---|---|
| `apps/server/prisma/schema.prisma > model MoodSnapshot` | 存在；结构化 `mood/score/keywords`，`memoryId` 归因来源 |
| `apps/server/src/lib/conversationInsights.ts` | `serializeMood`（L145）/ `readableMoodTimeline`（L173）导出存在 |
| `apps/server/src/routes/chat.ts` | `GET /api/v1/conversations/:id/mood-timeline` 注册于 L711 |
| `apps/mobile/src/components/MoodTimelinePanel.tsx` | 存在并接入 `ChatScreen.tsx` |
| 测试锚点 | `conversationInsights.test.ts > serializes mood snapshots with structured keywords`；`chat.routes.test.ts > degrades the mood timeline read...`；`insights.test.ts > asserts timeline content instead of pixels`、`> uses empty and degraded states...` 全部命中且本轮随套件全绿 |
| 冒烟 | 16（结构化快照）/17（内容非像素）/19（空态契约）本轮全绿 |

## 3. v0.4 P0 DoD 逐条锚点复核

13 个锚点测试名逐一 grep 源树命中（见 §5 证据），且本轮 `npm test` 全绿：

| DoD | 锚点命中 | 状态 |
|---|---|---|
| V4-1 服务端洞察契约 | moodInsight.test.ts 2 例 | [x] |
| V4-2 脏数据与降级 | moodInsight 2 例 + chat.routes 3 例 | [x] |
| V4-3 HTTP 兼容 | chat.routes exposes + v0.3 既有行为测试原样全绿 | [x] |
| V4-4 客户端读视图 | insights.test.ts 3 例 + MoodInsightPanel | [x] |
| V4-5 全链路 | smoke 20/21/22 本轮 exit 0 | [x] |
| V4-6 v0.3 持久门 | persist P01-P09 本轮 exit 0 | [x] |
| V4-7 死测试清账 | 本轮扫描 0 命中；Vitest 输出无 skipped/todo | [x] |

## 4. 五条阻塞级拦截标准（本轮复查）

| # | 拦截标准 | 本轮证据 | 判定 |
|---|---|---|---|
| B1 | 无锚点或锚点失败 | 13/13 锚点命中且全绿 | 未触发 |
| B2 | 破坏 v0.3 冒烟基线 | smoke 01-19 全绿，22/22 exit 0 | 未触发 |
| B3 | 派生层反向写入或改契约 | handler 仅 `findFirst/findMany`；`moodInsight.ts` 纯函数零 Prisma 引用；面板组件无写调用；schema 未变更 | 未触发 |
| B4 | 三件套缺一 | 空态 / 脏数据·降级 / 兼容测试均在套件中全绿 | 未触发 |
| B5 | 红绿证据缺失 | 上轮 red/green 日志留档完整（`red-*`/`green-*` 共 6 份） | 未触发 |

## 5. 本轮证据

`docs/v0.4/evidence/r2-{build,test-server,test-mobile,smoke,persist,start-health,dead-test-scan}.log`

## 6. 结论

复跑五门全绿、零漂移；P1 落地证据真实；DoD 7/7 有锚点且绿；死测试挂账保持清零。**维持签收：通过。**
