# v0.13 质量验收

结论：**PASS / READY FOR DEPLOY**。五项硬验收全部通过，无死测试；schema、路由表与既有导入七字段语义零漂移。

## 红绿链

- Red server：`evidence/node3-red-server.log|exit`（12 failed / 25 passed）。
- Red mobile：`evidence/node3-red-mobile.log|exit`（2 files executed，4 failed；新模块缺失与明细契约失败）。
- Green aggregate/insight suite：`evidence/node4-aggregate-insight-suite.log|exit`（7 files / 60 passed，覆盖 comparison/insight 与导入持久化）。
- Green full test：`evidence/node4-final-test.log|exit`（server 27 files / 175；mobile 10 files / 59）。
- Green smoke：`evidence/node4-final-smoke.log|exit`（67 / 67）。

## 硬验收

| # | 验收 | 机判锚点 | 结果 |
|---|---|---|---|
| 1 | 导入↔导出回环 | smoke 59-61：真实 v0.9 export → clean conversation import `imported=received`；重导 `skipped=received/imported=0`；另有 `periodCsvImport.persistence.test.ts` export→import→export 字节一致 | PASS |
| 2 | 未知周期容错 | smoke 63-66 + route tests：混合 `skippedUnknownPeriodCount=1`；纯未知 200、零写；comparison/单周期/跨周期洞察降级标记存在 | PASS |
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
| aggregate/insight suite | 60 / 60 | 0 | `node4-aggregate-insight-suite.log|exit` |
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

## 独立复核轮（2026-10-16 复检接力）

复核轮不采信上轮声明，独立重跑四门禁并逐项核对 DoD 锚点（锚点 → 测试名 → 实际运行三点一线）：

| Gate | Count/Result | Exit | Evidence |
|---|---:|---:|---|
| build | server tsc + mobile typecheck + Web 341 modules | 0 | `reverify-build.log\|exit` |
| test | server 27 files / 175 + mobile 10 files / 59 | 0 | `reverify-test.log\|exit` |
| smoke | 67 / 67（含 v0.13 第 59-67 步） | 0 | `reverify-smoke.log\|exit` |
| persist:check | 9 / 9 | 0 | `reverify-persist.log\|exit` |
| 聚合/洞察既有测试全集 | 7 files / 72 passed（零回归） | 0 | `reverify-aggregate-insight.log` |

### DoD 锚点三点核对

| 锚点 | 测试/步骤名 | 实测 |
|---|---|---|
| ① 回环幂等 | smoke 59-61 + `periodCsvImport.persistence.test.ts > imports a real export into a clean cycle, stays idempotent, and round-trips value-for-value` | PASS |
| ② 未知周期容错 | smoke 63-66 + `period.routes.test.ts` / `periodInsightComparison.routes.test.ts` additive 提示位断言 | PASS |
| ③ 前端值级断言 | `dataExchange.test.ts` 端点/方法 toEqual、Blob anchor click、RFC 5987；`csvImport.test.ts` 行号/原因封顶 | PASS |
| ④ 防注入 | `escapeDisplayText('<script>alert(1)</script>')` → `&lt;script&gt;...` | PASS |
| ⑤ 服务端权威双向 | `serverAuthoritativeImportResult` client 过限/server 过限双方向均返回 server | PASS |
| ⑥ 只加不改契约回归 | `keeps every v0.12 result field unchanged...` 七字段 `Object.keys` 精确断言 | PASS |

### 死测试与证据漂移

- 死测试扫描（`.skip/.only/.todo/xit/fit`）：0（全仓 server+mobile src）。
- 文档引用 evidence 文件漂移检查：0 缺失（51 个引用全部存在）。

### v0.12 停车场随轮清账留痕

| v0.12 停车场项 | 状态 | 依据 |
|---|---|---|
| 洞察证据锚点可解释性 | **已清账**（v0.12 PR #13 合并时随导入消费链路落地） | `moodPeriodInsight.ts` `InsightEvidence{type,value,evidence,message}` 四元组 + golden 值级断言（`moodPeriodInsight.test.ts` 80/89/98/225 行断言 evidence 结构与 sampleSize） |
| journal 随笔最小版 | 继续停车 | 全仓无 journal 代码路径；无对应产品契约冻结 |
| 技术债专项轮 | 继续停车 | 流程性事项，需独立轮次排期 |

结论：复核轮维持 PASS / READY，未发现阻塞级漂移；v0.12 停车场中可随轮清账项已清账并留痕。
