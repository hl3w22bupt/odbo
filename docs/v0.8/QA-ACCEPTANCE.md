# 心伴 v0.8 质量验收（QA 机判）

机判 HEAD：`0ae0851`（含节点 4 发现并修复的 build 类型修复）；QA 门禁时间 `2026-10-10T23:36Z`（首轮）→ `23:40Z`（修复后复跑）。

## 1. DoD 打勾表逐项机判（对照 REQUIREMENTS.md §5）

| # | 验收项 | 机判方式与输出锚点 | 判定 | 状态 |
|---|---|---|---|---|
| T1 | 自然周聚合与覆盖率披露 | `node4-dod-anchor-tests.txt` verbatim_hits=1；`node3-implementation-test.log` server 81 全绿；smoke 43 步 `coverageDays>=1 且 moods 项数==coverageDays 且日内 count 合计==2` | 具名测试 + 值级断言双通过 | ☑ |
| T2 | 空周期合法空结构 | 同上 verbatim_hits=1；smoke 44 步逐字段断言 `coverageDays=0/totalDays=7/moods=[]/summary=null/available=true/degraded=false` | 通过 | ☑ |
| T3 | 失败降级 + 非静默日志 | verbatim_hits=1；测试内断言 `errorSpy` 调用 1 次且消息含 `period mood report degraded`；smoke 45 步复跑该具名测试 | 通过 | ☑ |
| T4 | 路由契约 additive | `chat::conversation-period-report` GET `/api/v1/conversations/:id/mood-period-report` 注册断言 verbatim_hits=1；smoke 43/44 实际 HTTP 200 | 通过 | ☑ |
| T5 | 修正数据入报告 | `reads persisted corrections into the period report` verbatim_hits=1；断言 `coverageDays=2、summary.counts.negative=2`（修正后 NEGATIVE×2） | 通过 | ☑ |
| T6 | 兼容回归 | smoke 01-42 既有步骤全绿 + 45/45（`node4-qa-smoke.log`）；persist 9/9；persistence:v02 18/18（含 kill -9 重启）；schema diff `f02d97e..HEAD` = 0 行；死测试四口径 = 0 | 通过 | ☑ |

断言三件套（T1 正常聚合 / T2 空库合法空结构 / T3 失败降级）齐备，合入有效。

## 2. 门禁复跑记录（节点 4，串行）

| 门 | 命令 | 首轮 | 修复后 | 留证 |
|---|---|---|---|---|
| build | `npm run build` | **exit 2**（`moodPeriodReport.ts(75,5) TS2322: period:null 与接口非空类型冲突`） | **exit 0**（类型修复 `period: {...} \| null`） | `node4-qa-build.log` / `node4-qa-build-fixed.log` |
| test | `npm test` | — | exit 0；server 17 files/81 tests + mobile 5 files/33 tests | `node4-qa-test.log` |
| smoke | `npm run smoke` | exit 0；45 / 45 | —（运行时行为不受类型影响，无需复跑） | `node4-qa-smoke.log` |
| persist | `npm run persist:check` | exit 0；9 / 9 | — | `node4-qa-persist.log` |
| persistence:v02 | `npm run persistence:v02` | exit 0；18 / 18 | — | `node4-qa-persist-v02.log` |
| schema 底线 | `git diff f02d97e..HEAD -- '*schema.prisma*'` | 0 行 | — | `node4-schema-diff.log` |
| 死测试四口径 | grep `.skip/.only/.todo/xit/xdescribe` | 0 条 | — | `node4-dead-test-scan.log` |

**QA 发现并闭环 1 项阻塞：build 类型错误。** 根因 = 降级信封 `period: null` 与 `MoodPeriodReport.period` 非空声明冲突；vitest 运行时不做全量类型检查故测试绿，build tsc 暴露。修复提交 `0ae0851`，修复后 build/test 双绿。此发现证明节点 4 独立机判有效。

## 3. 红绿证据链

- 红：`node3-red-server-period.log` + `node3-red-server-period-exit.txt`（`red_exit=1`，3 条新测试失败：路由未注册×2 + 派生器模块缺失；既有 18 条不受影响），先于实现提交 `e5d3e6b`。
- 绿：派生器 2/2 → 路由 23/23 → 全量 81+33（`node3-implementation-test.log`）→ smoke 45/45（`node3-implementation-smoke.log`）。
- 冒烟文档 `docs/smoke/v0.8.md` 与功能同在 `e5d3e6b` 提交（`git show --stat e5d3e6b` 可核）。

## 4. 范围执行与 P1 处置

- P0（T1–T6）全部交付并通过机判。
- **P1（客户端「本周」入口）按冻结规则砍除**：剩余窗口须完整保留给节点 4 兼容回归与节点 5 deploy 闭环；P1 涉及 6+ 客户端文件与 mock 对齐，存在冒烟 41/42 步文案断言回归风险。砍除不触及空态/降级/内容断言三底线（三条底线均在 P0 内已交付）。已入停车场，供下轮捞回。
- 本轮无冻结范围外夹带：`git diff e5d3e6b^..0ae0851 --stat` 全部落在周期报告垂直切片与 QA 证据。

## 5. 结论

**QA 通过（6/6 DoD ☑，兼容回归全绿，1 项 QA 期阻塞已修复闭环）。** 准入节点 5 deploy。
