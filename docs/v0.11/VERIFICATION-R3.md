# 验证报告：心伴 v0.11 P0 情绪洞察跨周期对比（insight 多周期）五节点交付 R3 独立验证

- 报告 ID：vrf_v011p0r320261014 · 结论：**CERTIFIED**
- 验证对象：requirement:v0.11-p0-insight（docs/v0.11/REQUIREMENTS.md）
- 触发：T3 显式调用 · 触发者：agent:code-reviewer · 完成：2026-10-14T08:20:00+08:00 · 耗时：1800000ms
- 完成度：100/100（pass 14/14 · partial 0 · fail 0 · unverified 0）

## 结论依据

- RULE_ALL_PASS: 14/14 criteria pass (passed=14, partial=0, failed=0, unverified=0)
- RULE_REDTEAM_CLEAN: upheld blocker=0 major=0 (upheld minor=3: 幽灵属性断言/死分支/执行卫生, 均不改判)
- RULE_NO_FABRICATION: 证据抽查 6 份独立复核一致，变异测试两发两中证明测试非恒真

v0.11 五节点交付（基线复核→范围冻结→增量实现→质量验收→deploy 冒烟闭环）经 R3 不采信式独立复核全部成立：8 项门禁亲测复跑全绿（build/test 140+49/smoke 54×2/persist 9/9/deploy 0,0,0），14 条 DoD 三点一线核验通过，红队四类攻击（反证/证据抽查/范围/变异）全部防住。3 条 minor 观察项与 3 条改进建议见报告，不阻塞交付。

## 逐条判定

