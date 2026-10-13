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

---

# R2 · 交付后独立复核（本轮，不采信上轮报告）

复核时间：2026-10-14 07:32–07:35（UTC 2026-10-13 23:32–23:35）；复核对象 commit：`183b2020886dce4bd0082fd6e6ba228`（v0.11 交付后的 HEAD）。本轮全部证据固化于 `evidence/r2/`，不覆盖上轮 `node1-baseline-*` 原始证据。

## R2.1 三证据 AND 复跑（四要素：命令原文 / 输出锚点 / 时间戳 / commit SHA）

| # | 证据 | 命令原文 | 输出锚点 | 时间戳锚点 | commit | 结论 |
|---|---|---|---|---|---|---|
| 1 | build | `npm run build` | `gate-build.log`：server `tsc -p tsconfig.build.json` 无错 + mobile `tsc --noEmit` 无错 + Expo `Exported: dist-web`（Web Bundled 2438ms, 338 modules） | `meta.txt` 07:32:38 START / 07:32:43 END；`gate-build.exit=0` | `183b202` | ✓ |
| 2 | start | `npm run server:start` + `curl -fsS http://127.0.0.1:3888/health` | `health.json`：`data.status="up"`、`mode="standalone"`；`start.log` 注册含 `GET /api/v1/periods/:periodId/insight/comparison -> period::insight-comparison` | `meta.txt` 07:34:41 START / 07:34:45 stopped | `183b202` | ✓ |
| 3 | test | `npm test` | `gate-test.log`：server `24 files / 140 passed` + mobile `8 files / 49 passed`，0 failed | `meta.txt` 07:32:43 START / 07:32:45 END；`gate-test.exit=0` | `183b202` | ✓ |

补充硬门：`npm run smoke` → `gate-smoke.log` `✅ 心伴 v0.11 冒烟通过：54 项 / 54 项`（07:32:45–07:32:55，exit 0）；`npm run persist:check` → `gate-persist.log` `9 项，exit=0`（07:32:55–07:32:59）。**三证据 AND 成立，R2 零阻塞。**

## R2.2 v0.10 固化存档完整性复核

- `evidence/v010-frozen-baseline/`（commit `a92cd5e`，archived_at 2026-10-13T23:08:52Z）7 个文件 SHA-256 逐一重算，与 `MANIFEST.txt` 记录 **7/7 完全一致**，存档未被篡改，可继续作为 v0.11 回归对照物。

## R2.3 对照 `docs/smoke/v0.10.md` 漂移清单（R2）

| 级别 | 位置 | 漂移 | 处置 |
|---|---|---|---|
| 非阻塞（文档记述） | `docs/smoke/v0.10.md` 预期 `51/51`、v0.10 段步骤号 `49-51` | 当前脚本为 54 步（v0.9 CSV 段扩为 46-49，v0.10 洞察段位移至 `50-52`，v0.11 增量段 `53-54`） | v0.10 冻结文档按约定不改写；真实编号由 `docs/smoke/v0.11.md` 记录 |
| 非阻塞（行为无漂移） | v0.10 三条值级断言（空态结构 / 当前周期值级 / 降级契约+第 4 类判红） | 现步骤 50/51/52 断言逐字保留且本轮实测通过 | 无需处置 |

**阻塞级漂移：0。**

## R2.4 insight 前端触达复核（二值结论）

结论：**可触达**（R2 独立复核维持上轮判定，证据由「代码锚点」升级为「代码 + 构建产物」双锚点）。

代码锚点（逐条实测存在）：

- `apps/mobile/src/screens/ChatScreen.tsx:193`：`api.getPeriodInsight(currentPeriodId(new Date()))` 会话初始化即拉取。
- `apps/mobile/src/screens/ChatScreen.tsx:527`：`<MoodPeriodInsightPanel value={moodPeriodInsight} />` 实际挂载。
- `apps/mobile/src/components/MoodPeriodInsightPanel.tsx`：ready / 空 / degraded 三态文案。

构建产物锚点（`apps/mobile/dist-web/_expo/static/js/web/index-94432e93*.js`，本轮 build 生成）：

- 面板组件名 `MoodPeriodInsightPanel` 命中；
- 用户可见文案 `情绪洞察暂不可用`、`本周期还没有足够的情绪记录` 以 `\uXXXX` 转义形式命中（Metro 转义，非缺失）；
- 新端点路径 `insight/comparison` 命中，且 bundle 内含 `127.0.0.1:3888`（EXPO_PUBLIC_API_URL 已注入，**未落入 mock 模式**）。

P0 维持主线（跨周期洞察端点），不启用呈现备选。
