# v0.11 红绿证据索引

| 能力 | 红证据 | 绿证据 | 判定 |
|---|---|---|---|
| server 纯函数 + 路由 | `red-server-comparison.log` / `.exit=1`（模块与 route 缺失） | `green-server-comparison-lib.log`、`green-server-comparison-route.log` 均 exit 0 | ✓ |
| mobile 类型消费/视图状态 | `red-mobile-comparison.log` / `.exit=1`（模块缺失） | `green-mobile-comparison.log` exit 0 | ✓ |

红先于绿依据：

- red log 生成时间：2026-10-13T23:17Z（`red-comparison.meta`）。
- green log 生成时间：2026-10-13T23:20Z（`green-comparison.meta`）。
