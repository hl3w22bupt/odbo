# 心伴 v0.9 基线确认

基线锚点：`e625075`（v0.8 五节点闭环合入 main，当前交付分支 `myrd/v09-csv-deploy-v08-cmv4foce10012m9p8zj3mf3ls`）。

## 1. 承接结论

- 承接 v0.8 五节点闭环：build / start / test / smoke / persist / persistence:v02 本机复跑全绿。
- v0.8 装配六项机判与「装配阻塞销案不重开」结论只做事实承接；本版不重开轨迹渲染争议。
- v0.7 轨迹渲染冻结口径全程不触碰；本版所有新能力均为读侧增量，不新增 schema 写入，不改既有主链路写入。

## 2. 基线复跑与漂移处置

| 门 | 命令 | 结果 | 留证 |
|---|---|---|---|
| setup | `npm run setup` | exit 0 | `node1-baseline-setup.log` / `.exit` |
| build | `npm run build` | exit 0；server tsc + mobile typecheck + Web 336 modules | `node1-baseline-build.log` / `.exit` |
| start | `node dist/localServer.js` + `/health` | HTTP 200，`status=up` | `node1-baseline-start.log`、`node1-baseline-health.json` |
| test（首轮） | `npm test` | exit 1；server 82 中 1 条假失败 | `node1-baseline-test.log` 首轮被复跑覆盖前已在下条修复留证 |
| 基线修复 | `npm test -- chat.routes.test.ts` | exit 0；22/22 | `node1-baseline-repair-test.log` |
| test（修复） | `npm test` | exit 0；server 82 + mobile 33 | `node1-baseline-test.log` / `.exit` |
| smoke | `npm run smoke` | exit 0；45/45 | `node1-baseline-smoke.log` / `.exit` |
| persist | `npm run persist:check` | exit 0；9/9 | `node1-baseline-persist.log` / `.exit` |
| persistence:v02 | `npm run persistence:v02` | exit 0；18/18 | `node1-baseline-persist-v02.log` / `.exit` |
| 死测试 | 四口径 grep | 0 | `node1-dead-test-scan.log` |
| schema diff | `git diff e625075 -- '*schema.prisma*'` | 0 行 | `node1-schema-diff.log` |

**唯一漂移与修复**：`chat.routes.test.ts > reads persisted corrections into the period report` 的固定样本是 2026-10-07 所在周；进入 2026-10-12 后跨自然周，而路由契约按服务端当前 `now` 取周，造成时间相关假失败。处置只冻结该测试时钟（`vi.useFakeTimers` / `vi.useRealTimers`），不改 v0.8 服务口径。判定为「修复续用」，不重建基线。

## 3. 停车场承接

- 轨迹增强 P1：驻留；闸门仍为交互断言基建补齐，且不得触 v0.7 冻结口径。
- PDF 导出：驻留。
- v0.7 在册 minor 与历史候选：仅按四条标准复核，未满足不入主线。
