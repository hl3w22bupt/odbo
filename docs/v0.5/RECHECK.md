# 心伴 v0.5 独立复验记录（RECHECK）

本轮在交付提交 `b6b0a1e` 之后，对 v0.5 写侧闭环与 JSON 导出做全量独立复验：环境重建 → 基线门禁复跑 → 代码级边界/契约抽查。所有结果为本轮实测输出，非转抄历史证据。

## 1. 环境预检与重建

- 预检发现 `apps/server/node_modules/.prisma/client` 为空（工作区重建后未生成）。
- 处置：`cd apps/server && npx prisma generate`（Prisma 7.9.1，生成至 `src/generated/prisma`）→ `npm run db:setup`（additive `db push` + 种子）→ 成功。

## 2. 门禁复跑（本轮实测）

| 门 | 命令 | 结果 | 本轮实测尾部锚点 |
|---|---|---|---|
| 构建 | `npm run build` | exit 0 | `Exported: dist-web` |
| 全量测试 | `npm test` | exit 0 | server `13 files / 59 tests` + mobile `4 files / 31 tests` 全 passed |
| 冒烟 | `npm run smoke` | exit 0 | `心伴 v0.5 冒烟通过：31 项 / 31 项`（01-22 v0.4 基线锚点 + 23-31 v0.5 增量链） |
| v0.2 持久化 | `npm run persistence:v02` | exit 0 | `心伴 v0.2 持久化增量通过：18 项 / 18 项` |
| v0.3 持久化 | `npm run persist:check` | exit 0 | `心伴 v0.3 持久性硬门槛通过：9 项，exit=0`（P01-P09） |
| 死测试 | grep `\.(skip\|only\|todo)\(|xit\|xdescribe` | 0 条 | `DEAD_TEST_COUNT= 0`（本轮复现） |

## 3. 具名测试锚点复核（本轮 verbose 运行确认全部在位且通过）

| 锚点 | 所在文件 | 状态 |
|---|---|---|
| `test_edit_persists_across_restart` | `src/routes/moodCorrection.persistence.test.ts` | ✓ |
| `test_edit_nonexistent_returns_defined_error` | `src/routes/chat.routes.test.ts` | ✓ |
| `test_correction_latest_wins` | `src/routes/chat.routes.test.ts` + `src/lib/moodCorrections.test.ts`（双份锁契约） | ✓ |
| `test_correction_write_failure_preserves_old_value` | 同上双份 | ✓ |
| `test_export_empty_db_returns_valid_empty` | `src/routes/export.routes.test.ts` + `src/lib/exportData.test.ts` | ✓ |
| `test_v04_data_readable_by_v05` | `src/lib/exportData.test.ts` | ✓ |

红→绿证据链沿用交付档案：`evidence/red-server.log`（实现前 4 failed / 新文件 0 collected）、`evidence/red-mobile.log`、`evidence/green-server.log`、`evidence/green-mobile.log`。

## 4. 代码级抽查（不依赖文档自述）

- **单向边界**：`moodInsight.ts` / `conversationInsights.ts` / `moodCorrections.ts` / `exportData.ts` 零 `db`/`prisma`/`routes` import（grep 为空）——`派生层 ← 存储 ← 核心交互` 成立。
- **schema additive**：`git show c63cd3b:apps/server/prisma/schema.prisma` 与现版 diff 为 `+20 / -0`，仅新增 `MoodCorrection` 与关系字段，v0.2 两契约（emotion/会话持久化）未动。
- **契约实现抽查**（`routes/chat.ts` correctMoodPoint）：未登录 401 → 缺参 400 → 会话/点不存在或跨用户一律 `AppError.notFound`（404 `NOT_FOUND`，禁 500）→ `clientMutationId` 重放返回首次结果、跨目标 409 → 写失败 catch 返回 200 + 原 point 降级态 → 仅 `create` 追加，不 UPDATE `MoodSnapshot`。
- **UI 闭环**（`ChatScreen.tsx` 313-352）：列表项「修正」（`MoodTimelinePanel` accessibilityLabel `修正情绪记录`）→ 弹窗保存 → `setMoodTimeline` 局部替换该 point（降级时保原值）→ 洞察联动刷新 → 失败 toast 回显；无整页刷新依赖。
- **冒烟断言抽查**（`scripts/smoke.sh` 23-31）：字段级 jq/grep 断言（`"persisted":true`、`"code":"NOT_FOUND"`、`content-type: application/json; charset=utf-8`、空库 `conversations==[]`），无绝对日期/全文 diff。

## 5. 范围冻结符合性

- 三个 `package.json` 与 v0.4 相比零依赖变化（diff 为空）。
- 停车场项（定时器/通知通道/存储引擎/破坏性迁移/CSV）均未引入；deploy 保留 `scripts/deploy-v02.sh` 为工作流入口并在 build 后 additive `db push`。
- 死测试台账清零（0 条，无需四类根因归类），四类标签规则已在 `DEVELOPMENT.md` §1 冻结备用。

## 6. 结论

**复验通过，维持「验收通过（准备 deploy）」结论。** deploy 由工作流 deploy 节点执行，本轮不做本地部署冒充。
