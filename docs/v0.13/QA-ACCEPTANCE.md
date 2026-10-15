# v0.13 质量验收

结论：**PASS / READY FOR DEPLOY**。五项硬验收全部通过，无死测试；schema、路由表与既有导入七字段语义零漂移。

## 红绿链

- Red server：`evidence/node3-red-server.log|exit`（12 failed / 25 passed）。
- Red mobile：`evidence/node3-red-mobile.log|exit`（2 files executed，4 failed；新模块缺失与明细契约失败）。
- Green aggregate/insight suite：`evidence/node4-aggregate-insight-suite.log|exit`（6 files / 57 passed）。
- Green full test：`evidence/node4-final-test.log|exit`（server 27 files / 175；mobile 10 files / 59）。
- Green smoke：`evidence/node4-final-smoke.log|exit`（67 / 67）。

## 硬验收

| # | 验收 | 机判锚点 | 结果 |
|---|---|---|---|
| 1 | 导入↔导出回环 | smoke 59-61：真实 v0.9 export → clean conversation import `imported=received`；重导 `skipped=received/imported=0`；另有 `periodCsvImport.persistence.test.ts` export→import→export 字节一致 | PASS |
| 2 | 未知周期容错 | smoke 63-66 + route tests：混合 `skippedUnknownPeriodCount=1`；纯未知 200、零写；单/跨周期洞察降级标记存在 | PASS |
| 3 | 前端值级断言 | `dataExchange.test.ts` 断言 GET endpoint、Blob、anchor download、RFC5987；`csvImport.test.ts` 断言行号/原因、3 条封顶、`+N 行` | PASS |
| 4 | 防注入 | `<script>alert(1)</script>` → `&lt;script&gt;...`；UI 明细仅经 RN `Text`，无 innerHTML/dangerouslySetInnerHTML | PASS |
| 5 | 预检/服务端不一致双向 | `serverAuthoritativeImportResult` two-direction tests：client invalid/server valid 返回 server；client valid/server invalid 返回 server | PASS |
| 6 | 只加不改契约回归 | `keeps every v0.12 result field unchanged...` 精确断言七个既有字段；未知场景仅追加 `meta/warnings` | PASS |

## 门禁结果

| Gate | Count | Exit | Evidence |
|---|---:|---:|---|
| final build | server tsc + mobile typecheck + Web 341 modules | 0 | `node4-final-build.log|exit` |
| final test | server 175 + mobile 59 | 0 | `node4-final-test.log|exit` |
| final smoke | 67 / 67 | 0 | `node4-final-smoke.log|exit` |
| persist:check | 9 / 9（kill -9 重启） | 0 | `node4-final-persist.log|exit` |
| persistence:v02 | 18 / 18（kill -9 多轮） | 0 | `node4-persist-v02.log|exit` |
| aggregate/insight suite | 57 / 57 | 0 | `node4-aggregate-insight-suite.log|exit` |
| mobile src lint | 0 problems | 0 | `node4-mobile-src-lint.log|exit` |
| dead test scan | 0 | 0 | `node4-dead-test-scan.log|count` |

## 非阻塞

1. `npm run lint --workspaces` 会把 `apps/mobile/dist-web` 构建产物纳入扫描并报历史产物错误；本轮补跑 `eslint src` 为 0。产物目录属构建输出，不列入源码门禁。
2. shell 冒烟在 kill 后台 npm/tsx 进程树时可能打印 `Killed: 9` job notice；脚本递归清理且 exit 0。

## Deploy 节点

| Gate | Count/Result | Exit | Evidence |
|---|---:|---:|---|
| deploy build/start/test | build=0，start `/health up`，server 175 + mobile 59 | 0 | `node5-deploy.log|exit` |
| deploy 后 smoke | 67 / 67 | 0 | `node5-post-deploy-smoke.log|exit` |

结论：deploy 冒烟闭环完成。