| 标准 | 判定 | 权重 | 依据摘要 | 证据 |
|------|------|------|---------|------|
| AC-01 【core】节点1: 基线 build/start/test 三证据 AND 复跑全绿，四要素（命令/锚点/时间戳/SHA）留痕 | pass | 2 | R3 亲测复跑：BUILD_EXIT=0 且 Exported: dist-web（EV-01）；自有进程 /health status=up mode=standalone（EV-03）；server 140+mobile 49 全过 TEST_EXIT=0（EV-02）。注意：首次 /health 证据曾打到上游 R2 残留进程（PID 34952 未被 kill，占 3888），R3 已杀残留并在自有进程上重做全部 3888 证据（EV-03/EV-15） | [EV-01](docs/v0.11/evidence/r3-verification/v011-review-build.log) [EV-02](docs/v0.11/evidence/r3-verification/v011-review-test.log) [EV-03](docs/v0.11/evidence/r3-verification/start.log) |
| AC-02 【core】节点1: v0.10 基线证据固化存档且 SHA-256 完整一致 | pass | 1 | R3 逐一重算 docs/v0.11/evidence/v010-frozen-baseline/ 7 个文件 SHA-256，与 MANIFEST.txt 记录 7/7 一致（EV-08），存档未被篡改 | [EV-08](docs/v0.11/evidence/v010-frozen-baseline/MANIFEST.txt) |
| AC-03 【core】节点1: insight 前端触达二值结论 + 代码/构建产物锚点 | pass | 1 | 二值结论=可触达。代码锚点 ChatScreen.tsx:193 调用/:527 挂载实测存在；构建产物锚点 bundle 内 127.0.0.1:3888、insight/comparison、MoodPeriodInsightPanel、两条用户可见文案全部命中，EXPO_PUBLIC_API_URL 编译期内联零残留=非 mock 模式（EV-13）。按冻结范围 mobile 本期不挂跨周期 UI（契约§5），判定不因此降级 | [EV-13](apps/mobile/dist-web/_expo/static/js/web/index-94432e93246c67708c8c76818511442b.js) |
| AC-04 【core】节点1: 对照 docs/smoke/v0.10.md 漂移清单，阻塞级漂移为零 | pass | 1 | e2e 基线逐行比对：v0.10 冻结 gate-smoke 01-45 与 v0.11 实跑逐字一致；第 46 位 additive 插入，原 46-51 名称逐一顺移至 47-52（diff 差异仅为步骤编号数字）；总数 51+1+2=54 对账吻合（EV-14）。唯一记述级漂移（v0.10.md 写 51/51 vs 实际 52/54）上游已按约定不改冻结文档并在 BASELINE/R2 记录，非阻塞 | [EV-14](docs/v0.11/evidence/r3-verification/e2e-baseline-diff.txt) [EV-04](docs/v0.11/evidence/r3-verification/v011-review-smoke.log) |
| AC-05 【core】节点2: 新增只读端点，复用 v0.9 对比管道（N=3/ISO周一/UTC+8/±5%）与 v0.10 生成器只读拼装，不改造既有端点 | pass | 2 | diff 审查：moodPeriodComparison.ts 仅 additive 包装 comparisonRelativeTrend→既有 relativeTrend（同一 ±5% 函数同源复用）；moodPeriodInsight.ts 仅 correctedSamplesInPeriod 加 export；period.ts 新 handler+一行注册，既有 3 个 handler 零改动；route 测试断言既有 route id 不变（EV-09, EV-11） | [EV-09](docs/v0.11/evidence/r3-verification/diff-stat.txt) [EV-11](apps/server/src/routes/periodInsightComparison.routes.test.ts) |
| AC-06 【core】节点2: 洞察 3 类封顶，只扩周期维度 direction/rate/fromPeriodId/toPeriodId，无第 4 类 | pass | 2 | server PERIOD_INSIGHT_TYPES 长度3+集合相等断言；mobile 第4类 NEW_INSIGHT_TYPE 判红用例；mobile 视图状态机运行时 INSIGHT_TYPES 白名单校验（EV-10, EV-12）。周期维度以 direction/rate/fromPeriodId/toPeriodId 表达，无新 type | [EV-10](apps/server/src/lib/moodPeriodInsightComparison.test.ts) [EV-12](apps/mobile/src/utils/moodPeriodInsightComparison.test.ts) |
| AC-07 【core】节点2: 三列断言表覆盖五态（目标空/任一空/全空/聚合失败/超限非法参）+ periodId 404 约定，落地为值级测试与冒烟 | pass | 2 | 五态+404 全部落地值级断言：①目标空②中间空③全空④SOURCE_DEGRADED 全等断言（lib test L192-253）；⑤400 专用码⑥404 专用码（route test L106-116）+smoke 53/54 实测绿（EV-04）。R3 另在自有进程实跑补验 N=1→insights=[]、periods=0→400、非周一→404（EV-15） | [EV-10](apps/server/src/lib/moodPeriodInsightComparison.test.ts) [EV-11](apps/server/src/routes/periodInsightComparison.routes.test.ts) [EV-04](docs/v0.11/evidence/r3-verification/v011-review-smoke.log) [EV-15](live:3888 自有进程 R3 实跑) |
| AC-08 【core】节点2: 评审三查——空标记口径与 v0.9 逐字对齐、降级枚举封闭可机判、错误码唯一且无冲突 | pass | 2 | 三查逐一核实：①空标记=comparisonRelativeTrend 纯包装既有 relativeTrend 同一 ±5%/previous===0→empty 判定（diff 证实同源非平行实现）；②降级/空原因均为字面量联合类型无 string 逃逸（源码 L15-16）；③两个新码全仓各仅 1 处使用、v0.9 PERIOD_COUNT_REJECTED 未被挪用（grep 证实）（EV-09, EV-10） | [EV-09](docs/v0.11/evidence/r3-verification/diff-stat.txt) [EV-10](apps/server/src/lib/moodPeriodInsightComparison.test.ts) |
| AC-09 【core】节点2/3: 零新采集、零写侧、零 schema 变更 | pass | 2 | schema.prisma diff=0 行；新库 grep prisma/写操作/Date.now/Math.random 零命中；全量增量 12 文件 1055+/1-（唯一删除为 export 关键字）；route 层只读 scopedUserPeriodInput，catch 仅降级不写库（EV-09） | [EV-09](docs/v0.11/evidence/r3-verification/diff-stat.txt) |
| AC-10 【core】节点3: 测试锚点为具体内容值级断言（方向/百分比/周期对/中文文案），空态矩阵每态至少一条；『返回200/字段存在』不计 | pass | 2 | golden 断言含 rate=1、fromValue 1→2、message『主导情绪记录数上升趋势 +100%。』逐字；route DOWN/rate=-1/『平均分下降趋势 -100%。』逐字；mobile fixture +6.2%；阈值边界 0/+0.05/-0.05 精确锚定——数值经 R3 手工核算与输入数据吻合；空态矩阵①②③④每态均有 status/reason/value 值级断言（EV-10, EV-11, EV-12） | [EV-10](apps/server/src/lib/moodPeriodInsightComparison.test.ts) [EV-11](apps/server/src/routes/periodInsightComparison.routes.test.ts) [EV-12](apps/mobile/src/utils/moodPeriodInsightComparison.test.ts) |
| AC-11 【core】节点4: v0.7/v0.9/v0.10 冻结契约复跑零漂移 | pass | 2 | 三重证明独立复核：①冻结套件计数 v0.9=19/v0.10=25+10 与上轮一致（r2/frozen-*.log）；②e2e 逐行比对 01-45 逐字一致+46 additive+顺移对应（EV-14）；③R3 亲测复跑全量 test 140+49 与 smoke 54/54 全绿（EV-02, EV-04）。v0.10 三条值级断言（现 50-52 步）实测通过 | [EV-14](docs/v0.11/evidence/r3-verification/e2e-baseline-diff.txt) [EV-02](docs/v0.11/evidence/r3-verification/v011-review-test.log) [EV-04](docs/v0.11/evidence/r3-verification/v011-review-smoke.log) |
| AC-12 【core】节点4: 死测试扫描清零 | pass | 1 | R3 独立重扫 skip/only/todo/xit/fit/failing 于 server+mobile 全部测试文件：零命中（exit=1 无匹配） | [EV-02](docs/v0.11/evidence/r3-verification/v011-review-test.log) |
| AC-13 【core】节点5: build/test/smoke/persist 四门禁全绿且四要素留痕 | pass | 2 | R3 亲测五门禁 exit 全 0 并以 digest 固化于 evidence/r3-verification/DIGESTS.txt：build（EV-01）、test 140+49（EV-02）、smoke 54/54（EV-04，独立端口 13888 自管不受残留进程影响）、persist 9/9（EV-05）、start /health（EV-03） | [EV-01](docs/v0.11/evidence/r3-verification/v011-review-build.log) [EV-02](docs/v0.11/evidence/r3-verification/v011-review-test.log) [EV-04](docs/v0.11/evidence/r3-verification/v011-review-smoke.log) [EV-05](docs/v0.11/evidence/r3-verification/v011-review-persist.log) [EV-03](docs/v0.11/evidence/r3-verification/start.log) |
| AC-14 【core】节点5: deploy:v02 闭环（build/start/test=0）+ deploy 后 smoke 54/54 | pass | 2 | deploy:v02 复跑 DEPLOY_EXIT=0 且 build=0/start=0/test=0（EV-06，独立端口 15888 自管生命周期）；deploy 后 smoke 于 07:59:58-08:00:08 实跑 54/54 exit=0（EV-07），时序在 deploy 完成之后，闭环成立 | [EV-06](docs/v0.11/evidence/r3-verification/v011-review-deploy.log) [EV-07](docs/v0.11/evidence/r3-verification/v011-review-postdeploy-smoke.log) |

