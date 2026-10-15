# v0.12 交付核验报告

结论：**PASS / READY**。全部 P0 DoD 机器证据通过，冻结边界零漂移，deploy 后冒烟闭环。

## 认定矩阵

| 验收锚点 | 判定 | 证据 |
|---|---|---|
| v0.11 基线四要素 | PASS | baseline build/start/test/smoke 全 exit 0，54/54 |
| 冻结前干跑 | PASS | 真实 v0.9 导出 205 bytes 反向解析；BOM/CRLF/5 行/周一/数值事实归档 |
| 单一列契约 | PASS | `CSV_HEADER` import + dimension import，无复制 |
| 8 错误码 | PASS | 8 fixture 全绿；文件级/行级映射逐一断言 |
| 1000 行整拒 | PASS | fixture route/parser `ROW_LIMIT_EXCEEDED`, line=1002, limit=1000 |
| 全量校验/单事务 | PASS | 全无效 200 零写；事务 hook 中途失败零残留 |
| 幂等 | PASS | 二轮 5 skip / 0 import / 0 write；race P2002 → 409 且零残留 |
| 往返等价 | PASS | export → clean import → export 字符串完全相等 |
| 聚合/洞察消费 | PASS | 全新周期 report `sample_size=2,pos=1,neg=1,avg=0`；insight NEGATIVE/count=1/share=.5 |
| UI 非静默 | PASS | structured summary tests；ChatScreen button/toast |
| 持久化 | PASS | base 9/9、v02 18/18（kill -9） |
| deploy | PASS | build/start/test=0；post smoke 58/58 |

## 最终真实门禁

| Gate | Count/Result | Exit | Evidence |
|---|---|---:|---|
| build | server tsc + mobile typecheck + Web 339 modules | 0 | `evidence/gate-build.log` |
| test | server 27 files / **166** passed; mobile 9 files / **51** passed | 0 | `evidence/gate-test.log` |
| smoke | **58 / 58** | 0 | `evidence/gate-smoke.log` |
| persist:check | 9 / 9 | 0 | `evidence/gate-persist.log` |
| persistence:v02 | 18 / 18 | 0 | `evidence/gate-persist-v02.log` |
| deploy:v02 | build/start/test all 0 | 0 | `evidence/deploy-v02.log` |
| deploy smoke | **58 / 58** | 0 | `evidence/deploy-post-smoke.log` |
| dead tests | 0 | 0 | `evidence/dead-test-scan.count` |
| frozen diff | frozen files changed bytes = 0 | 0 | `evidence/frozen-boundary-diff.log` |
| schema diff | 16 added / 0 deleted | additive | `evidence/schema-diff.log` |

## 红绿链

- Red：server/mobile 新模块缺失 exit 1；后续 parser/smoke 失败均定位后复跑。
- Green：parser 11、fixture 8、persistence/route 7、mobile summary 2，再汇入全量 166+51。
- 无 skip/only/todo/xit/failing。

## 最终边界

- 不触清单文件 diff bytes=0。
- 只新增 `ImportedPeriodMetric`；schema 0 deletion。
- 停车场未扩：journal、锚点可解释性、技术债专项。

## 独立复核轮（2026-10-15 复检接力）

复核轮不采信上轮声明，独立重跑全部门禁并重建用户链路（脚本 `scripts/v012-recheck-smoke.sh`）：

| Gate | Count/Result | Exit | Evidence |
|---|---|---:|---|
| build（删除死代码后复跑） | server tsc + mobile typecheck + Web export | 0 | `evidence/recheck-gate-build.log|exit` |
| test（删除死代码后复跑） | server 27 files / 166 passed；mobile 9 files / 51 passed | 0 | `evidence/recheck-gate-test.log|exit` |
| smoke（删除死代码后复跑） | 58 / 58 | 0 | `evidence/recheck-gate-smoke.log|exit` |
| persist:check（删除死代码后复跑） | 9 / 9 | 0 | `evidence/recheck-gate-persist.log|exit` |
| 独立复核链 D0-D9 | 导入→幂等→聚合→洞察→干跑反向喂解析器→往返字节级一致 | 0 | `evidence/recheck-smoke.log|exit` |
| 死测试独立扫描 | 词边界正则命中 0 | 0 | QA-ACCEPTANCE #17 |
| 技术债清扫第二项 | `writableRowKeys` 死代码移除，门禁计数不变 | 0 | QA-ACCEPTANCE #20 |

结论维持：**PASS / READY**。冻结边界零漂移，「导入/导出」数据自主权闭环在独立复核下成立。
