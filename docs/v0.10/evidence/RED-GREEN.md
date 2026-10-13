# v0.10 红绿证据索引（DoD T7）

红绿顺序：`red-*.txt` 均产生于对应实现落盘之前（2026-10-13 07:39–07:44），`green-*.txt` 产生于实现之后（07:43 起）。

| 文件 | 内容 |
|---|---|
| `red-server-lib.txt` | `moodPeriodInsight.test.ts` 在实现缺失时的失败（1 failed / no tests，模块不存在） |
| `red-server-route.txt` | `period.routes.test.ts` 在路由未注册时的失败（7 failed = 新增 7 条洞察用例；既有 7 条 v0.9 用例保持通过） |
| `red-mobile-util.txt` | `moodPeriodInsight.test.ts` 在工具缺失时的失败（模块不存在） |
| `green-server-lib.txt` | 服务端纯函数 11/11 通过 |
| `green-server-route.txt` | 路由层 v0.9 + v0.10 共 25 条用例通过（与纯函数套件合计） |
| `green-mobile-util.txt` | 移动端视图状态 10/10 通过 |

门禁终态见本轮 `npm run build` / `npm test` / `npm run smoke` / `npm run persist:check` 日志（BUILD_EXIT/TEST_EXIT/SMOKE_EXIT/PERSIST_EXIT 全 0 为通过标准）。
