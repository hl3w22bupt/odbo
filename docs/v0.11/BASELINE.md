# 心伴 v0.11 · 节点 1 基线硬门槛复核记录（v0.10）

复核时间：2026-10-14 07:06–07:09（UTC 2026-10-13 23:06–23:09）；基线 commit：`a92cd5e9f3dbe745714fe6db6e2d233e85415511`。

## 1. 三证据 AND 复核

| # | 证据 | 命令原文 | 输出锚点 | 时间戳锚点 | 结论 |
|---|---|---|---|---|---|
| 1 | build | `npm run build` | `BUILD_EXIT=0`；Expo `Exported: dist-web` | `evidence/node1-baseline-build.meta` started/finished | ✓ |
| 2 | start | `npm run server:start` + `curl -fsS http://127.0.0.1:3888/health` | `/health` 返回 `data.status="up"`、`mode="standalone"` | `evidence/node1-baseline-start.meta` started/finished；health `time="2026-10-13T23:07:45.056Z"` | ✓ |
| 3 | test | `npm test` | server `126 passed (126)` + mobile `46 passed (46)` = 172 条 | `evidence/node1-baseline-test.meta` started/finished | ✓ |

补充硬门：`npm run smoke` 实测 `52 项 / 52 项`、exit 0（`evidence/node1-baseline-smoke.*`）。三证据 AND 成立。

## 2. v0.10 固化存档

- 存档路径：`docs/v0.11/evidence/v010-frozen-baseline/`。
- 存档清单与 SHA-256：`docs/v0.11/evidence/v010-frozen-baseline/MANIFEST.txt`。
- 存档内容：v0.10 gate build/test/smoke/persist、deploy、deploy 后 smoke 与 verification report。
- 本轮真实复跑证据另行保留于 `docs/v0.11/evidence/node1-baseline-*`。

## 3. 对照 `docs/smoke/v0.10.md` 漂移清单

| 级别 | 位置 | 漂移 | 处置 |
|---|---|---|---|
| 非阻塞（文档记述） | `docs/smoke/v0.10.md` 预期 `51 / 51`，步骤号 `49-51` | 当前冻结脚本已分段追加为 `52 项 / 52 项`；实测步骤为 49 空周期 CSV、50 空洞察、51 当前洞察值级、52 降级契约 | 不改 v0.10 冻结文档；v0.11 smoke 增量段将从 53 起追加，并在 v0.11 文档记录真实编号 |

阻塞级漂移：无。

## 4. insight 前端触达盘点

结论：**可触达**。

代码锚点：

- `apps/mobile/src/screens/ChatScreen.tsx:187-193`：会话初始化 Promise.all 内调用 `api.getPeriodInsight(currentPeriodId(new Date()))`。
- `apps/mobile/src/screens/ChatScreen.tsx:195-200`：读取成功后写入 `moodPeriodInsight` 状态。
- `apps/mobile/src/screens/ChatScreen.tsx:523-527`：报告列挂载 `<MoodPeriodInsightPanel value={moodPeriodInsight} />`。
- `apps/mobile/src/components/MoodPeriodInsightPanel.tsx:21-48`：Panel 渲染 ready / 空 / degraded 三态用户可见文案。

因此 P0 不切换到「洞察呈现最小版」备选，按主线执行跨周期洞察端点。
