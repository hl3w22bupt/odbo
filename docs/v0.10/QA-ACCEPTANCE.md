# 心伴 v0.10 P0 · QA 验收记录（情绪洞察最小版）

状态：PASS（四门禁全绿后归档；契约见同目录 REQUIREMENTS.md）。

## 1. DoD 机判结果

| # | 验收 | 锚点（测试名 / 冒烟步） | 实测 |
|---|---|---|---|
| T1 | 洞察结论值 = 规则重算值（值级一致） | `moodPeriodInsight.test.ts > 结论值 = 规则重算值（值级一致，非元素存在）`；smoke 50 jq 值级断言 | ✓ 通过 |
| T2 | 空态/降级/正常三层独立用例 | 正常层 `golden：三类洞察全结构值级断言`；空态层 `空库/空周期返回 200 合法空结构`；降级层 `聚合输入降级时输出完整 degraded 结构` + 路由 `degrades to an empty safe structure and logs loudly on aggregation failure` | ✓ 通过 |
| T3 | 同输入多次调用输出稳定 + 黄金用例 | `同输入多次调用输出稳定`（server）+ `同一时刻多次调用输出稳定`（mobile）+ golden 全结构 `toEqual` | ✓ 通过 |
| T4 | 类型枚举闭合（第 4 类判红） | `类型枚举闭合：集合长度 3，所有产出 type 均在集合内`（server）+ `第 4 类判红：未知洞察类型使整个载荷不可信 → empty`（mobile）+ smoke 51 | ✓ 通过 |
| T5 | UTC+8 周界（周日 23:59 vs 周一 00:00） | `UTC+8 周界：周日 23:59（CST）属上周，周一 00:00（CST）属本周`（server）+ `currentPeriodId` 双用例（mobile） | ✓ 通过 |
| T6 | 兼容回归 | build exit 0；全量 test exit 0（server 21 文件 112 条 + mobile 7 文件 46 条）；smoke 51/51 exit 0；persist:check 9 项 exit 0 | ✓ 通过 |
| T7 | 红绿证据 | `evidence/`：red-server-lib / red-server-route / red-mobile-util 先于对应 green 日志；索引见 `evidence/RED-GREEN.md` | ✓ 归档 |
| T8 | 范围外 diff 拒收 | `git status` 全量清单 = 契约 additive 范围（2 服务端文件 + 2 服务端测试 + 4 移动端文件 + 冒烟/文档）；`MoodTimelinePanel.tsx`、`conversationInsights.ts`、`utils/insights.ts` 零 diff | ✓ 通过 |

## 2. 死测试清账（四类口径）

全仓测试文件扫描 `skip / only / todo / xit / xdescribe / fit`：**0 处**，无需清账。

## 3. 时钟纪律

- `apps/server/src/lib/moodPeriodInsight.ts`：0 处 `Date.now` / `new Date()`，全部经入参派生。
- `apps/mobile/src/utils/moodPeriodInsight.ts`：`currentPeriodId(now)` 注入时刻；文件内 `new Date(x)` 均为注入值的确定性换算。
- Panel 组件与路由层不持有时间逻辑。

## 4. 门禁日志

| 门禁 | 命令 | 退出码 | 备注 |
|---|---|---|---|
| build | `npm run build` | 0 | server tsc + mobile typecheck + Expo Web 导出 |
| test | `npm test` | 0 | server 112 + mobile 46 = 158 条 |
| smoke | `npm run smoke` | 0 | 51/51（01-48 兼容基线 + 49-51 洞察增量） |
| persist | `npm run persist:check` | 0 | 9 项（写→kill→重启→读回一致） |
