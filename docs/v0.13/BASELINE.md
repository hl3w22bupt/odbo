# v0.13 基线复核（2026-10-16）

## 结论

v0.12 续接基线成立，P0 维持「数据导入/导出用户触达最小版 + v0.12 遗留开放点定案」，不切换还账。

## 真实门禁

| 门禁 | 命令 | 退出码 | 结果 |
|---|---|---:|---|
| setup | `npm run setup` | 0 | server/mobile 依赖安装；Prisma generate/db push/seed 成功 |
| build | `npm run build` | 0 | server tsc、mobile typecheck、Web 339 modules |
| start | 临时 SQLite + `node dist/localServer.js`（端口 16888） | 0 | `/health` 200，`status=up`，`mode=standalone` |
| test | `npm test` | 0 | server 27 files / 169 passed；mobile 9 files / 51 passed |
| smoke | `npm run smoke` | 0 | 58 / 58，v0.12 编号零漂移 |

证据：`evidence/node1-baseline-setup.log|exit`、`node1-baseline-build.log|exit`、`node1-baseline-start.log`、`node1-baseline-health.json`、`node1-baseline-test.log|exit`、`node1-baseline-smoke.log|exit`。

## 漂移清单（对照 docs/smoke/v0.12.md）

- **阻塞**：0。
- **非阻塞**：2。
  1. Expo Web 构建重复输出 `NO_COLOR/FORCE_COLOR` 环境警告；不影响构建产物与测试。
  2. `scripts/smoke.sh` 结束时对 `npm run dev:standalone` 直接进程输出 `Killed: 9`；脚本自身 `kill_tree` 递归清理且 exit 0，属 shell job notice，不影响门禁。

## v0.12 导入三证据复核

| 证据 | 锚点 | 结论 |
|---|---|---|
| 解析器 | `periodCsvImport.test.ts` 1001 行返回 `ROW_LIMIT_EXCEEDED,line=1002,limit=1000`；fixtures 覆盖 8 个封闭错误码 | 落地 |
| 幂等 | `periodCsvImport.persistence.test.ts > imports a real export...stays idempotent...`；路由以 `ImportedPeriodMetric` 台账键判重，重复组零写 | 落地 |
| 1000 行上限 | parser 常量 `CSV_IMPORT_ROW_LIMIT=1000`；fixture 与 route 双层断言 413 | 落地 |

三证据任一缺失即触发备选切换；本基线三项均存在且纳入 `node1-baseline-test.log` 全量通过。

## 备选切换触发条件（量化写死）

满足以下任一项，P0 自动切「v0.12 还账」，零额外准备：

1. build / start / test / smoke 四要素复跑任一真实退出码非 0。
2. smoke 与 `docs/smoke/v0.12.md` 出现阻塞级漂移（任一 01-58 步挂、总数不是 58、既有编号断言漂移）。
3. 解析器、幂等、1000 行上限三证据任一缺失（对应具名测试/源码锚点不可定位或全量测试中失败）。

判定：本基线三项均未触发。
