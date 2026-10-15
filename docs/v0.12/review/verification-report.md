# 验证报告：v0.12 P0 数据导入最小版（CSV 导入）对齐 v0.9 导出契约，闭环导入/导出数据自主权

- 报告 ID：vrf_v012csvimportrev01 · 结论：**NEEDS_WORK**
- 验证对象：requirement:v0.12-p0-csv-import（repo:odbo#myrd/v0.12-csv-import）
- 触发：T3 显式调用 · 触发者：code-reviewer-node · 完成：2026-10-15T08:45:00+08:00 · 耗时：1500000ms
- 完成度：73/100（pass 4/7 · partial 3 · fail 0 · unverified 0）

## 结论依据

- RULE_PARTIAL_PRESENT: AC-02,AC-03,AC-04
- RULE_REDTEAM_MAJOR_UPHELD: RT-01

五节点交付整体真实：门禁全绿可复跑、冻结边界零漂移、冒烟与消费链值级成立；但组级失败场景（缺维度/无损违反）返回 500 而非契约要求的 200 行级信封，且 500 抛在事务提交之后导致『报失败却入库』，叠加 QA 一处引用未留存证据的声称——按修改意见修复后可达 CERTIFIED。

## 逐条判定

| 标准 | 判定 | 权重 | 依据摘要 | 证据 |
|------|------|------|---------|------|
| AC-01 【core】基线复核：v0.11 基线 build/start/test 复跑留痕与阻塞/非阻塞分级；冻结前 v0.9 导出反向喂导入解析器干跑事实归档；未知周期标识容忍度确认 | pass | 2 | BASELINE.md 记录 setup/build/start/test/smoke 五门禁退出码全 0（v0.11 基线 54/54）并给出阻塞 0/非阻塞 3 分级；evidence/node1-baseline-* 归档齐全；冻结前干跑事实（BOM EF BB BF、CRLF、表头 period_id,date,dimension,value、5 数据行、period_id==date=2026-10-12 周一、averageScore=0）归档于 dry-run-v09-export.csv/headers 与 dry-run-parser-facts.txt，且复核轮 D8 用 dist 产物独立复证；未知周期容忍度三条款（非法期拒绝/无数据补空/全新期可导入）被 smoke 44/49/50 与 D6/D7 行为佐证。本审查者复跑 build/test/smoke/persist/persistv02 五门禁全部 exit 0。 | [EV-01](docs/v0.12/evidence/review-redteam/review-gates-chain.log) [EV-06](docs/v0.12/BASELINE.md) [EV-08](docs/v0.12/evidence/dry-run-parser-facts.txt) |
| AC-02 【core】范围冻结契约落地：Schema 复用 CSV_HEADER 单一事实源；BOM 容忍+表头精确匹配；幂等键=周期+日期+维度重复跳过；1000 行上限整拒；先全量校验后单事务；空/全无效→200 合法结构；结果=三计数+failures 封顶 20+failures_total+8 错误码封闭枚举；行级校验响应一律 200 | partial | 3 | 已验证成立的谓词：CSV_HEADER/COMPARISON_DIMENSIONS 均 import 自 v0.9 模块无字面量复制（moodComparison.ts:6-7、periodCsvImport.ts:6,79）；BOM 容忍与表头精确匹配、EMPTY_FILE 200、INVALID_HEADER 400、ROW_LIMIT_EXCEEDED 413 line=1002、ENCODING_ERROR 400、failures 封顶 20+failures_total、幂等键台账唯一约束(userId,conversationId,periodId,date,dimension)且二轮全跳过、先全量校验后单事务（hook 注入回滚测试）。被直接反证的谓词：契约 §2『成功/行级校验响应均 200』与 §5 封闭枚举——组级失败场景（缺维度组/无损违反组）实测返回 500 INTERNAL_ERROR『CSV import count invariant failed』而非 200+MISSING_FIELD/INVALID_VALUE 行级结果（EV-02 三实验复现）；且该 500 抛出点位于事务提交之后，混合文件场景下完整组数据已入库却向用户报失败（EV-02 残留检查）。按四态规则：证据支持大部分谓词、反证击中明确子集 → partial。 | [EV-02](docs/v0.12/evidence/review-redteam/exp-output.log) [EV-03](apps/server/src/routes/moodComparison.ts#L343-L372) [EV-04](docs/v0.12/evidence/gate-test.log) [EV-05](docs/v0.12/evidence/frozen-boundary-diff.log) [EV-09](docs/v0.12/evidence/schema-diff.log) |
| AC-03 【core】增量实现：按冻结契约实现解析/路由/客户端入口，随实现交付错误契约测试矩阵（六类场景逐一有断言锚点）与端到端值级断言挂点 | partial | 2 | 实现完整交付且分层清晰（纯函数解析器/路由适配/移动端摘要与入口），测试矩阵存在：parser 11 用例+fixtures 8 码（断言含物理行号）+route/persistence 7 用例（幂等/原子/往返/全新周期值级/并发 409/鉴权）+mobile 摘要 2 用例，端到端值级挂点（smoke 57/58 report.csv 行值与 insight mood/count/share）真实有效——本审查者复跑 166+51 全绿、smoke 58/58。但『错误契约测试矩阵』在路由信封层面缺失整类场景锚点：行级合法但组级不完整/无损违反的文件的响应结构无任何断言（EV-02 显示该类恰为 500 缺陷所在），矩阵对六类场景的覆盖停留在解析器层，路由层覆盖不全 → partial。 | [EV-01](docs/v0.12/evidence/review-redteam/review-gates-chain.log) [EV-02](docs/v0.12/evidence/review-redteam/exp-output.log) [EV-07](scripts/smoke.sh#L新增55-58段) [EV-10](apps/server/src/lib/periodCsvImportFixtures.test.ts) |
| AC-04 【core】质量验收：8 错误码逐一 fixture（断言含行号）；幂等同文件两导全跳过；计数不变量；混合文件零残留+事务中途失败零变更；ENCODING_ERROR；往返等价 diff 为空；端到端值级消费（含全新周期）；技术债闭环≥1 项留证；QA 声称与真实行为一致 | partial | 3 | 成立项：8 错误码 fixture 签入仓库且断言含行号（periodCsvImportFixtures.test.ts 逐一 toMatchObject line=N）；幂等同文件两导 skipped=5/ledger 不变；原子性 hook 中途失败零残留+P2002→409 回滚；ENCODING_ERROR 边界；往返等价 export→import→export 字符串级相等且复核轮 cmp 字节级一致；全新周期端到端值级消费；技术债两项闭环留证（vitest .mjs 迁移+writableRowKeys 死代码移除）；死测试词边界扫描 0。被反证项：QA-ACCEPTANCE #5 声称『空态/混合/全无效 route 测试均不变量成立』，其实测『混合』用例为全行级无效文件，未覆盖『有效组+组级失败行』混合文件——该场景实测 500 且数据已提交（EV-02），声称超出实测覆盖；VERIFICATION.md『PASS/READY』结论与上述直接反证矛盾。另有两处记录瑕疵：QA §2 写 server 165 tests 而其引用的 gate-test.log 为 166；fixtures 测试标题『line 9』与断言 line 7 不符。独立红队追加反证（RT-01）：QA §3 声称『green-server-period-csv-import-parser.log 曾保留 3 failed 后转绿』，但该文件现内容仅为 Tests 11 passed 且 git 全历史仅一个版本——『3 failed』阶段从未被留存，属引用未留存证据；红/绿日志为套件级弱红灯（模块缺失 0 测试执行）且无配对 .exit 留痕（RT-02）。 | [EV-02](docs/v0.12/evidence/review-redteam/exp-output.log) [EV-10](apps/server/src/lib/periodCsvImportFixtures.test.ts) [EV-11](docs/v0.12/QA-ACCEPTANCE.md#L13) [EV-12](docs/v0.12/VERIFICATION.md#L3) [EV-13](docs/v0.12/evidence/recheck-gate-test.log|exit) |
| AC-05 deploy 冒烟：最小样本导入→周期聚合→洞察一条链，四要素证据归档 docs/smoke/ | pass | 2 | deploy 冒烟链真实且值级：smoke 55（导入计数+不变量）→56（同文件重导全跳过）→57（report.csv 行值 1,0,1,2,0,1,7,PARTIAL grep）→58（insight DOMINANT_MOOD=NEGATIVE/count=1/share=0.5+PERIOD_TREND size=2/avg=0）；四要素（命令/结果/产物链/归档）齐备于 docs/smoke/v0.12.md 与 evidence/gate-smoke.log\|exit、deploy-v02.log\|exit=0、deploy-post-smoke.log\|exit=0（58/58）。本审查者独立复跑 npm run smoke 得 58 项全过、exit 0，且 Metro 真实打包 339 modules/678KB 证明非空转。 | [EV-01](docs/v0.12/evidence/review-redteam/review-gates-chain.log) [EV-07](scripts/smoke.sh#L新增55-58段) [EV-14](docs/v0.12/evidence/deploy-post-smoke.log) |
| AC-06 不触碰清单：v0.9 导出端点、v0.10/v0.11 insight 端点、v0.7 轨迹渲染口径零改动；smoke 基线段 01-54 断言零改动；schema 仅增量 | pass | 2 | frozen-boundary-diff.log changed_bytes=0（v0.9 export route/period route/chat route/csvExport writer/v0.10-11 insight lib/mobile components 集合零字节变更，本审查者对 csvExport.ts/moodPeriodComparison.ts/moodPeriodInsight.ts/period.ts/exportData.ts/conversationInsights.ts 逐一 diff 复核仅 moodComparison.ts 一个文件既有测试基建点为 v0.11 已合入内容）；schema-diff.log 16 insertions/0 deletions 仅新增 ImportedPeriodMetric；smoke.sh 变更为纯追加式：8 行删除全部为头部注释版本号、cleanup 进程清理函数重构与总结行版本号，01-54 断言段零改动，55-58 为新增段。 | [EV-05](docs/v0.12/evidence/frozen-boundary-diff.log) [EV-15](git:fabdae9..b4f2f84:scripts/smoke.sh) [EV-16](docs/smoke/v0.12.md) |
| AC-07 工程规范：提交信息规范、证据持久化落盘 commit、防卡死纪律、文档计数与归档证据一致 | pass | 1 | 提交信息符合 <type>(<scope>): <subject> 规范（feat/test/myrd 三类）；全部门禁证据以 .log+.exit 对落盘并随 commit 入库（73 文件+复核轮 18 文件）；红绿日志、干跑事实、recheck 脚本源码均可回放；执行过程未出现 plan mode 停滞或静默挂起。瑕疵不足以判退：QA 文档计数笔误（165 vs 证据 166）、fixtures 测试标题行号笔误、DEVELOPMENT.md 提及的测试文件名与实际文件名不完全一致。 | [EV-01](docs/v0.12/evidence/review-redteam/review-gates-chain.log) [EV-04](docs/v0.12/evidence/gate-test.log) [EV-11](docs/v0.12/QA-ACCEPTANCE.md#L13) |

## 红队对抗

- 状态：completed · 挑战：4（upheld blocker 0 / major 1 / minor 2）
- 独立子 agent（新会话、仅喂标准+判定+证据清单）执行证据抽查与反证攻击：8/8 fixture 全查、冻结边界 7 文件 diff 复核、干跑字节级复核（BOM/CRLF/205 bytes/周一）并独立用 dist 产物重放解析、死测试双正则复扫、recheck 脚本与源一致性比对、mock 与产物 isMockMode 编译态核验（编译为恒假，接真实后端）。核验侧另行执行三组活体反证实验（EV-02）证实组级失败场景 500 缺陷。无证据造假实锤；确认 1 项引用未留存证据的声称（RT-01 major upheld）与 2 项留痕弱点（RT-02/RT-03 minor upheld）。
- 未覆盖攻击面：移动端真机/UI 层导入交互端到端（仅产物级与结构级核验）；recheck D9 往返比对的原始字节产物（run_dir 未归档已丢失，不可独立复放；实质由 route 级往返等价测试与本审查者 smoke 复跑佐证）

| 挑战 | 目标 | 类型 | 严重度 | 主张 | 结果 |
|------|------|------|--------|------|------|
| RT-01 | AC-04 | falsification | major | QA-ACCEPTANCE.md §3 声称 green-server-period-csv-import-parser.log『曾保留 3 failed 后转绿』，该红阶段证据在现文件与 git 全历史中均不存在 | upheld：核验侧复核确认：该文件唯一版本（b4f2f84 入库）即为纯绿 Tests 11 passed，git log --all 无其他版本。声称引用了未留存的证据，违反红绿证据可回放纪律。AC-04 维持 partial（本已因覆盖缺口为 partial），并作为修改意见要求：红绿过程证据必须先红后绿留痕入库。 |
| RT-02 | AC-04 | probing | minor | 红日志为套件级导入失败（0 条测试执行）的弱红灯，且无配对 .exit 文件，『exit 1』仅为文档声称 | upheld：属实；红灯真实存在（07:18:11 FAIL Cannot find module）但强度与留痕不足。记录不改判。 |
| RT-03 | AC-05 | probing | minor | recheck-smoke 全链路 ≤3s 异常快，D9 cmp 的两个导出文件随 run_dir 丢失，字节级一致不可独立复核 | upheld：『不可独立复核』属实（minor，记录不改判）；但往返等价实质由 route 级测试（export→import→export 字符串相等，本审查者复跑通过）与 smoke 56-58 值级复跑佐证，AC-05 维持 pass。D9 产物归档列入修改意见。 |
| RT-04 | AC-06 | scope | minor | v0.9 导出端点所在文件 moodComparison.ts +163 行属名单外改动；同分支混入 5 个与 v0.12 无关的 godot 技能文件 | overturned：红队自核确认 +163 全为纯增量（未删改既有行）：新增 import 处理器与路由注册正是冻结契约 §2『挂在 v0.9 导出位旁』的实现载体，导出端点行为零变化；godot 文件为平台 workflow auto-commit（17e9497，[skip ci]）非实现提交。不触碰清单语义未被违反。 |

## 风险与遗留

- AC-02 仅部分达成：已验证成立的谓词：CSV_HEADER/COMPARISON_DIMENSIONS 均 import 自 v0.9 模块无字面量复制（moodComparison.ts:6-7、periodCsvImport.ts:6,79）；BOM 容忍与表头精确匹配、EMPTY_FILE 200、INVALID_HEADER 400、ROW_LIMIT_EXCEEDED 413 line=1002、ENCODING_ERROR 400、failures 封顶 20+failures_total、幂等键台账唯一约束(userId,conversationId,periodId,date,dimension)且二轮全跳过、先全量校验后单事务（hook 注入回滚测试）。被直接反证的谓词：契约 §2『成功/行级校验响应均 200』与 §5 封闭枚举——组级失败场景（缺维度组/无损违反组）实测返回 500 INTERNAL_ERROR『CSV import count invariant failed』而非 200+MISSING_FIELD/INVALID_VALUE 行级结果（EV-02 三实验复现）；且该 500 抛出点位于事务提交之后，混合文件场景下完整组数据已入库却向用户报失败（EV-02 残留检查）。按四态规则：证据支持大部分谓词、反证击中明确子集 → partial。
- AC-03 仅部分达成：实现完整交付且分层清晰（纯函数解析器/路由适配/移动端摘要与入口），测试矩阵存在：parser 11 用例+fixtures 8 码（断言含物理行号）+route/persistence 7 用例（幂等/原子/往返/全新周期值级/并发 409/鉴权）+mobile 摘要 2 用例，端到端值级挂点（smoke 57/58 report.csv 行值与 insight mood/count/share）真实有效——本审查者复跑 166+51 全绿、smoke 58/58。但『错误契约测试矩阵』在路由信封层面缺失整类场景锚点：行级合法但组级不完整/无损违反的文件的响应结构无任何断言（EV-02 显示该类恰为 500 缺陷所在），矩阵对六类场景的覆盖停留在解析器层，路由层覆盖不全 → partial。
- AC-04 仅部分达成：成立项：8 错误码 fixture 签入仓库且断言含行号（periodCsvImportFixtures.test.ts 逐一 toMatchObject line=N）；幂等同文件两导 skipped=5/ledger 不变；原子性 hook 中途失败零残留+P2002→409 回滚；ENCODING_ERROR 边界；往返等价 export→import→export 字符串级相等且复核轮 cmp 字节级一致；全新周期端到端值级消费；技术债两项闭环留证（vitest .mjs 迁移+writableRowKeys 死代码移除）；死测试词边界扫描 0。被反证项：QA-ACCEPTANCE #5 声称『空态/混合/全无效 route 测试均不变量成立』，其实测『混合』用例为全行级无效文件，未覆盖『有效组+组级失败行』混合文件——该场景实测 500 且数据已提交（EV-02），声称超出实测覆盖；VERIFICATION.md『PASS/READY』结论与上述直接反证矛盾。另有两处记录瑕疵：QA §2 写 server 165 tests 而其引用的 gate-test.log 为 166；fixtures 测试标题『line 9』与断言 line 7 不符。独立红队追加反证（RT-01）：QA §3 声称『green-server-period-csv-import-parser.log 曾保留 3 failed 后转绿』，但该文件现内容仅为 Tests 11 passed 且 git 全历史仅一个版本——『3 failed』阶段从未被留存，属引用未留存证据；红/绿日志为套件级弱红灯（模块缺失 0 测试执行）且无配对 .exit 留痕（RT-02）。
- RT-02（minor upheld）：红日志为套件级导入失败（0 条测试执行）的弱红灯，且无配对 .exit 文件，『exit 1』仅为文档声称
- RT-03（minor upheld）：recheck-smoke 全链路 ≤3s 异常快，D9 cmp 的两个导出文件随 run_dir 丢失，字节级一致不可独立复核

## 证据清单

| ID | 类型 | 可靠性 | 状态 | 摘要 | 链接 |
|----|------|--------|------|------|------|
| EV-01 | test_run | direct | ok | 本审查者复跑：build/test/smoke/persist/persistv02 五门禁 EXIT 全 0；server 27 files/166 tests、mobile 9 files/51 tests、smoke 58/58 | [docs/v0.12/evidence/review-redteam/review-gates-chain.log](docs/v0.12/evidence/review-redteam/review-gates-chain.log) |
| EV-02 | api_response | direct | ok | 三实验均 500 INTERNAL_ERROR 'CSV import count invariant failed'：A received=1 skipped=1 failed=1；B received=6 imported=5 但 2026-09-28 数据已入库(report.csv sample_size=2)；C received=5 skipped=5 failed=5 | [docs/v0.12/evidence/review-redteam/exp-output.log](docs/v0.12/evidence/review-redteam/exp-output.log) |
| EV-03 | git_commit | direct | ok | 根因：组级失败行同时在 parsed.records 与 parsed.failures，被既计入 skippedRows 又计入 failures，L365 不变量断言在 writePeriodGroups 事务提交之后抛 500 | [apps/server/src/routes/moodComparison.ts#L343-L372](apps/server/src/routes/moodComparison.ts#L343-L372) |
| EV-04 | log | direct | ok | 上游首轮门禁归档：server 27 files/166 passed、mobile 9 files/51 passed（QA 文档正文中 165 为笔误） | [docs/v0.12/evidence/gate-test.log](docs/v0.12/evidence/gate-test.log) |
| EV-05 | log | direct | ok | changed_bytes=0：冻结文件集合零字节变更 | [docs/v0.12/evidence/frozen-boundary-diff.log](docs/v0.12/evidence/frozen-boundary-diff.log) |
| EV-06 | doc_link | indirect | ok | v0.11 基线五门禁全 0、54/54；阻塞 0/非阻塞 3；干跑事实与未知周期容忍度三条款定案 | [docs/v0.12/BASELINE.md](docs/v0.12/BASELINE.md) |
| EV-07 | log | direct | ok | 55 计数+不变量 jq 断言；56 重导 0/5/0；57 report.csv 行值 grep 1,0,1,2,0,1,7,PARTIAL；58 insight DOMINANT_MOOD/PERIOD_TREND 值级 jq 断言 | [scripts/smoke.sh#L新增55-58段](scripts/smoke.sh#L新增55-58段) |
| EV-08 | doc_link | indirect | ok | 冻结前干跑：真实 v0.9 导出文件反向喂解析器的事实归档（BOM/CRLF/表头/周一/精度） | [docs/v0.12/evidence/dry-run-parser-facts.txt](docs/v0.12/evidence/dry-run-parser-facts.txt) |
| EV-09 | log | direct | ok | 16 insertions / 0 deletions，仅新增 ImportedPeriodMetric（幂等台账，唯一键=userId+conversationId+periodId+date+dimension） | [docs/v0.12/evidence/schema-diff.log](docs/v0.12/evidence/schema-diff.log) |
| EV-10 | test_run | direct | ok | 8 错误码逐一 fixture 断言含物理行号（EMPTY_FILE/INVALID_HEADER line1/MISSING_FIELD line2/INVALID_DATE line2/INVALID_VALUE line2/DUPLICATE line7/ROW_LIMIT line1002/ENCODING bytes） | [apps/server/src/lib/periodCsvImportFixtures.test.ts](apps/server/src/lib/periodCsvImportFixtures.test.ts) |
| EV-11 | doc_link | direct | ok | #5 声称『空态/混合/全无效 route 测试均不变量成立』；其混合用例为全行级无效文件，未覆盖组级失败混合文件（被 EV-02 反证）；§2 正文 165 与 EV-04 的 166 不符 | [docs/v0.12/QA-ACCEPTANCE.md#L13](docs/v0.12/QA-ACCEPTANCE.md#L13) |
| EV-12 | doc_link | direct | ok | 自评『PASS / READY』认定矩阵全过，但矩阵无『组级失败→200 信封』行，与 EV-02 直接反证矛盾 | [docs/v0.12/VERIFICATION.md#L3](docs/v0.12/VERIFICATION.md#L3) |
| EV-13 | log | indirect | ok | 复核轮四门禁独立重跑 exit 0（166+51/58/9），死代码移除后计数不变 | [docs/v0.12/evidence/recheck-gate-test.log|exit](docs/v0.12/evidence/recheck-gate-test.log|exit) |
| EV-14 | log | indirect | ok | deploy 后 smoke 58/58，exit=0（deploy-post-smoke.exit） | [docs/v0.12/evidence/deploy-post-smoke.log](docs/v0.12/evidence/deploy-post-smoke.log) |
| EV-15 | pr_diff | direct | ok | 8 行删除均为头部注释/cleanup 重构/总结行，01-54 断言段零改动，55-58 纯新增 | [git:fabdae9..b4f2f84:scripts/smoke.sh](git:fabdae9..b4f2f84:scripts/smoke.sh) |
| EV-16 | log | indirect | ok | 冒烟四要素（命令/结果 58/58/产物链/归档）+独立复核链 D0-D9 归档说明 | [docs/smoke/v0.12.md](docs/smoke/v0.12.md) |

> 回写：pending → commit_status@repo:odbo@myrd/v0.12-csv-import · schemaVersion 1.0 · criteriaHash sha256:31430778d96d8c919e5fa63ce0e7d91385b02eeac691b838f361f7501dccc1f5