# 验证报告：心伴 v0.3「核心交互价值闭环」增量交付质量验收

- 报告 ID：vrf_xinbanv03qualityrevie · 结论：**NEEDS_WORK**
- 验证对象：requirement:xinban-v0.3-core-loop（docs/v0.3/DEVELOPMENT.md）
- 触发：T3 显式调用 · 触发者：workflow-node:quality-review · 完成：2026-10-03T23:59:00.334Z · 耗时：3120000ms
- 完成度：73/100（pass 3/6 · partial 3 · fail 0 · unverified 0）

## 结论依据

- RULE_PARTIAL_PRESENT: AC-01,AC-02,AC-04
- RULE_REDTEAM_MAJOR_UPHELD: RT-01,RT-02,RT-03,RT-04

四条阻塞级判定全部未触发、六条 DoD 最低口径全部达成且四门禁 exit 0；但 3 条判定因红队 major upheld 降为 partial（测试锚点强度缺口 + 记忆注入安全位置），按认证口径 NEEDS_WORK，修改意见清单独立留档。

## 逐条判定

| 标准 | 判定 | 权重 | 依据摘要 | 证据 |
|------|------|------|---------|------|
| AC-01 【core】V3-1 P0 会话记忆展示利用：空态 available=true/items=[]；写后返回原文规范化内容；degraded=true 时不返回内容；prompt 包含记忆 | partial（被 RT-02 降级） | 3 | 展示半边全锚定：smoke 14/18 断言重启后记忆含原文与空态 available=true/items=[]（EV-03），chat.routes.test.ts 空态/降级态行为测试全绿（EV-02/EV-10），mobile memoryViewState 隐藏 QUARANTINED 与空行（insights.test.ts）。但「利用」半边（prompt 注入记忆）在 chatEngine.ts/characters.ts 已实现却零测试锚点：characters.test.ts 无任何 memoryPoints 断言（EV-11），红队 RT-02 upheld 后按仲裁规则降级。 | [EV-02](docs/v0.3/evidence/gate-test.log) [EV-03](docs/v0.3/evidence/gate-smoke.log) [EV-10](docs/v0.3/evidence/anchor-tests.txt) [EV-11](docs/v0.3/evidence/redteam-verification.txt) |
| AC-02 【core】V3-2 P1 情绪轨迹读视图：从 memoryId 派生结构化 mood/score/keywords；读接口按内容断言；降级态为空 | partial（被 RT-04 降级） | 3 | 读视图链路全绿：smoke 16/17/19（EV-03）、chat.routes mood 空态/降级态（EV-02）、mobile moodViewState 内容断言（EV-10）、persist P04/P08 重启读回（EV-04）。但内容派生的可判定口径弱锚定：serializeMood 测试期望值由序列化器自身输出 spread 派生，mood/score 两维即使实现恒返 NEUTRAL/0 仍会通过（EV-11）；classifyMood 全仓零直接单测、NEGATIVE 分支无任何断言（EV-11）。红队 RT-04 upheld 后降级。 | [EV-02](docs/v0.3/evidence/gate-test.log) [EV-03](docs/v0.3/evidence/gate-smoke.log) [EV-04](docs/v0.3/evidence/gate-persist.log) [EV-10](docs/v0.3/evidence/anchor-tests.txt) [EV-11](docs/v0.3/evidence/redteam-verification.txt) |
| AC-03 【core】V3-3 新增数据跨重启持久：npm run persist:check exit 0，含 P02 写、P05 kill、P06 重启、P07/P08 读回一致 | pass | 3 | 验收侧独立复跑 npm run persist:check exit 0（EV-01/EV-04）：P02 写入用户消息/P0 记忆/P1 快照、P05 kill、P06 同一 SQLite 重启、P07/P08 重启后读回 id 与内容一致、P04 断言 mood 快照基于 P0 memoryId 派生。红队 kill-tree 攻击经其实测被推翻（npm 单命令 exec 使 tsx 为直接子进程，pgrep -P 可达，残留进程反而 EADDRINUSE fail-loud），且验收侧确认 13888/13889 端口无残留进程。 | [EV-01](docs/v0.3/evidence/gate-results.log) [EV-04](docs/v0.3/evidence/gate-persist.log) |
| AC-04 【core】V3-4 写失败降级：writer throw 后返回 available=false/degraded=true/items=[]，无脏数据 | partial（被 RT-01 降级） | 2 | 降级契约本身被充分测试：conversationInsights.test.ts > maps a memory write failure to the degraded read contract 断言 memory=null 且 read=memoryReadDegraded（无脏数据）；chat.routes.test.ts 两个读接口降级态断言 available=false/degraded=true/空列表；persist P09 将该测试纳入脚本（EV-02/EV-04/EV-10）。但 P09 实为 vitest -t 单测复跑而非进程级写失败注入，chatSend 写失败分支无任何路由级覆盖（EV-11），「硬门槛」对写路径的进程级证明力弱于文案所述。红队 RT-01 upheld 后降级。 | [EV-02](docs/v0.3/evidence/gate-test.log) [EV-04](docs/v0.3/evidence/gate-persist.log) [EV-10](docs/v0.3/evidence/anchor-tests.txt) [EV-11](docs/v0.3/evidence/redteam-verification.txt) |
| AC-05 【core】V3-5 v0.3 冒烟全局项：01-13 基线全绿且 14-19 增量全绿，exit 0；冒烟文档基线/增量/deploy 三段式 | pass | 2 | 验收侧独立复跑 npm run smoke exit 0，19/19 全绿（EV-01/EV-03），最后一行与文档成功判据逐字一致；docs/smoke/v0.3.md 具备基线段(01-13)/增量段(14-19)/Deploy 段三段式（EV-06），增量段每步有断言内容与锚点，18/19 步锚点指认到真实路由行为测试名（EV-10）；88e6e52 修复 grep -F 固定串解析（[] 不再被 BRE bracket 吞掉）。Deploy 段记录了本地五门重跑退出码均为 0（EV-06）。 | [EV-01](docs/v0.3/evidence/gate-results.log) [EV-03](docs/v0.3/evidence/gate-smoke.log) [EV-06](docs/smoke/v0.3.md) [EV-10](docs/v0.3/evidence/anchor-tests.txt) |
| AC-06 V3-6 v0.2 死测试处置：基线 0 个 → 修 0 / 删 0 / 缓 0，全仓无死测试标记，计数栏可核 | pass | 2 | 处置栏存在且计数可核：v0.2-base.md「基线死测试计数：0 个 → 修 0 / 删 0 / 缓 0」并归类扫描口径（EV-07）；验收侧用更宽口径（skip/only/todo/xit/xdescribe/skipIf/空测试体）全仓重扫确认 0 个真实死测试标记，断言密度每文件 ≥1（EV-09）。改进项（不计入本条判定）：现口径无法发现「永不失败」弱断言，本轮确有一处部分循环断言（EV-11，已在 AC-02 计入），建议下轮将断言密度/循环断言检测纳入处置口径。 | [EV-07](docs/smoke/v0.2-base.md) [EV-09](docs/v0.3/evidence/dead-test-scan.txt) [EV-11](docs/v0.3/evidence/redteam-verification.txt) |

