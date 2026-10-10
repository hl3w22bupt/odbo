# 心伴 v0.8 基线确认

机判 HEAD：`be8ef48183bf7de239a3b872e8e00d7727d7cea8`（六项准入后的基线提交）；门禁执行时间 `2026-10-10T23:23Z`。

## 1. 五门复跑对照 v0.7（一致/漂移清单）

| 门 | 命令 | 本轮结果 | v0.7 记录 | 对照 | 留证 |
|---|---|---|---|---|---|
| build | `npm run build` | exit 0；server tsc + mobile typecheck + Web 导出 336 modules | exit 0；336 modules | **一致** | `node1-baseline-build.log` |
| start | `node dist/localServer.js` + `GET /health` | HTTP 200；`status=up / mode=standalone` | 同（本轮以带输出 health.json 留证，修复上轮 M3 证据薄弱项） | **一致** | `node1-baseline-start.log`、`node1-baseline-health.json` |
| test | `npm test` | exit 0；server 16 files/76 tests；mobile 5 files/33 tests | 同数 | **一致** | `node1-baseline-test.log` |
| smoke | `npm run smoke` | exit 0；42 / 42（01-38 兼容 + 39-42 周报） | 同 | **一致** | `node1-baseline-smoke.log` |
| persist | `npm run persist:check` | exit 0；9 / 9 | 同 | **一致** | `node1-baseline-persist.log` |

**漂移清单：无阻塞级漂移，无停车场项。** 装配合并（`54c9046`）对交付面 `apps docs scripts package.json` 的 diff 为空；`git diff f02d97e..HEAD -- '*schema.prisma*'` = 0 行（schema 底线维持）。

## 2. 轨迹可视化三证据 AND 复核（跨轮基线事实维持）

| # | 判据 | 本轮锚点核验（HEAD=`be8ef48`） | 判定 |
|---|---|---|---|
| 1 | 可触达视图 | `apps/mobile/src/screens/ChatScreen.tsx:519` 挂载 `<MoodTimelinePanel value={moodTimeline} onCorrect={openCorrection} />`，组件实存于 `apps/mobile/src/components/MoodTimelinePanel.tsx` | 通过 |
| 2 | 持久层来源且反映 v0.5 标注后数据 | `apps/server/src/routes/chat.routes.test.ts:164 it('test_correction_latest_wins')`；smoke 23-28 步（修正 latest-wins/持久化/失败降级）42 项中全绿 | 通过 |
| 3 | 值级断言测试锚点 | `apps/mobile/src/utils/insights.test.ts:60 it('asserts timeline content instead of pixels')`；且 `npm test` 76+33 全绿，断言均为具体字段值级（非"元素存在/200/非空"） | 通过 |

**三证据 AND 成立 → 跨轮基线事实「轨迹可视化已实质落地」维持，签认后不再重开争议。**

## 3. 死测试四口径清账

`grep -R -nE '\.(skip|only|todo)\b|\<xit\(|\<xdescribe\(' apps/server/src apps/mobile/src --include='*.ts' --include='*.tsx'`

`DEAD_TEST_COUNT=0`（a/b/c/d 四类口径均为 0，无需修复复活或产品签认归档）。留证：`node1-dead-test-scan.log`。

## 4. 停车场（只出清单不占主线）

继承 v0.7 FINAL-REVIEW §6 的 7 条 minor（M1 DoD 名勘误已由本轮基线复核确认无实害；M2 窗口 to 端点、M4 死参数、M5 mock 漂移、M6 smoke 变量混用、M7 在册项）与 v0.7 BASELINE §4 五候选。本轮新增诉求一律入此处。
