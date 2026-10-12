# 验证报告：v0.9 增量「周期报告多周期对比 + CSV 导出」五节点接力交付（基线确认→范围冻结→增量实现→质量验收→deploy 冒烟）

- 报告 ID：vrf_v09audit00000001 · 结论：**NEEDS_WORK**
- 验证对象：requirement:v0.9-period-comparison-csv-export（docs/v0.9/REQUIREMENTS.md）
- 触发：T3 显式调用 · 触发者：code-review-agent · 完成：2026-10-12T02:30:00Z · 耗时：1800000ms
- 完成度：96/100（pass 14/15 · partial 1 · fail 0 · unverified 0）

## 结论依据

- RULE_PARTIAL_PRESENT: AC-13 判 partial（413 超限保护生产路径不可达，红队 RT-05 独立确认），不满足 CERTIFIED 的 failed=0∧partial=0 条件
- RULE_NO_CORE_FAIL: 无 core 标准判 fail、红队无 upheld blocker，未触发 REJECTED
- RULE_SCORE_ABOVE_REJECT: score=96 ≥ 40，且 DoD 九条对应的 AC-04..AC-12 全部 pass，交付主体成立

v0.9 五节点接力交付主体成立：四门禁本机复跑全绿、红绿链经变异测试坐实、DoD 九条全 pass、范围纪律零越界；唯一实质缺陷是 CSV 导出超限 413 保护在生产路径不可达（take:1000 截断使判定恒假），修复为一行级改动后可复验升级 CERTIFIED。

## 逐条判定