## 红队对抗

- 状态：completed · 挑战：7（upheld blocker 0 / major 0 / minor 3）
- 独立上下文红队四类攻击全部被防住：反证（golden 逐值核算/空态矩阵非恒真/真实 catch 分支）、证据抽查 6 份（R1/R2 日志为真实独立重放特征，183b202..HEAD 零代码 diff 故 r2 证据对 HEAD 有效）、范围攻击（634 行删除逐文件归因，无测试删除、无断言放宽、smoke 基线 01-52 逐字未动）、变异测试两发两中（rate+0.001→2 failed；阈值 0.05→0.5→1 failed）。无 upheld blocker/major，3 条 upheld minor 不改判。
- 未覆盖攻击面：mobile mock.ts mock 返回结构未做值级攻击（real 模式已经 bundle 级证实非 mock，风险低）；并发/重复请求下聚合一致性未攻击（确定性已由同输入两次调用相等断言部分覆盖）

| 挑战 | 目标 | 类型 | 严重度 | 主张 | 结果 |
|------|------|------|--------|------|------|
| RT-01 | AC-10 | falsification | major | lib golden 值级断言可能非从输入推出（数值 luck 或部分匹配蒙混） | overturned：红队独立核算 A/C 输入→dominant 1/2、均分 0.5/1（浮点精确）、corrected 1/1，与断言一致；toEqual 精确匹配无部分匹配蒙混；窗口左闭右开与周一真实性 node 实证 |
| RT-02 | AC-07 | falsification | major | 空态矩阵断言可能恒真（toMatchObject 掩盖/静默空数组假通过） | overturned：①length>0 封死静默空数组；②value 非 null 即红验证跳空禁止；③数组长度相等语义；④toEqual 全等封死；幽灵属性与 evidence 覆盖缺口记 RT-05 minor |
| RT-03 | AC-13 | probing | blocker | 上游固化证据可能伪造（复制粘贴假输出） | overturned：抽 6 份独立复核：本机复跑计数精确一致（140+49、3/19、2/13）；R1/R2 日志字节级不同且差异为环境噪声（真实重放特征）；时间戳与 mtime 单调一致；r2 门禁 commit=183b202 与 HEAD 间零代码 diff，证据对 HEAD 有效 |
| RT-04 | AC-10 | falsification | blocker | 测试可能恒真（变异后仍全绿） | overturned：变异 A round4(rate+0.001)→2 failed；变异 B rate>=0.05→0.5→1 failed；两发两中，git restore 后 14/14 绿、工作区字节级复原 |
| RT-05 | AC-10 | probing | minor | moodPeriodInsightComparison.test.ts:206 item.toPeriodId 为幽灵属性（恒 undefined，断言退化为仅查 evidence.toPeriodId）；根因 server tsconfig exclude src/**/*.test.ts（基线既有），测试类型错误永久静默 | upheld：断言实际仍有效（evidence.toPeriodId 被查且冒烟 53 补齐 fromSampleSize/fromPeriodId 层），不改判；建议修正幽灵属性并将测试纳入 typecheck |
| RT-06 | AC-07 | probing | minor | moodPeriodInsightComparison.ts METRIC_MISSING 分支不可达（防御性死代码） | upheld：不违反契约（枚举封闭），属交付噪声；建议注释保留意图或移除 |
| RT-07 | AC-01 | scope | minor | 上游 R2 轮 server 进程（07:34 启动）未 kill 残留占用 3888，R3 初版 3888 证据打到残留进程；r2/start.log 被追加 WARN 行 | upheld：R3 已杀残留、还原 r2/start.log，并在自有进程重做全部 3888 证据；行为等价性由 183b202..HEAD 零代码 diff 背书；smoke(13888)/deploy(15888) 证据自始干净。属执行卫生问题非交付缺陷 |

