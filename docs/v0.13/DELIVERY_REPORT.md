# 心伴 v0.13 交付报告

## 结论

P0「数据导入/导出用户触达最小版 + v0.12 未知周期开放点定案」已按冻结范围交付，deploy 后 smoke 67/67 通过。

## 用户能力

- 设置页（Home）与报告页（Chat 洞察区）各一个页内「周期数据」卡片；无新页面。
- 导出直连既有 v0.9 conversation CSV，Web 使用 Blob + anchor 下载；中文文件名走 RFC 5987。
- 导入消费既有结果明细，展示成功/跳过/失败、行号/原因、3 条封顶与 `+N 行`；失败原因实体转义。
- 客户端 1000 行计数只作优化，服务端响应是唯一权威。
- 未知周期导入/洞察不再暴露 4xx/5xx：跳过计数、降级标记、HTTP 200 合法结构。

## 门禁

| Gate | Result |
|---|---|
| build | exit 0 |
| test | server 175 + mobile 59，exit 0 |
| smoke | 67 / 67，exit 0 |
| persist:check | 9 / 9，exit 0 |
| persistence:v02 | 18 / 18，exit 0 |
| deploy:v02 | build/start/test 全 0 |
| deploy 后 smoke | 67 / 67，exit 0 |
| schema diff | 0 |
| dead tests | 0 |

证据索引见 `QA-ACCEPTANCE.md` 与 `docs/smoke/v0.13.md`。
