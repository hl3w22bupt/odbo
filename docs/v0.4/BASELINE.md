# 心伴 v0.4 基线确认（2026-10-04）

## 1. 基线门禁复跑

| 门禁 | 命令 | 结果 | 判定 |
|---|---|---|---|
| build | `npm run build` | exit `0`，server tsc + mobile typecheck + Expo Web 导出成功 | 一致 |
| start | `cd apps/server && npm run start:standalone`（产物启动门） | exit `0`，`/health=up, mode=standalone` | 一致 |
| test | `npm test` | exit `0`，server 8 files / 38 tests + mobile 3 files / 26 tests | 一致（高于 v0.3 记录的 32+26；当前基线源树已含更多既有用例，非回归） |
| smoke | `npm run smoke` | exit `0`，01-19 全绿，`19 项 / 19 项` | 一致 |
| persist | `npm run persist:check` | exit `0`，P01-P09 全绿 | 一致 |

证据：`docs/v0.4/evidence/baseline-{build,start,test,smoke,persist}.log`。

结论：无阻塞级漂移，可直接进入增量。

## 2. v0.3 P1 落地状态

结论：已实际落地，非仅文档。

| 证据 | 内容 |
|---|---|
| `apps/server/prisma/schema.prisma > model MoodSnapshot` | 结构化 `mood/score/keywords` 持久化，`memoryId` 关联来源 |
| `apps/server/src/lib/conversationInsights.ts` | `readableMoodTimeline` / `serializeMood` 输出结构化快照并兼容脏值归一 |
| `apps/server/src/routes/chat.ts` | `GET /api/v1/conversations/:id/mood-timeline` 鉴权读取与显式降级 |
| `apps/mobile/src/components/MoodTimelinePanel.tsx` | emoji/标签读视图，不断言像素 |
| server tests | `conversationInsights.test.ts > serializes mood snapshots with structured keywords`；`chat.routes.test.ts > serves the explicit empty mood timeline before the first snapshot`；`> degrades the mood timeline read to an empty list when storage fails` |
| mobile test | `insights.test.ts > asserts timeline content instead of pixels`；`> uses empty and degraded states without exposing partial rows` |
| smoke / persist | smoke 16-17、19；persist P02/P04/P08 全绿 |

## 3. 死测试核销台账

扫描口径：`.skip`、`.only`、`.todo`、`xit(`、`xdescribe(`，范围 `apps/*/src` 与 `scripts`。

| 挂账项 | 处置 | 锚点 | 状态 |
|---|---|---|---|
| 无 | — | `docs/v0.4/evidence/dead-test-scan.log` | 清零 [x] |

Vitest 基线输出无 skipped/todo。

## 4. 停车场捞回候选（三判据）

判据：A=用户可感知价值；B=当前窗口可完成且可机判；C=只动读侧派生层、低风险。

| 候选 | A | B | C | 结论 |
|---|---|---|---|---|
| 情绪洞察摘要 | 高：把离散轨迹变成可解释趋势 | 高：基于既有 memory + mood 读契约 | 高：无 schema / 写路径改动 | 捞回为 v0.4 P0 |
| v0.3 review M1-M4 加固 | 中 | 中 | 部分涉及写路径与安全提示词 | 留停车场，不混入本轮 |
| v0.3 review S1-S8 清偿 | 低-中 | 中 | 多为可维护性 / 冒烟补强 | 留停车场 |

## 5. 冻结

窗口不足时只保 P0 情绪洞察摘要；P1 及新增诉求入 `docs/v0.4/DEVELOPMENT.md` 停车场。
