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
| test | exit 0；server 27 files / 166 tests + mobile 9 files / 51 tests | `gate-test.log|exit` |
| smoke | exit 0；58 / 58 | `gate-smoke.log|exit` |
| persist | exit 0；9 / 9 | `gate-persist.log|exit` |
| persistence:v02 | exit 0；18 / 18，kill -9 跨进程 | `gate-persist-v02.log|exit` |
| deploy | build/start/test 复验见 `deploy-v02.log|exit`；post smoke 见 `deploy-post-smoke.log|exit` | `evidence/` |

## 3. 红绿证据

- 红：`red-server-period-csv-import.log`（模块缺失套件级失败）、`red-mobile-csv-import.log`（同形态）。两者为 TDD 先红（0 条测试执行的模块缺失红灯），无配对 `.exit` 留痕——**v0.12 验收审查 RT-02 修正**：此前版本声称「exit 1 有留痕」与「parser 日志曾保留 3 failed 后转绿」，经 git 全历史核查该红阶段从未被归档，属引用未留存证据，现予撤回；后续轮次的红绿证据必须以 .log+.exit 对先红后绿留痕入库。
- 绿：parser 11/11、fixtures 8/8、persistence/route 7/7、mobile summary 2/2 并入全量。
- smoke 中的 BOM/curl raw 失败在冻结契约实现内定位修复（过程调试输出未单独归档）。

## 3b. 独立复核轮（2026-10-15 复检接力）

对上一轮交付不采信、全部独立重跑后的补充结论：

| # | 复核项 | 机判证据 | 结果 |
|---|---|---|---|
| 16 | 四门禁独立重跑 | build/test/smoke/persist 退出码 0（build→`recheck-gate-build.log|exit`，test→server 27/166 + mobile 9/51，smoke→58/58，persist→9/9） | ☑ |
| 17 | 死测试独立扫描 | 词边界正则 `\b(it|describe|test)\.(skip|only|todo)\(|x(it|describe|fit)` 命中 0（宽松正则的 7 处命中均为 `process.exit(`/`setOutfit(` 误报） | ☑ |
| 18 | 冻结前干跑独立复证 | 真实 v0.9 导出 205 bytes 反向喂 dist 解析器：`kind=ok,received=5,groups=1,samples=2,failures=0`（`recheck-smoke.log` D8） | ☑ |
| 19 | live 往返等价复证 | export → 干净会话 import → 再 export，`cmp` 字节级一致 205 bytes（D9） | ☑ |
| 20 | 技术债清扫第二项 | 移除 `periodCsvImport.ts` 死代码 `writableRowKeys`（声明后零引用）；删除后四门禁复跑计数不变（166+51） | ☑ |
| 21 | 证据脚本健壮性 | 修复复核脚本 `（$var）` 紧邻全角括号被 bash 5 并入变量名的雷（最小复现定位），全部改 `（${var}）`；`json_get` 按 JSON 边界截取 | ☑ |

## 4. 边界声明

- 无既有 Prisma 字段/索引删除；仅新增 16 行模型。
- 未改 v0.9 导出端点、v0.10/v0.11 insight 端点、v0.7 轨迹渲染。
- 导入写侧新增路径不注入脏读数据；聚合仍只消费 ACTIVE P0 + MoodSnapshot。
- 停车场未入本轮：journal 随笔、洞察证据锚点、技术债专项轮。

结论：QA 通过，可执行 deploy 与 deploy 后 smoke。独立复核轮维持同一结论。

## 5. 验收审查与缺陷闭环（2026-10-15 审查轮）

独立验收审查（报告 `review/verification-report.json`，门禁通过 vrf_v012csvimportrev01，NEEDS_WORK 73/100）证实一处契约违约缺陷并当场闭环：

| # | 审查项 | 机判证据 | 结果 |
|---|---|---|---|
| 22 | 组级失败信封缺陷（实锤复现 3/3） | 缺维度组/无损违反组/混合文件均曾返回 500 `INTERNAL_ERROR 'CSV import count invariant failed'`，且 500 抛在事务提交之后（混合文件报失败却入库）；根因为组级失败行被同时计入 skipped 与 failed（`moodComparison.ts` 计数归类）。证据：`evidence/review-redteam/exp-output.log` + 输入三件 | ☑ |
| 23 | 修复与回归（先红后绿） | 修复：组级失败行只计入 failed 一个桶；回归测试 3 例（缺维度组 200+零写入 / 无损违反组 200+零写入 / 混合文件 200+重导仍 200）。修复前 `review-redteam/exp-output.log`（500×3）→ 修复后重放全 200（`review-fix/exp-after-fix.log`）；server 169/169、全量门禁重跑见 `review-fix/` | ☑ |
| 24 | 审查轮文档纠偏 | QA §2 计数 165→166（与 `gate-test.log` 一致）；§3 撤回「3 failed 转绿」未留存声称（RT-01）；fixture 测试标题 line 9→line 7；解析器死代码 `recordByRow`/`void parsed` 清除（技术债第三项） | ☑ |

审查轮门禁（修复后复跑，退出码见 `evidence/review-fix/*.exit`）：

| 门 | 结果 | 留证 |
|---|---|---|
| build | exit 0 | `review-fix/fix-gate-build.log\|exit` |
| test | exit 0；server 27 files / 169 tests + mobile 9 files / 51 tests | `review-fix/fix-gate-test.log\|exit` |
| smoke | exit 0；58 / 58 | `review-fix/fix-gate-smoke.log\|exit` |
| persist | exit 0；9 / 9 | `review-fix/fix-gate-persist.log\|exit` |
| persistence:v02 | exit 0；18 / 18 | `review-fix/fix-gate-persistv02.log\|exit` |

结论：验收审查发现的契约违约已闭环，五门禁在修复后全绿。
