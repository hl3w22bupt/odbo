# v0.10 红绿证据索引（DoD T7）

红绿顺序（按实物可核证据）：`red-server-route.txt` 内含 `Start at 07:44:47`（路由未注册时 7 failed）；`red-mobile-util.txt` mtime 07:48（模块缺失，1 failed / no tests）；`green-*.txt` 三个文件于 07:54 统一落盘（文件内仅 Duration 无时间戳，先后以落盘批次为准，均早于实现提交 `45560cb` 08:00:54）。
> 修订说明：本节原记述「red 07:39–07:44 / green 07:43 起」与实物不符（red-route 时间戳晚于 07:43、red-mobile mtime 07:48 超窗、red-server-lib 零失败输出），已由独立验收复核按实物改正。

| 文件 | 内容 |
|---|---|
| `red-server-lib.txt` | ⚠️ 实物仅含 `RED_EXIT=0`（11 字节，无失败输出，退出码与「红」矛盾）——**真实红日志见补证文件 `red-server-lib-verified.txt`**（模块缺失 → `Cannot find module` 1 failed / no tests，REAL_EXIT=1） |
| `red-server-route.txt` | `period.routes.test.ts` 在路由未注册时的失败（`7 failed | 7 passed (14)` = 新增 7 条洞察用例失败；既有 7 条 v0.9 用例保持通过） |
| `red-mobile-util.txt` | `moodPeriodInsight.test.ts` 在工具缺失时的失败（`Test Files 1 failed (1)` / `Tests no tests`，模块不存在） |
| `green-server-lib.txt` | 服务端纯函数 11/11 通过 |
| `green-server-route.txt` | 路由层 14/14 通过（25 = 14 路由 + 11 纯函数，为两文件拼接口径） |
| `green-mobile-util.txt` | 移动端视图状态 10/10 通过 |

## 验收复核补证（2026-10-13，独立验收节点）

- `red-server-lib-verified.txt`：临时移除 `src/lib/moodPeriodInsight.ts` 复现真实红（`Cannot find module './moodPeriodInsight.js'`，REAL_EXIT=1），归档补齐 server lib 层先红证据。
- 变异测试（测试有效性反证）：平票优先级反转 → server lib `1 failed | 10 passed`；删除降级 `logger.error` → 路由 `1 failed | 13 passed`；双层防御穿透（移除类型闭合守卫 + 第 4 类放行）→ mobile `1 failed | 9 passed`（「第 4 类判红」用例确实变红）。三处变异均使测试变红后恢复，工作区零残留。

门禁终态见本轮 `npm run build` / `npm test` / `npm run smoke` / `npm run persist:check` 日志（BUILD_EXIT/TEST_EXIT/SMOKE_EXIT/PERSIST_EXIT 全 0 为通过标准）。
