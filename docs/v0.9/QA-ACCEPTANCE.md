# 心伴 v0.9 质量验收（QA 机判）

机判实现提交：`7bcf1b3`；QA 期新增第 13 条 DoD 补强测试后复跑。门禁时间 `2026-10-12T07:25-07:26 Asia/Shanghai`。

## 1. DoD 逐项机判

| # | 验收项 | 机判证据与结果 | 状态 |
|---|---|---|---|
| 1 | 缺口四点前置于实现 | `git log --reverse`：`89fcf19` 冻结裁决 → `6386924` 红测 → `7bcf1b3` 实现 | ☑ |
| 2 | 双周期对比值级 + 趋势复算 | `aggregates two known cycles...` 断言 2026-09-28/10-05 聚合值、count=0/STABLE、negative=-1/DOWN、averageScore rate=-2 | ☑ |
| 3 | 空态两档 | 单周期空：`periods[0].status=EMPTY`、另一周期 `COMPLETE`、整体 `PARTIAL`；整体空：空源逐值 null、`completeness.status=EMPTY`、CSV 204 信号 | ☑ |
| 4 | 边界 | N=4 → 400 `PERIOD_COUNT_REJECTED`；N=1/2/3 数组长度精确、无源补空；跨年周界 `2025-12-29`/`2026-01-05` | ☑ |
| 5 | 导出三验 + 转义 | N=2 产物 10 行可解析、表头/BOM/4 列核验；`encodeCsvCell('x,"y"\nz')` 精确转义 | ☑ |
| 6 | 导出元信息 | `X-Report-Row-Count=10` 与解析数据行一致（不含表头）；generatedAt 仅断存在 + ISO regex | ☑ |
| 7 | 降级 | 注入 source 连续失败两次：对比 200 degraded；CSV JSON `attempts=2`；单周期失败 CSV 可用 5 行 + partial/degraded 双头 | ☑ |
| 8 | 死测试余量 | 四口径 grep=0（`node4-dead-test-scan.log`） | ☑ |
| 9 | deploy 冒烟 | 节点 5 执行 46/46 后回填 | ☐→节点5 |

补强：QA 发现 DoD3 初始证据未充分区分「一个周期空」和「整体空」，追加 `distinguishes one empty period...`，13/13 绿（`node4-dod-anchor-tests.log`）。

## 2. 门禁复跑

| 门 | 结果 | 留证 |
|---|---|---|
| build | exit 0；server tsc + mobile typecheck + Web 336 modules | `node4-qa-build.log` |
| test | exit 0；server 18 files/95 tests + mobile 5 files/33 tests | `node4-qa-test.log` |
| smoke | exit 0；46/46 | `node4-qa-smoke.log` |
| persist | exit 0；9/9 | `node4-qa-persist.log` |
| persistence:v02 | exit 0；18/18（kill -9） | `node4-qa-persist-v02.log` |
| start/health | HTTP 200 | `node4-qa-start.log`、`node4-qa-health.json` |
| schema diff | `e625075..HEAD` = 0 行 | `node4-schema-diff.log` |
| 死测试 | 0 条 | `node4-dead-test-scan.log` |

## 3. 红绿证据链

- 红：`node3-red-comparison.log`（exit 1，目标模块缺失，红测先于实现提交）。
- 绿：`node3-green-comparison-final.log`（12/12）→ QA 补强 `node4-dod-anchor-tests.log`（13/13）→ 全量 95+33。
- 实现门禁：build/test/smoke exit 0；QA 独立复跑 build/test/smoke/persist/persistence exit 0。

## 4. 边界与停车场

- `node4-changed-paths.txt` 无 schema 变更、无客户端功能面改动；`chat.routes.test.ts` 仅基线时钟修复。
- 无新增 Prisma 写入；新路由只读。
- 轨迹增强 P1、PDF、历史捞回候选继续驻留。

## 5. 结论

QA 通过（DoD 1-8 ☑，第 9 条待节点 5 deploy 冒烟回填后闭环）。
