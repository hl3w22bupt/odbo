# v0.12 质量验收（QA 机判）

机判范围以冻结 `REQUIREMENTS.md` 为准。门禁时间：2026-10-15 07:08-07:40 Asia/Shanghai。

## 1. DoD 逐项

| # | 验收项 | 机判证据 | 结果 |
|---|---|---|---|
| 1 | 基线 v0.11 实质落地 | `node1-baseline-build/test/start/smoke` 全 0；smoke 54/54 | ☑ |
| 2 | 冻结前真实导出干跑 | `dry-run-v09-export.csv`、`dry-run-parser-facts.txt`：BOM/CRLF/表头/周一/数值事实 | ☑ |
| 3 | 表头单一事实来源 | `periodCsvImport.ts` 导入 `CSV_HEADER`，无复制数组；测试 11/11 | ☑ |
| 4 | 8 错误码 fixture + 行号 | `fixtures/period-csv-import/*`；`periodCsvImportFixtures.test.ts` 8/8 | ☑ |
| 5 | 计数不变量 | 空态/混合/全无效 route 测试均 `imported+skipped+failed=received`；6/6 | ☑ |
| 6 | 幂等零重复 | 同文件第二轮 `skipped=5`，ledger 仍 5、memory/snapshot 不变 | ☑ |
| 7 | 原子性与并发唯一冲突 | hook 抛错零残留；race P2002 映射 409 `DUPLICATE` 且零残留 | ☑ |
| 8 | 编码边界 | `ENCODING_ERROR.csv.bytes` + parser/route fixture 400 | ☑ |
| 9 | 往返等价 | source export → clean target import → target export，字符串级 diff 为空 | ☑ |
| 10 | 全新周期端到端 | `2026-09-28` 导入后既有 period report 与 insight 值级消费 | ☑ |
| 11 | UI 摘要禁静默 | `csvImport.ts` 成功/空/失败结构化摘要，测试 2/2；ChatScreen 按钮/toast | ☑ |
| 12 | 冻结边界零漂移 | export/period/chat/periodCsv/insight files diff bytes=0 | ☑ |
| 13 | Schema additive | base diff 16 insertions / 0 deletions，仅新增 `ImportedPeriodMetric` | ☑ |
| 14 | 死测试清账 | `dead-test-scan.count=0` | ☑ |
| 15 | 技术债清扫 | mobile Vitest 配置 `.ts → .mjs`，native loader 警告消除 | ☑ |

## 2. 门禁复跑

| 门 | 结果 | 留证 |
|---|---|---|
| build | exit 0；Web 339 modules | `gate-build.log|exit` |
| test | exit 0；server 27 files / 165 tests + mobile 9 files / 51 tests | `gate-test.log|exit` |
| smoke | exit 0；58 / 58 | `gate-smoke.log|exit` |
| persist | exit 0；9 / 9 | `gate-persist.log|exit` |
| persistence:v02 | exit 0；18 / 18，kill -9 跨进程 | `gate-persist-v02.log|exit` |
| deploy | build/start/test 复验见 `deploy-v02.log|exit`；post smoke 见 `deploy-post-smoke.log|exit` | `evidence/` |

## 3. 红绿证据

- 红：`red-server-period-csv-import.log`（模块缺失 exit 1）、`red-mobile-csv-import.log`（模块缺失 exit 1）。
- 绿：parser 11/11、fixtures 8/8、persistence/route 7/7、mobile summary 2/2 并入全量。
- 修复过程的真实失败调试：`green-server-period-csv-import-parser.log` 曾保留 3 failed 后转绿；smoke 中的 BOM/curl raw 失败在冻结契约实现内定位修复。

## 4. 边界声明

- 无既有 Prisma 字段/索引删除；仅新增 16 行模型。
- 未改 v0.9 导出端点、v0.10/v0.11 insight 端点、v0.7 轨迹渲染。
- 导入写侧新增路径不注入脏读数据；聚合仍只消费 ACTIVE P0 + MoodSnapshot。
- 停车场未入本轮：journal 随笔、洞察证据锚点、技术债专项轮。

结论：QA 通过，可执行 deploy 与 deploy 后 smoke。
