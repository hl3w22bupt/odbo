# 心伴 v0.9 QA 验收

结论：PASS（2026-10-13）。以下退出码均来自本仓实际命令日志，非转抄。

## 1. 门禁结果

| 门禁 | 结果 | 计数/关键值 | 证据 |
|---|---|---|---|
| Node1 setup/build/start/test/smoke/persist | PASS | setup 0；build 0；start health up；smoke 45/45；persist 9/9 | `evidence/node1-*`、`node4-start-health.txt` |
| Node3 server red → green | PASS | red rc=1（新模块缺失）→ green rc=0，3 tests | `node3-red-server-period-v09.*`、`node3-green-server-period-v09.*` |
| Node3 mobile red → green | PASS | red rc=1 → green rc=0，3 tests | `node3-red-mobile-period-v09.*`、`node3-green-mobile-period-v09.*` |
| Route 契约 | PASS | 7 tests | `node3-green-server-period-routes-v09.*` |
| 确定性/黄金 | PASS | 同输入两次输出 equal；CSV byte-stable；5 tests | `node4-determinism.*` |
| 全量测试 | PASS | server 20 files / 94 tests；mobile 6 files / 36 tests | `node4-final-test.log` |
| Build | PASS | server tsc + mobile typecheck/export rc=0 | `node4-final-build.log` |
| Smoke 回归 | PASS | v0.4–v0.9 兼容段 + 增量段 48/48 | `node4-final-smoke.log` |
| Persist | PASS | 9/9，kill/restart/readback | `node4-final-persist.log` |
| Dead tests | PASS | skip/only/xit/xdescribe/todo = 0 | `node4-dead-test-scan.log` |
| Schema diff | PASS | `git diff -- prisma` rc=0 | `node4-schema-diff.*` |
| 既有端点快照 | PASS | old 56 definitions，removed 0，added only 2 period routes | `node4-existing-schema-snapshot.txt` |
| Deploy | PASS | build=0/start=0/test=0 | `node5-deploy.log` |
| Deploy 后闭环 | PASS | smoke 48/48；persist 9/9 | `node5-post-deploy-*` |

## 2. DoD 值级核验

| # | 结论 | 证据/测试 |
|---|---|---|
| T1 | PASS | `compares current and previous periods...` 精确断言 sample/coverage/average/completeness 与 trend 3 值 |
| T2 | PASS | 空会话 route + all-empty comparison：样本/覆盖为 0，EMPTY，不编造数据 |
| T3 | PASS | sqlite locked → 200 degraded 全字段 + `logger.error` 一次 |
| T4 | PASS | 表头 exact 14 列；数据 2 lines；空周期 1 line；无 row_count |
| T5 | PASS | unauthenticated rejects 401；查询绑定 `userId` 与本人 conversationIds |
| T6 | PASS | 见上表全量门禁 |
| T7 | PASS | server/mobile 各有红/绿 exit 文件 |

## 3. 三态覆盖

- 空态：无会话、all-empty、空周期 CSV 仅表头。
- 降级态：读库 reject → comparison degraded；CSV 输出安全空表并日志。
- 正常态：双会话聚合、previous week、trend delta、CSV 两行。
- 脏数据隐藏：复用 v0.8 有效点判据与 latest-wins；route 值级测试只接受合法 ACTIVE 归因样本。

## 4. 范围审计

- Prisma 无 diff。
- 既有 router definition 零移除/零改写；仅 additive `period::comparison`、`period::csv`。
- v0.7 轨迹渲染与 ChatScreen/App 零 tracked diff。
- 平台注入目录的既有脏状态不属于本增量，未纳入提交。