| 标准 | 判定 | 权重 | 依据摘要 | 证据 |
|------|------|------|---------|------|
| AC-01 【core】承接 v0.8 五节点闭环基线，v0.7 轨迹渲染冻结口径全程不触碰 | pass | 2 | BASELINE.md 承接 v0.8 闭环并锚定 e625075；Node1 提交 89fcf19 中 chat.routes.test.ts 仅加 vi.useFakeTimers/useRealTimers 两行冻结时钟（EV-17），未动 v0.8 断言；node4-changed-paths.txt 与逐笔 git show 核实无 v0.7/v0.8 路由契约改动（EV-13）；v0.8 冒烟 01-45 段在本轮复跑中全绿（EV-03） | [EV-03](docs/v0.9/evidence/audit-smoke.log) [EV-13](docs/v0.9/evidence/node4-changed-paths.txt) [EV-17](docs/v0.9/evidence/audit-chat-test-fix.diff) |
| AC-02 【core】范围冻结四件套（对比端点契约+导出端点契约+停车场维持+审查缺口补齐裁决）签认且提交先于红测与实现 | pass | 2 | 89fcf19 含 REQUIREMENTS.md（状态 FROZEN-SIGNED）与 REVIEW.md（SIGNED），对比端点 §2 与导出端点 §3 契约完整覆盖任务需求四件套；提交时间 07:15:49 先于红测 6386924（07:17 后）与实现 7bcf1b3（07:24:46），git log --reverse 顺序核验（EV-12, EV-15） | [EV-12](docs/v0.9/REQUIREMENTS.md) [EV-15](docs/v0.9/evidence/audit-commit-order.txt) |
| AC-03 【core】红测先于实现提交且红绿日志真实，故障注入钩子为唯一新增测试基建点 | pass | 2 | 红测提交 6386924 仅含测试文件，node3-red-comparison.log 显示 suite 因 moodComparison.js 模块不存在而失败且 exit=1（07:17:34，EV-05）；中间态 node3-green-comparison-first.log 11 测试 4 failed（07:20:12，断言级失败，EV-06）；最终 node3-green-comparison-final.log 12/12 exit=0（07:23:45，EV-07），实现提交在其后；红绿时间线与提交序一致；钩子仅 __setMoodComparisonSourceForTests/__resetMoodComparisonSourceForTests 两个具名导出（EV-11 代码核实） | [EV-05](docs/v0.9/evidence/node3-red-comparison.log) [EV-06](docs/v0.9/evidence/node3-green-comparison-first.log) [EV-07](docs/v0.9/evidence/node3-green-comparison-final.log) [EV-11](apps/server/src/routes/moodComparison.ts@HEAD) |
| AC-04 【core】冻结缺口四点（趋势阈值/空趋势/完整度/周期数）补齐并前置于实现 | pass | 2 | REVIEW.md §1 载明四点裁决（阈值 (后-前)/前 与 ±5%、空趋势 empty=true 不参与整体、完整度 1×5=5 三态、N=3 上限补空不缩数组）并声明「同时签认为实现契约」，与 REQUIREMENTS §2-§3 一致；提交先于实现（同 AC-02）；实现逐点核对一致（EV-10：relativeTrend/completenessFor/bounds 固定长度） | [EV-10](apps/server/src/lib/moodPeriodComparison.ts@HEAD) [EV-12](docs/v0.9/REQUIREMENTS.md) |
| AC-05 【core】对比值级断言：双周期已知样本聚合值与趋势枚举可复算 | pass | 2 | 锚点测试 aggregates two known cycles 断言 2026-09-28/10-05 双周期聚合值（count 1/1、negative 1/0、averageScore -1/1）与趋势：rate=0→STABLE、(0-1)/1=-1→DOWN、(1-(-1))/(-1)=-2→DOWN、positive 分母 0→empty，手算全部可复算；本机复跑 13/13 绿（EV-08） | [EV-08](docs/v0.9/evidence/node4-dod-anchor-tests.log) [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) |
| AC-06 【core】空态断言：精确空态码/空标记，单周期空与整体空两档 | pass | 2 | distinguishes one empty period 测试精确断言单周期 aggregateValues 五值全 null + completeness {actualPoints:0,ratio:0,status:EMPTY} 与整体 {actualPoints:5,ratio:0.5,status:PARTIAL}（EV-09）；returns a machine-readable no-file signal 断言整体空 CSV 204 + x-report-empty=true（EV-09）；QA 期针对两档区分做过补强（QA-ACCEPTANCE 补强说明） | [EV-08](docs/v0.9/evidence/node4-dod-anchor-tests.log) [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) |
| AC-07 【core】边界断言：N=3 上限拒绝、仅 1/2 周期补空、跨年自然周对齐 | pass | 2 | rejects a period count above the frozen N=3 limit 断言 periods=4 → 400 PERIOD_COUNT_REJECTED（EV-09；冻结契约允许 1/2/3、>3 拒绝）；pads only missing source cycles 对空源 N=1/2/3 断言数组长度精确等于请求值且补空周期 empty；aligns weekly boundaries 断言跨年周界 id 2025-12-29/2026-01-05 及 from/to UTC 瞬间精确（EV-09） | [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) |
| AC-08 【core】导出三验：非空+可解析+行数与源一致，含 CSV 转义用例 | pass | 2 | exports a non-empty parseable CSV 断言 200、text/csv; charset=utf-8、BOM 剥离后解析 11 行（表头+10 数据行=2 周期×5 维与源一致）、表头 4 列、首尾数据行内容逐格精确（EV-09）；escapes RFC 4180 测试断言 encodeCsvCell('x,"y"\nz') === '"x,""y"\nz"' 精确转义（EV-09）；本机复跑全绿（EV-02） | [EV-02](docs/v0.9/evidence/audit-test.log) [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) |
| AC-09 【core】导出元信息断言：行数不含表头，生成时间仅断存在与 ISO 格式（防 flaky） | pass | 2 | 同一导出测试断言 x-report-row-count='10' 与解析出的 10 数据行一致（不含表头）；x-report-generated-at 仅断 typeof string + ISO regex /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/（存在+格式，未断具体值，防 flaky，EV-09） | [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) |
| AC-10 【core】降级断言：错误码/降级标记机判，含注入重试后降级与部分失败可用结果+降级标记双断言 | pass | 2 | 三条降级测试均经故障注入钩子：①对比端点注入连续失败断言 200 信封 available=false/degraded=true/periods=[]；②CSV 注入连续失败断言 200 JSON {attempts:2} + x-report-available=false/degraded=true 双断言；③单周期失败断言 5 数据行可用 + x-report-partial=true/degraded=true 双头（EV-09）；错误码/标记全部机判字段（EV-11 实现：attempt 循环 2 次 + SourceUnavailableError 分支） | [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) [EV-11](apps/server/src/routes/moodComparison.ts@HEAD) |
| AC-11 死测试余量清零或按四类口径归档说明 | pass | 1 | 本机四口径复扫：.skip(/.only(/it.todo/test.todo = 0；xit( 模式 5 条命中经逐条上下文回看均为 process.exit( 子串误报（业务代码正常退出，非 skip 测试）；node4-dead-test-scan.log 与 recheck-dead-test-count.txt 均为 0（EV-16） | [EV-14](docs/v0.9/evidence/audit-schema-diff-count.txt) [EV-16](docs/v0.9/evidence/node5-final-gates.txt) |
| AC-12 【core】deploy 冒烟 = v0.8 脚本 + 导出产物探针一条，全链路绿 | pass | 2 | 本机复跑 npm run smoke exit 0 且输出「心伴 v0.9 冒烟通过：46 项 / 46 项」（EV-03）；第 46 步探针实现与 docs/smoke/v0.9.md 六条断言一一对应（200/BOM/表头/5 行 4 列/维度顺序/Row-Count=5/ISO 时间，EV-19）；persist 9/9 exit 0（EV-04）；deploy 留证 node5-post-deploy-smoke.log 与 node5-final-gates.txt 记录部署后同值（EV-16） | [EV-03](docs/v0.9/evidence/audit-smoke.log) [EV-04](docs/v0.9/evidence/audit-persist.log) [EV-16](docs/v0.9/evidence/node5-final-gates.txt) [EV-19](scripts/smoke.sh@HEAD 第 422-452 行) |
| AC-13 【core】冻结契约实现正确性：趋势阈值/完整度/周界/补空/CSV 转义/空态 204/超限 413/降级信封逐条符合 REQUIREMENTS 冻结文本 | partial | 2 | 周界数学（周一回退 (weekday+6)%7、UTC+8 偏移、左闭右开）、趋势阈值（>=0.05 UP / <=-0.05 DOWN 含边界）、完整度三态、补空不缩数组、RFC 4180 转义+ Trident BOM、204 空态、降级信封逐条核对符合冻结契约（EV-10, EV-11）；但导出端点超限保护生产不可达：loadSource 以 take:1000 拉取 moodRows 使 length 恒 ≤1000，后续判定 length > CSV_EXPORT_ROW_LIMIT(=1000) 恒 false（EV-11），生产中超限源数据被静默截断而非按契约 §3 返回 413 CSV_EXPORT_TOO_LARGE，违反「超大数据拒绝＋上限提示」；413 分支仅可被 vi.mock prisma 返回 1001 行的测试触达（EV-09 rejects oversized source data），属替代实现只覆盖部分场景；次要：整体趋势采用「任一周期空→全维度 null」保守口径，与 REQUIREMENTS §2「基于首个与最后一个可复算端点」文本存在解释偏差（实现注释已声明但冻结文档未同步） | [EV-09](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) [EV-10](apps/server/src/lib/moodPeriodComparison.ts@HEAD) [EV-11](apps/server/src/routes/moodComparison.ts@HEAD) [EV-12](docs/v0.9/REQUIREMENTS.md) |
| AC-14 【core】范围纪律：各交付提交无 schema/迁移/v0.7 v0.8 既有契约/冒烟基线段越界改动 | pass | 2 | 五笔交付提交逐笔 git show 核对：89fcf19 仅文档+chat 测试时钟冻结；6386924 仅测试文件；7bcf1b3 实现 9 文件且 smoke.sh 仅追加 46 步（删除 2 行仅为旧标题/旧汇总行 45→46 更新，01-45 各步骤断言零删改）；a37dbae 测试 +34 行为新增补强测试（QA-ACCEPTANCE 披露）；80b5348/def411f 仅文档与证据；git diff e625075..HEAD -- '*schema.prisma*' = 0 行（EV-14）；无移动端功能面与既有路由契约改动（EV-13） | [EV-13](docs/v0.9/evidence/node4-changed-paths.txt) [EV-14](docs/v0.9/evidence/audit-schema-diff-count.txt) [EV-15](docs/v0.9/evidence/audit-commit-order.txt) |
| AC-15 验收记录与证据文件已 commit 持久化 | pass | 1 | 四件套文档（REQUIREMENTS/REVIEW/QA-ACCEPTANCE/DEPLOY/RECHECK/BASELINE/DEVELOPMENT）与 70+ 证据文件全部入库于对应节点提交；本审查复跑证据以 audit- 前缀归档 docs/v0.9/evidence/ 并随本报告 commit，含 sha256 digest，可脱离本会话回放（EV-01..EV-04） | [EV-01](docs/v0.9/evidence/audit-build.log) [EV-02](docs/v0.9/evidence/audit-test.log) [EV-03](docs/v0.9/evidence/audit-smoke.log) [EV-04](docs/v0.9/evidence/audit-persist.log) |

## 红队对抗

- 状态：completed · 挑战：16（upheld blocker 0 / major 2 / minor 13）
- 独立子 agent 三类攻击+变异测试全执行：14/14 证据 digest 抽查一致；自然周边界 5 个极端时刻独立复算正确；变异A（阈值 -0.05→-1.5）致 aggregates 测试红、变异B（row-count+1）致导出双测试红，均还原干净；无 upheld blocker；413 生产不可达被独立确认（RT-05）。
- 未覆盖攻击面：并发重复请求下的读一致性（单机 SQLite 读侧，风险低）；移动端 Expo 侧对新端点的消费路径（本轮范围明确不做客户端）

| 挑战 | 目标 | 类型 | 严重度 | 主张 | 结果 |
|------|------|------|--------|------|------|
| RT-01 | AC-15 | probing | minor | 14/14 证据 sha256 全量复算与清单一致，内容与判定 excerpt 吻合（超 ≥3 条抽查要求） | upheld：P4 可回放性确认 |
| RT-02 | AC-02 | scope | minor | 冻结签认真实且时序成立：89fcf19（07:15:49，FROZEN-SIGNED+SIGNED 四点裁决）先于红测与实现 | upheld |
| RT-03 | AC-03 | falsification | minor | 红相为 suite 级模块导入失败（Tests: no tests），从未执行任何断言，对断言正确性零证明力 | upheld：事实成立；但接口层红测（对尚不存在模块先写契约测试）正是任务要求的『先出接口层红测』标准形态，且中间态日志（EV-06，4/11 断言级失败）补足了断言有效性证据，AC-03 谓词维持 pass |
| RT-04 | AC-03 | scope | minor | 实现提交 7bcf1b3 改写红测 3 处断言（averageScore direction 'UP'→'DOWN'、overallCompleteness→completeness、failedPeriodIndexes [1]→[0]），主张 AC-03 降级 partial | overturned：仲裁驳回降级：三处修正均为向冻结契约收敛（红测原文 direction:'UP' 与 REQUIREMENTS L22 rate=-2→DOWN 矛盾，系红测预期笔误），无断言放宽，AC-03 谓词维持；改写事实与『红相未对照契约校验』过程瑕疵记入修改意见 |
| RT-05 | AC-13 | falsification | major | 413 缺口确认：loadSource 三查询 take:1000 使 length>1000 生产恒假，CSV_EXPORT_TOO_LARGE 仅注入可触发，冻结契约超限条款生产不可执行 | upheld：独立确认核验者发现，支撑 AC-13 partial 判定 |
| RT-06 | AC-05 | falsification | minor | 趋势阈值 ±0.05 边界实现与冻结契约逐字符一致 | upheld |
| RT-07 | AC-07 | falsification | minor | 自然周边界数学在周日23:59/周一00:00 CST、周六23:59/周日00:00、跨年 16:00Z 等极端时刻独立复算全部正确 | upheld |
| RT-08 | AC-06 | falsification | minor | 未测分叉：全部周期源失败（failedPeriodIndexes=[0,1]）得 204+degraded=true 落入契约未定义区；x-report-partial 绑定 degraded 致数据性 PARTIAL 报 false；N=3 中间周期缺数据未覆盖 | upheld：未测分叉事实成立记 minor；其中 partial 语义质疑被驳回——契约 L34 partial 定义即『部分（源）失败』，数据性 PARTIAL 报 false 忠于契约 |
| RT-09 | AC-05 | falsification | minor | N=3 中间周期空时整体趋势全 null（严于契约 L23 宽松读法）；rate 公式 previous<0 时方向语义反转（averageScore -1→+1 改善报 DOWN） | upheld：事实成立；前者已在 AC-13 记 minor，后者系冻结公式（裁决1）的数学必然，测试复算 rate=-2→DOWN 已签认，列产品知悉项不动判定 |
| RT-10 | AC-11 | falsification | minor | 精确正则 \.(skip\|only\|todo)\( 全仓 0 命中，死测试余量 0 成立；RECHECK 如实记录 xit( 误报 | upheld |
| RT-11 | AC-01 | scope | minor | chat.routes.test.ts 为 +3 行（含注释）非两行，纯时钟冻结未删改 v0.8 断言；useRealTimers 置于用例尾部有中途失败泄漏 fake timers 的卫生隐患 | upheld：行数细节已修正表述；卫生项记 nit |
| RT-12 | AC-14 | scope | minor | 六笔提交无 schema/迁移/移动端/既有契约改动；共享文件改动均为增量；smoke.sh 01-45 旧段逐行未动 | upheld |
| RT-13 | AC-14 | scope | minor | 无 header 注入/路径遍历/鉴权绕过，响应头全部静态串或服务端派生值；次级：parsePeriods 先于 authenticate（未登录非法参数得 400 非 401）、401/404 路径无测试 | upheld：安全主结论通过；校验顺序与测试缺口记 minor |
| RT-14 | AC-08 | falsification | minor | RFC4180 契约强制字符（逗号/双引号/CR/LF）转义覆盖，CRLF+BOM 合规；CR-only/纯引号单元格未单独断言 | upheld |
| RT-15 | AC-03 | falsification | major | 变异测试：阈值 -0.05→-1.5 致 aggregates 测试红（direction DOWN→STABLE）；row-count+1 致导出双测试红（'10'→'11'、'5'→'6'）；均还原且工作区干净 | upheld：红绿真实性最终坐实（mutation-test-for-redgreen-proof 达成） |
| RT-16 | AC-06 | probing | minor | 第二档空态测试（distinguishes one empty period...）诞生于 QA 提交 a37dbae，从未经历红相，REVIEW.md DoD 表『具名红绿测试』表述失实 | upheld：事实成立（QA-ACCEPTANCE 自身已诚实披露补强来源）；但 DoD-3 谓词仅要求两档空态断言精确存在，另一空态测试（machine-readable no-file signal）有红相记录，AC-06 判定维持，REVIEW 表述失实记 minor |

## 风险与遗留

- AC-13 仅部分达成：周界数学（周一回退 (weekday+6)%7、UTC+8 偏移、左闭右开）、趋势阈值（>=0.05 UP / <=-0.05 DOWN 含边界）、完整度三态、补空不缩数组、RFC 4180 转义+ Trident BOM、204 空态、降级信封逐条核对符合冻结契约（EV-10, EV-11）；但导出端点超限保护生产不可达：loadSource 以 take:1000 拉取 moodRows 使 length 恒 ≤1000，后续判定 length > CSV_EXPORT_ROW_LIMIT(=1000) 恒 false（EV-11），生产中超限源数据被静默截断而非按契约 §3 返回 413 CSV_EXPORT_TOO_LARGE，违反「超大数据拒绝＋上限提示」；413 分支仅可被 vi.mock prisma 返回 1001 行的测试触达（EV-09 rejects oversized source data），属替代实现只覆盖部分场景；次要：整体趋势采用「任一周期空→全维度 null」保守口径，与 REQUIREMENTS §2「基于首个与最后一个可复算端点」文本存在解释偏差（实现注释已声明但冻结文档未同步）
- RT-01（minor upheld）：14/14 证据 sha256 全量复算与清单一致，内容与判定 excerpt 吻合（超 ≥3 条抽查要求）
- RT-02（minor upheld）：冻结签认真实且时序成立：89fcf19（07:15:49，FROZEN-SIGNED+SIGNED 四点裁决）先于红测与实现
- RT-03（minor upheld）：红相为 suite 级模块导入失败（Tests: no tests），从未执行任何断言，对断言正确性零证明力
- RT-06（minor upheld）：趋势阈值 ±0.05 边界实现与冻结契约逐字符一致
- RT-07（minor upheld）：自然周边界数学在周日23:59/周一00:00 CST、周六23:59/周日00:00、跨年 16:00Z 等极端时刻独立复算全部正确
- RT-08（minor upheld）：未测分叉：全部周期源失败（failedPeriodIndexes=[0,1]）得 204+degraded=true 落入契约未定义区；x-report-partial 绑定 degraded 致数据性 PARTIAL 报 false；N=3 中间周期缺数据未覆盖
- RT-09（minor upheld）：N=3 中间周期空时整体趋势全 null（严于契约 L23 宽松读法）；rate 公式 previous<0 时方向语义反转（averageScore -1→+1 改善报 DOWN）
- RT-10（minor upheld）：精确正则 \.(skip|only|todo)\( 全仓 0 命中，死测试余量 0 成立；RECHECK 如实记录 xit( 误报
- RT-11（minor upheld）：chat.routes.test.ts 为 +3 行（含注释）非两行，纯时钟冻结未删改 v0.8 断言；useRealTimers 置于用例尾部有中途失败泄漏 fake timers 的卫生隐患
- RT-12（minor upheld）：六笔提交无 schema/迁移/移动端/既有契约改动；共享文件改动均为增量；smoke.sh 01-45 旧段逐行未动
- RT-13（minor upheld）：无 header 注入/路径遍历/鉴权绕过，响应头全部静态串或服务端派生值；次级：parsePeriods 先于 authenticate（未登录非法参数得 400 非 401）、401/404 路径无测试
- RT-14（minor upheld）：RFC4180 契约强制字符（逗号/双引号/CR/LF）转义覆盖，CRLF+BOM 合规；CR-only/纯引号单元格未单独断言
- RT-16（minor upheld）：第二档空态测试（distinguishes one empty period...）诞生于 QA 提交 a37dbae，从未经历红相，REVIEW.md DoD 表『具名红绿测试』表述失实

## 证据清单

| ID | 类型 | 可靠性 | 状态 | 摘要 | 链接 |
|----|------|--------|------|------|------|
| EV-01 | log | direct | ok | Exported: dist-web …（npm run build 本机复跑） | [docs/v0.9/evidence/audit-build.log](docs/v0.9/evidence/audit-build.log) |
| EV-02 | log | direct | ok | Test Files 18 passed (18) / Tests 95 passed (95)；mobile 5 files / 33 tests（npm test 本机复跑 exit 0） | [docs/v0.9/evidence/audit-test.log](docs/v0.9/evidence/audit-test.log) |
| EV-03 | log | direct | ok | ✅ 心伴 v0.9 冒烟通过：46 项 / 46 项（npm run smoke 本机复跑 exit 0） | [docs/v0.9/evidence/audit-smoke.log](docs/v0.9/evidence/audit-smoke.log) |
| EV-04 | log | direct | ok | ✅ 心伴 v0.3 持久性硬门槛通过：9 项，exit=0（npm run persist:check 本机复跑） | [docs/v0.9/evidence/audit-persist.log](docs/v0.9/evidence/audit-persist.log) |
| EV-05 | log | direct | ok | FAIL … Error: Cannot find module '.../moodComparison.js' … Tests no tests；node3-red-comparison-exit.txt=1（红测先于实现） | [docs/v0.9/evidence/node3-red-comparison.log](docs/v0.9/evidence/node3-red-comparison.log) |
| EV-06 | log | direct | ok | 11 tests \| 4 failed：aggregates/pads/escapes/partial-CSV 在实现不完整时断言级失败（07:20:12），exit=1 | [docs/v0.9/evidence/node3-green-comparison-first.log](docs/v0.9/evidence/node3-green-comparison-first.log) |
| EV-07 | log | direct | ok | Test Files 1 passed (1) / Tests 12 passed (12)，exit=0（07:23:45） | [docs/v0.9/evidence/node3-green-comparison-final.log](docs/v0.9/evidence/node3-green-comparison-final.log) |
| EV-08 | log | direct | ok | Test Files 1 passed (1) / Tests 13 passed (13)，exit=0（QA 补强后锚点 13/13） | [docs/v0.9/evidence/node4-dod-anchor-tests.log](docs/v0.9/evidence/node4-dod-anchor-tests.log) |
| EV-09 | git_commit | direct | ok | 13 条锚点测试：N=4 拒绝/双周期值级+趋势/补空/单空vs整体/跨年周界/导出三验+元信息/转义/三条降级/413 注入路径 | [apps/server/src/routes/moodComparison.routes.test.ts@HEAD](apps/server/src/routes/moodComparison.routes.test.ts@HEAD) |
| EV-10 | git_commit | direct | ok | naturalWeekBounds 周一回退 (weekday+6)%7、UTC+8 偏移；relativeTrend ±0.05；completenessFor 三态；bounds 固定长度补空 | [apps/server/src/lib/moodPeriodComparison.ts@HEAD](apps/server/src/lib/moodPeriodComparison.ts@HEAD) |
| EV-11 | git_commit | direct | ok | parsePeriods 1-3 校验；loadSourceWithRetry attempt≤2；exportMode 超限判定 moodRows.length > 1000（配合 loadSource take:1000 生产不可达）；204 空态与降级信封 | [apps/server/src/routes/moodComparison.ts@HEAD](apps/server/src/routes/moodComparison.ts@HEAD) |
| EV-12 | doc_link | indirect | ok | FROZEN-SIGNED：§2 对比端点契约（N=3/周一/UTC+8/五维度/完整度/趋势/降级）§3 CSV 契约（UTF-8 BOM/固定列/元信息头/204/413 limit=1000/重试降级）§4 冻结边界 §5 停车场 | [docs/v0.9/REQUIREMENTS.md](docs/v0.9/REQUIREMENTS.md) |
| EV-13 | log | direct | ok | 改动仅限 server lib/routes/localServer、chat.routes.test.ts、smoke 文档与脚本，无 schema/移动端 | [docs/v0.9/evidence/node4-changed-paths.txt](docs/v0.9/evidence/node4-changed-paths.txt) |
| EV-14 | log | direct | ok | 0（git diff e625075..HEAD -- '*schema.prisma*' \| wc -l 本机复跑输出） | [docs/v0.9/evidence/audit-schema-diff-count.txt](docs/v0.9/evidence/audit-schema-diff-count.txt) |
| EV-15 | log | direct | ok | 89fcf19 07:15:49 冻结 → 6386924 07:17:39 红测 → 7bcf1b3 07:24:46 实现（git log --reverse） | [docs/v0.9/evidence/audit-commit-order.txt](docs/v0.9/evidence/audit-commit-order.txt) |
| EV-16 | log | direct | ok | deploy_replay_exit=0 / post_deploy_smoke_exit=0 / post_deploy_persist_exit=0 / schema_diff_lines=0 / dead_test_count=0 | [docs/v0.9/evidence/node5-final-gates.txt](docs/v0.9/evidence/node5-final-gates.txt) |
| EV-17 | git_commit | direct | ok | 89fcf19 中 chat.routes.test.ts 仅 + vi.useFakeTimers({ now: '2026-10-07T02:00:00.000Z' }) 与 + vi.useRealTimers()，无断言改动 | [docs/v0.9/evidence/audit-chat-test-fix.diff](docs/v0.9/evidence/audit-chat-test-fix.diff) |
| EV-18 | git_commit | indirect | ok | readableMemories 过滤 ACTIVE 且内容非空；readableMoodTimeline 按 moodSnapshotId 建 latest Map 实现 latest-wins 修正 | [apps/server/src/lib/conversationInsights.ts@HEAD](apps/server/src/lib/conversationInsights.ts@HEAD) |
| EV-19 | git_commit | direct | ok | 46 步探针：curl 导出 CSV，断言 status=200、row-count=5、BOM/表头/5 行 4 列/维度顺序、ISO 生成时间、content-type | [scripts/smoke.sh@HEAD 第 422-452 行](scripts/smoke.sh@HEAD 第 422-452 行) |

> 回写：pending → commit_status@docs/v0.9/VERIFICATION.json@HEAD · schemaVersion 1.0 · criteriaHash sha256:5f4e5f607975bdc22a2ace77b2bc1011d0748e214a5e7c9da7ffd913b6dc605f