## 红队对抗

- 状态：completed · 挑战：10（upheld blocker 0 / major 4 / minor 4）
- 独立子代理红队 3 类攻击：6 条 pass 全部尝试反证 + 证据抽查 + git diff 范围攻击；0 blocker、4 major upheld（经核验侧复核实证成立）、10 challenge 中 2 条被仲裁推翻；未发现删测试/放宽既有断言/越权/SQL 注入面。
- 未覆盖攻击面：进程级写失败注入下的端到端降级行为（当前仅单测级证明）；真实 LLM provider 下记忆注入对合规声明的位置关系（当前 LLM_PROVIDER=mock 未触发）

| 挑战 | 目标 | 类型 | 严重度 | 主张 | 结果 |
|------|------|------|--------|------|------|
| RT-01 | AC-04 | falsification | major | persist P09 硬门槛只是 npx vitest -t 复跑纯函数单测，无进程级写失败注入；chatSend 写失败分支全仓零路由级覆盖 | upheld：核验侧复核 scripts/persistence-regression.sh L137-139 确为 vitest -t；chat.routes.test.ts 仅覆盖两个 GET handler，指控属实，AC-04 降 partial |
| RT-02 | AC-01 | probing | major | buildSystemPrompt 新增 memoryPoints 注入零测试覆盖，V3-1「prompt 包含记忆」半边无任何锚点 | upheld：grep 证实 characters.test.ts 中 memoryPoints 命中 0，chatEngine 记忆查询亦无测试，AC-01 降 partial |
| RT-03 | AC-01 | scope | major | 记忆内容原样注入 system prompt 且排在合规声明之后、无指令样文本清洗；QUARANTINED 全仓无写入方，「脏数据不展示」控制路径端到端不可达 | upheld：位置关系与 QUARANTINED 无写入方均属实；缓解因素（内容过滤/160 字规范化/用户自会话作用域/LLM_PROVIDER=mock）使其定级 major 而非 blocker，列为下轮必修安全项 |
| RT-04 | AC-02 | falsification | major | serializeMood 测试期望值由序列化器自身输出派生，mood/score 断言永不失败；classifyMood 零单测、NEGATIVE 无断言 | upheld：核验侧读取测试源码确认 {...point} 循环构造与 classifyMood 零测试命中，属实，AC-02 降 partial |
| RT-05 | AC-02 | falsification | minor | smoke 步骤 17 grep -F '"score":0' 同样匹配 "score":0.8，无法区分 0 与非 0 | overturned：score 在 Prisma schema 中为 Int 且契约域为 -1\|0\|1，0.8 属域外不可达值；在真实值域内固定串断言可正确区分 0 与 ±1 |
| RT-06 | AC-03 | probing | minor | persistence-regression.sh assert_contains 仍为 BRE grep -q，smoke.sh 已修 -F 而 persist 未同步，存在假绿隐患 | upheld：L29 确为 grep -q；当前 needle 恰好无正则元字符风险，记改进项不改判 |
| RT-07 | AC-05 | probing | minor | deploy 段表格「重跑退出码」为本地部署等价门实测，与「部署后回填待完成」并存，易被误读为已在部署环境复跑 | upheld：属实；不构成阻塞级③（重跑退出码已记录），但 deploy 闭环留档必须在部署后回填真实退出码 |
| RT-08 | AC-03 | falsification | minor | P05 kill 只杀 npm 父进程，tsx 孙进程可能存活导致 P06 复用旧进程、读回为假绿 | overturned：红队自证：npm 单命令经 sh -c exec 使 tsx 为直接子进程，pgrep -P 可达；且端口占用会 EADDRINUSE fail-loud 而非假绿；验收侧另确认无残留进程 |
| RT-09 | AC-01 | probing | minor | smoke 步骤 15 仅断 degraded:false，未断 available:true 与 items 非空 | upheld：属实；步骤 14 原文断言与步骤 18 全信封断言部分弥补，记改进项不改判 |
| RT-10 | AC-01 | falsification | minor | chat.routes.test.ts 将 conversation.findFirst mock 成恒命中，越权 404 分支（where id+userId）未被断言，回归删除 userId 过滤测试仍全绿 | upheld：属实；当前实现含 userId 过滤（人工核对），记改进项不改判 |