## 风险与遗留

- RT-05（minor upheld）：moodPeriodInsightComparison.test.ts:206 item.toPeriodId 为幽灵属性（恒 undefined，断言退化为仅查 evidence.toPeriodId）；根因 server tsconfig exclude src/**/*.test.ts（基线既有），测试类型错误永久静默
- RT-06（minor upheld）：moodPeriodInsightComparison.ts METRIC_MISSING 分支不可达（防御性死代码）
- RT-07（minor upheld）：上游 R2 轮 server 进程（07:34 启动）未 kill 残留占用 3888，R3 初版 3888 证据打到残留进程；r2/start.log 被追加 WARN 行

## 证据清单

| ID | 类型 | 可靠性 | 状态 | 摘要 | 链接 |
|----|------|--------|------|------|------|
| EV-01 | test_run | direct | ok | Exported: dist-web / BUILD_EXIT=0 | [docs/v0.11/evidence/r3-verification/v011-review-build.log](docs/v0.11/evidence/r3-verification/v011-review-build.log) |
| EV-02 | test_run | direct | ok | server Test Files 24 passed / Tests 140 passed; mobile 8 passed / 49 passed; TEST_EXIT=0 | [docs/v0.11/evidence/r3-verification/v011-review-test.log](docs/v0.11/evidence/r3-verification/v011-review-test.log) |
| EV-03 | log | direct | ok | /health data.status=up mode=standalone (自有进程, 3888) | [docs/v0.11/evidence/r3-verification/start.log](docs/v0.11/evidence/r3-verification/start.log) |
| EV-04 | test_run | direct | ok | 心伴 v0.11 冒烟通过：54 项 / 54 项; SMOKE_EXIT=0（smoke.sh 独立端口 13888 自管生命周期） | [docs/v0.11/evidence/r3-verification/v011-review-smoke.log](docs/v0.11/evidence/r3-verification/v011-review-smoke.log) |
| EV-05 | test_run | direct | ok | 心伴 v0.3 持久性硬门槛通过：9 项，exit=0 | [docs/v0.11/evidence/r3-verification/v011-review-persist.log](docs/v0.11/evidence/r3-verification/v011-review-persist.log) |
| EV-06 | test_run | direct | ok | deploy 复验：build=0 start=0 test=0; DEPLOY_EXIT=0（独立端口 15888 自管） | [docs/v0.11/evidence/r3-verification/v011-review-deploy.log](docs/v0.11/evidence/r3-verification/v011-review-deploy.log) |
| EV-07 | test_run | direct | ok | deploy 后 smoke 54/54, POST_DEPLOY_SMOKE_EXIT=0 (07:59:58-08:00:08) | [docs/v0.11/evidence/r3-verification/v011-review-postdeploy-smoke.log](docs/v0.11/evidence/r3-verification/v011-review-postdeploy-smoke.log) |
| EV-08 | log | direct | ok | R3 逐一重算 7/7 SHA-256 与 MANIFEST 记录一致 | [docs/v0.11/evidence/v010-frozen-baseline/MANIFEST.txt](docs/v0.11/evidence/v010-frozen-baseline/MANIFEST.txt) |
| EV-09 | git_commit | direct | ok | git diff a92cd5e..HEAD --stat: 12 code files 1055+/1-; schema.prisma diff=0 lines (schema-diff-lines.txt) | [docs/v0.11/evidence/r3-verification/diff-stat.txt](docs/v0.11/evidence/r3-verification/diff-stat.txt) |
| EV-10 | doc_link | direct | ok | lib golden L119-140 UP/rate=1/1->2 + message 逐字断言; 阈值 L143-174 0/±0.05; 空态矩阵 L192-253 值级 | [apps/server/src/lib/moodPeriodInsightComparison.test.ts](apps/server/src/lib/moodPeriodInsightComparison.test.ts) |
| EV-11 | doc_link | direct | ok | route L84-96 DOWN/rate=-1/1->0 message 逐字; L135-154 errorSpy toHaveBeenCalledTimes(1) 非静默降级 | [apps/server/src/routes/periodInsightComparison.routes.test.ts](apps/server/src/routes/periodInsightComparison.routes.test.ts) |
| EV-12 | doc_link | direct | ok | mobile fixture rate=0.062 message『+6.2%』值级; L58-63 第4类 NEW_INSIGHT_TYPE→degraded | [apps/mobile/src/utils/moodPeriodInsightComparison.test.ts](apps/mobile/src/utils/moodPeriodInsightComparison.test.ts) |
| EV-13 | log | direct | ok | bundle 内联 127.0.0.1:3888=1, insight/comparison=1, MoodPeriodInsightPanel=2, 文案两条命中; EXPO_PUBLIC_API_URL=0 非mock | [apps/mobile/dist-web/_expo/static/js/web/index-94432e93246c67708c8c76818511442b.js](apps/mobile/dist-web/_expo/static/js/web/index-94432e93246c67708c8c76818511442b.js) |
| EV-14 | log | direct | ok | 01-45 逐字一致 IDENTICAL; 46 additive 插入; 46-51→47-52 顺移对应; 51+1+2=54 对账吻合 | [docs/v0.11/evidence/r3-verification/e2e-baseline-diff.txt](docs/v0.11/evidence/r3-verification/e2e-baseline-diff.txt) |
| EV-15 | test_run | direct | ok | N=1→insights=[]无伪对比; periods=0→400 PERIOD_INSIGHT_COUNT_REJECTED; 非周一→404 PERIOD_INSIGHT_TARGET_NOT_FOUND; N=3 periodIds 三周序列正确 | [live:3888 自有进程 R3 实跑](live:3888 自有进程 R3 实跑) |

> 回写：pending → commit_status@docs/v0.11/VERIFICATION-R3.json · schemaVersion 1.0 · criteriaHash 未记录