## 风险与遗留

- AC-01 仅部分达成：展示半边全锚定：smoke 14/18 断言重启后记忆含原文与空态 available=true/items=[]（EV-03），chat.routes.test.ts 空态/降级态行为测试全绿（EV-02/EV-10），mobile memoryViewState 隐藏 QUARANTINED 与空行（insights.test.ts）。但「利用」半边（prompt 注入记忆）在 chatEngine.ts/characters.ts 已实现却零测试锚点：characters.test.ts 无任何 memoryPoints 断言（EV-11），红队 RT-02 upheld 后按仲裁规则降级。
- AC-02 仅部分达成：读视图链路全绿：smoke 16/17/19（EV-03）、chat.routes mood 空态/降级态（EV-02）、mobile moodViewState 内容断言（EV-10）、persist P04/P08 重启读回（EV-04）。但内容派生的可判定口径弱锚定：serializeMood 测试期望值由序列化器自身输出 spread 派生，mood/score 两维即使实现恒返 NEUTRAL/0 仍会通过（EV-11）；classifyMood 全仓零直接单测、NEGATIVE 分支无任何断言（EV-11）。红队 RT-04 upheld 后降级。
- AC-04 仅部分达成：降级契约本身被充分测试：conversationInsights.test.ts > maps a memory write failure to the degraded read contract 断言 memory=null 且 read=memoryReadDegraded（无脏数据）；chat.routes.test.ts 两个读接口降级态断言 available=false/degraded=true/空列表；persist P09 将该测试纳入脚本（EV-02/EV-04/EV-10）。但 P09 实为 vitest -t 单测复跑而非进程级写失败注入，chatSend 写失败分支无任何路由级覆盖（EV-11），「硬门槛」对写路径的进程级证明力弱于文案所述。红队 RT-01 upheld 后降级。
- RT-06（minor upheld）：persistence-regression.sh assert_contains 仍为 BRE grep -q，smoke.sh 已修 -F 而 persist 未同步，存在假绿隐患
- RT-07（minor upheld）：deploy 段表格「重跑退出码」为本地部署等价门实测，与「部署后回填待完成」并存，易被误读为已在部署环境复跑
- RT-09（minor upheld）：smoke 步骤 15 仅断 degraded:false，未断 available:true 与 items 非空
- RT-10（minor upheld）：chat.routes.test.ts 将 conversation.findFirst mock 成恒命中，越权 404 分支（where id+userId）未被断言，回归删除 userId 过滤测试仍全绿

## 证据清单

| ID | 类型 | 可靠性 | 状态 | 摘要 | 链接 |
|----|------|--------|------|------|------|
| EV-01 | log | direct | ok | BUILD_EXIT=0 / TEST_EXIT=0 / SMOKE_EXIT=0 / PERSIST_EXIT=0（验收侧独立复跑四门禁） | [docs/v0.3/evidence/gate-results.log](docs/v0.3/evidence/gate-results.log) |
| EV-02 | test_run | direct | ok | server Test Files 7 passed(7) Tests 32 passed(32)；mobile 3 passed(3) Tests 26 passed(26) | [docs/v0.3/evidence/gate-test.log](docs/v0.3/evidence/gate-test.log) |
| EV-03 | test_run | direct | ok | 01-19 全绿，最后一行：心伴 v0.3 冒烟通过：19 项 / 19 项 | [docs/v0.3/evidence/gate-smoke.log](docs/v0.3/evidence/gate-smoke.log) |
| EV-04 | test_run | direct | ok | P01-P09 全绿：写→kill→重启→读回一致→写失败降级，9 项 exit=0 | [docs/v0.3/evidence/gate-persist.log](docs/v0.3/evidence/gate-persist.log) |
| EV-05 | doc_link | indirect | ok | 冻结 DoD 六条全部 [x]，契约测试绑定表逐接口锚定测试名 | [docs/v0.3/DEVELOPMENT.md](docs/v0.3/DEVELOPMENT.md) |
| EV-06 | doc_link | indirect | ok | 基线段(01-13)/增量段(14-19)/Deploy 段三段式；deploy 表格记录五门重跑退出码均为 0 | [docs/smoke/v0.3.md](docs/smoke/v0.3.md) |
| EV-07 | doc_link | indirect | ok | 基线确认：三命令一致；死测试处置栏：基线 0 个 → 修 0 / 删 0 / 缓 0 | [docs/smoke/v0.2-base.md](docs/smoke/v0.2-base.md) |
| EV-08 | git_commit | direct | ok | 7 个交付提交，逐条标注验收项 V3-x 与锚点，无删测试 | [git:62b909b..HEAD](git:62b909b..HEAD) |
| EV-09 | log | direct | ok | skip/only/todo/xit/xdescribe/skipIf 全仓 0 命中；锚点测试文件 it() 计数正常 | [docs/v0.3/evidence/dead-test-scan.txt](docs/v0.3/evidence/dead-test-scan.txt) |
| EV-10 | log | direct | ok | DoD 锚点指认的 10 个测试名全部在源码中真实存在 | [docs/v0.3/evidence/anchor-tests.txt](docs/v0.3/evidence/anchor-tests.txt) |
| EV-11 | log | direct | ok | P09 为 vitest -t 单测复跑；characters.test.ts memoryPoints 命中 0；classifyMood 单测 0 处 | [docs/v0.3/evidence/redteam-verification.txt](docs/v0.3/evidence/redteam-verification.txt) |

> 回写：pending → requirement_verification_result@docs/v0.3/REVIEW.md、notification@workflow-node:delivery · schemaVersion 1.0 · criteriaHash sha256:70df656f81e0aaea227523adbf670e2b57e8ef2e3253ee0391359fdb5a296bb3