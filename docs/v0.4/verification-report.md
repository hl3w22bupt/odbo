# 验证报告：心伴 v0.4「数据价值深化」增量交付质量验收（质量验收节点独立复审）

- 报告 ID：vrf_xinbanv04qareview01 · 结论：**CERTIFIED**
- 验证对象：requirement:xinban-v0.4-data-value（docs/v0.4/DEVELOPMENT.md）
- 触发：T3 显式调用 · 触发者：workflow-node:quality-review · 完成：2026-10-04T23:52:47.000Z · 耗时：2820000ms
- 完成度：100/100（pass 7/7 · partial 0 · fail 0 · unverified 0）

## 结论依据

- RULE_NO_FAILED_CORE: failed=0 且 unverified=0 且 partial=0（7/7 pass）
- RULE_NO_UPHELD_BLOCKER_OR_MAJOR: 红队 0 blocker / 0 major upheld（仅 4 minor + 1 记录级）
- RULE_SCORE_ABOVE_THRESHOLD: score=100（>=40）
- RULE_EVIDENCE_COMPLETE: 全部 pass 判定均引用 direct 证据且 digest 校验一致（红队抽查 17/17 匹配）

v0.4 P0『情绪洞察摘要』DoD 7/7 锚点命中且全绿；v0.3 冒烟 01-19 与持久门 P01-P09 独立复跑无回归；死测试挂账清零；五条阻塞级拦截标准全部未触发；红绿证据链完整。验收通过，签收 CERTIFIED。非阻塞改进项 4+2 条已记录在案（见 QA-ACCEPTANCE.md §5）。

## 逐条判定

| 标准 | 判定 | 权重 | 依据摘要 | 证据 |
|------|------|------|---------|------|
| AC-01 【core】V4-1 服务端洞察契约：空态 summary=null；有效输入产出 trend/counts/keywords/reason/window | pass | 3 | 两个锚点测试在源树逐字命中并随套件全绿：moodInsight.test.ts 'returns an explicit empty insight before any valid mood point' 断言 available=true/degraded=false/summary=null（EV-08，4/4 绿）；'aggregates an explainable trend from active memory-backed snapshots' 断言 sampleSize=4、counts、trend=IMPROVING、keywords=['开心','孤独']、window 起止与 reason 中前后半段均分文案（EV-08）。实现 moodInsight.ts 纯函数与冻结契约逐条对应（EV-10）。 | [EV-08](docs/v0.4/evidence/green-server-mood-insight.log) [EV-01](docs/v0.4/evidence/qa-build.log) [EV-10](apps/server/src/lib/moodInsight.ts) |
| AC-02 【core】V4-2 脏数据与降级：脏点跳过；memory/timeline/聚合失败返回 available=false/degraded=true/summary=null | pass | 3 | 降级三路径均有锚点且绿：模块级 'skips dirty points…'（无归因点跳过后 sampleSize=1）与 'degrades when either source read is degraded'（EV-08）；路由级 'serves the explicit empty insight summary…'、'degrades the insight summary when storage fails'（mock reject）、'degrades the insight summary when aggregation cannot safely complete'（createdAt 抛错注入）（EV-09，14/14 绿）。实现侧 catch 先透传 AppError 再降级，404 不被吞（红队 CH-4 反证不成立）。 | [EV-08](docs/v0.4/evidence/green-server-mood-insight.log) [EV-09](docs/v0.4/evidence/green-server-insight-route.log) [EV-03](docs/v0.4/evidence/qa-test-server.log) |
| AC-03 【core】V4-3 HTTP 兼容：新路由注册；v0.3 既有 memory/mood-timeline 契约测试未修改且全绿 | pass | 2 | 'exposes the insight summary read API' 断言路由表新增 GET /api/v1/conversations/:id/insight-summary（EV-09）。git diff ee98243..HEAD 证明：chat.routes.test.ts 纯追加零删行，conversationInsights.ts 与 prisma/schema.prisma 零改动，既有 46+29 测试全绿即 v0.3 契约行为未变（EV-04/EV-05/EV-06）。红队 CH-7 契约侵蚀反证不成立。 | [EV-09](docs/v0.4/evidence/green-server-insight-route.log) [EV-04](docs/v0.4/evidence/qa-test-mobile.log) [EV-05](docs/v0.4/evidence/qa-test-mobile.log) |
| AC-04 【core】V4-4 客户端读视图：空/降级/就绪三态判定正确，文案内容断言非像素 | pass | 2 | insights.test.ts 三个新锚点 'treats an insight summary as empty before the first valid point' / 'hides dirty or degraded insight data' / 'asserts explainable insight content instead of pixels' 命中且随套件全绿（EV-05：mobile 3 files/29 tests；EV-11 绿日志 8/8 含先红 EV-13）。MoodInsightPanel 按 moodInsightViewState 三态渲染文案，不触任何写 API（EV-12）。红队 CH-5 指出的 keywords 缺失崩溃路径需服务端发畸形载荷，当前类型+测试不可达，记为非阻塞加固项（RT-03 minor）。 | [EV-05](docs/v0.4/evidence/qa-test-mobile.log) [EV-11](docs/v0.4/evidence/green-mobile-insight.log) [EV-12](apps/mobile/src/components/MoodInsightPanel.tsx) [EV-13](docs/v0.4/evidence/red-server-insight-route.log) |
| AC-05 【core】V4-5 全链路：smoke 01-19 v0.3 基线无回归 + 20-22 增量，exit 0 | pass | 3 | 验收侧独立复跑 npm run smoke：exit 0，末行 '心伴 v0.4 冒烟通过：22 项 / 22 项'，01-19 v0.3 基线段逐项 ✅ 无回归，20-22 增量段（就绪摘要 headline、样本口径 sampleSize=1、新会话空态）通过（EV-06）。smoke.sh diff 为纯追加，01-19 步骤字节级未变（EV-14）。红队独立复现（CH-8 refuted）。 | [EV-06](docs/v0.4/evidence/qa-smoke.log) [EV-14](scripts/smoke.sh) |
| AC-06 【core】V4-6 v0.3 持久门无回归：persist:check exit 0，P01-P09 | pass | 2 | 验收侧独立复跑 npm run persist:check：exit 0，P01-P09 共 9 项全 ✅，含 P02 写 → P05 kill → P06 重启 → P07/P08 读回一致 → P09 写失败降级（EV-07）。红队独立复现（CH-9 refuted）。 | [EV-07](docs/v0.4/evidence/qa-persist.log) |
| AC-07 V4-7 死测试清账：扫描 0 命中，Vitest 无 skipped/todo | pass | 1 | 验收侧以 grep -RInE '\.(skip\|only\|todo)\b\|\b(xit\|xdescribe)\(' 扫描 apps/server/src、apps/mobile/src、scripts：0 命中；两份 Vitest 日志 grep skipped/todo 均 0（EV-04/EV-05）。死测试挂账清零，与 docs/v0.4/BASELINE.md §3 台账一致。红队复核含 fit( 误报排除（CH-10 refuted）。 | [EV-04](docs/v0.4/evidence/qa-test-mobile.log) [EV-05](docs/v0.4/evidence/qa-test-mobile.log) |

## 红队对抗

- 状态：completed · 挑战：9（upheld blocker 0 / major 0 / minor 5）
- 独立上下文子 agent 执行 12 项攻击（反证 7 + 证据抽查 + 独立复现 3 + 范围/diff 副作用 2）。17 条证据 digest 全部一致；AC-5/6/7 被独立复现。0 blocker / 0 major upheld，4 项 minor upheld（RT-01 样本口径、RT-02 Date.parse 宽容解析、RT-03 客户端防御纵深、RT-04 mock 契约不一致），另 1 项记录级（RT-05 chatSend 注释丢失）。全部 pass 判定维持，无降级。
- 未覆盖攻击面：多并发写读下 insight-summary 与 /mood-timeline 的瞬时一致性（超出本轮读侧范围）；真实 LLM 摘要路径（停车场项，本轮无实现）

| 挑战 | 目标 | 类型 | 严重度 | 主张 | 结果 |
|------|------|------|--------|------|------|
| RT-01 | AC-01 | falsification | minor | readableMemories 以 MEMORY_LIMIT=20 截断而路由 findMany take:50：第 21+ 条 ACTIVE 记忆支撑的合法情绪点会被 insight 摘要按脏点跳过，与 /mood-timeline（cap 50）样本口径不一致，长会话下可能误报空态。红队以 30 条记忆的可运行反例证实。 | upheld：核验侧复核确认两处 cap 不一致属实；行为符合『无归因即跳过』的冻结策略且偏保守，不违反任何 DoD 谓词，判 minor 不降级；记入 v0.5 改进清单（统一 cap 或显式声明截断口径）。 |
| RT-02 | AC-01 | falsification | minor | isValidDate 用 Date.parse 宽容解析（'2026'、'January 2, 2026 UTC' 均通过），原始串直接进 window.from/to，与 v0.3 serializeMood 恒 ISO 的事实契约不一致；当前 Prisma 写路径不可达。 | upheld：不可达但属读侧派生器被复用时的真实缺口；记入停车场（window 输出归一为 toISOString）。 |
| RT-03 | AC-04 | falsification | minor | moodInsightViewState 不校验 keywords/trend/counts/window，request<T> 为裸 cast 无运行时校验：keywords=undefined 时面板在 keywords.length 处 TypeError，trend 未知值查表 undefined。需服务端发畸形载荷，当前类型+测试不可达。 | upheld：防御纵深缺口，当前不可达；记入停车场（viewState 补 keywords Array.isArray 守卫）。 |
| RT-04 | AC-04 | scope | minor | mock 的 getMoodInsightSummary 恒 STABLE/恒不降级/不做 ACTIVE 归因 join，与真实服务端派生行为不一致；为 v0.3 mock 朴素 stub 模式的延续。 | upheld：不升 major（模式延续、mock 环境限定）；记入停车场。 |
| RT-05 | AC-03 | scope | minor | 3537ca9 将原 chatSend 的 doc 注释挪给新函数后未补回，chatSend 现无注释；纯注释丢失无行为影响。 | upheld：记录级可维护性瑕疵，随下次触碰该文件时顺手补回即可，不卡交付。 |
| RT-06 | AC-02 | falsification | minor | 尝试『降级吞 404』与『跨用户越权读』：反证不成立——AppError 先透传、findFirst 带 userId 隔离。 | overturned：红队实测 rejects.toMatchObject({statusCode:404})，安全语义正确。 |
| RT-07 | AC-05 | probing | minor | 红队独立复跑 npm run smoke：22/22 exit 0，与判定一致。 | overturned：独立复现成功，反证不成立。 |
| RT-08 | AC-06 | probing | minor | 红队独立复跑 npm run persist:check：9/9 exit 0，与判定一致。 | overturned：独立复现成功，反证不成立。 |
| RT-09 | AC-03 | scope | minor | 尝试找被删/放宽的既有断言：diff 证明 chat.routes.test.ts 纯追加、conversationInsights.ts 零改动、insights.test.ts 仅 import 增补、smoke 01-19 字节级未变。 | overturned：契约侵蚀反证不成立。 |

## 风险与遗留

- RT-01（minor upheld）：readableMemories 以 MEMORY_LIMIT=20 截断而路由 findMany take:50：第 21+ 条 ACTIVE 记忆支撑的合法情绪点会被 insight 摘要按脏点跳过，与 /mood-timeline（cap 50）样本口径不一致，长会话下可能误报空态。红队以 30 条记忆的可运行反例证实。
- RT-02（minor upheld）：isValidDate 用 Date.parse 宽容解析（'2026'、'January 2, 2026 UTC' 均通过），原始串直接进 window.from/to，与 v0.3 serializeMood 恒 ISO 的事实契约不一致；当前 Prisma 写路径不可达。
- RT-03（minor upheld）：moodInsightViewState 不校验 keywords/trend/counts/window，request<T> 为裸 cast 无运行时校验：keywords=undefined 时面板在 keywords.length 处 TypeError，trend 未知值查表 undefined。需服务端发畸形载荷，当前类型+测试不可达。
- RT-04（minor upheld）：mock 的 getMoodInsightSummary 恒 STABLE/恒不降级/不做 ACTIVE 归因 join，与真实服务端派生行为不一致；为 v0.3 mock 朴素 stub 模式的延续。
- RT-05（minor upheld）：3537ca9 将原 chatSend 的 doc 注释挪给新函数后未补回，chatSend 现无注释；纯注释丢失无行为影响。

## 证据清单

| ID | 类型 | 可靠性 | 状态 | 摘要 | 链接 |
|----|------|--------|------|------|------|
| EV-01 | log | direct | ok | BUILD_EXIT=0；server tsc + mobile typecheck + Expo Web 导出（Exported: dist-web） | [docs/v0.4/evidence/qa-build.log](docs/v0.4/evidence/qa-build.log) |
| EV-02 | log | direct | ok | /health → {"status":"up","mode":"standalone"}，路由表含 chat::conversation-insight-summary | [docs/v0.4/evidence/qa-start-health.log](docs/v0.4/evidence/qa-start-health.log) |
| EV-03 | log | direct | ok | Test Files 9 passed (9) / Tests 46 passed (46)，SERVER_TEST_EXIT=0 | [docs/v0.4/evidence/qa-test-server.log](docs/v0.4/evidence/qa-test-server.log) |
| EV-04 | log | direct | ok | Test Files 3 passed (3) / Tests 29 passed (29)，MOBILE_TEST_EXIT=0 | [docs/v0.4/evidence/qa-test-mobile.log](docs/v0.4/evidence/qa-test-mobile.log) |
| EV-05 | log | direct | ok | insights.test.ts 8 tests passed（5 旧 + 3 新），无 skipped/todo | [docs/v0.4/evidence/qa-test-mobile.log](docs/v0.4/evidence/qa-test-mobile.log) |
| EV-06 | log | direct | ok | SMOKE_EXIT=0；01-19 逐项 ✅；20 情绪洞察就绪摘要 / 21 样本口径 / 22 空态契约；心伴 v0.4 冒烟通过：22 项 / 22 项 | [docs/v0.4/evidence/qa-smoke.log](docs/v0.4/evidence/qa-smoke.log) |
| EV-07 | log | direct | ok | PERSIST_EXIT=0；P01-P09 全 ✅（含 P05 kill → P06 重启 → P07/P08 读回一致 → P09 降级） | [docs/v0.4/evidence/qa-persist.log](docs/v0.4/evidence/qa-persist.log) |
| EV-08 | log | direct | ok | moodInsight.test.ts：Test Files 1 passed / Tests 4 passed（对应先红 EV-12） | [docs/v0.4/evidence/green-server-mood-insight.log](docs/v0.4/evidence/green-server-mood-insight.log) |
| EV-09 | log | direct | ok | chat.routes + conversationInsights：Test Files 2 passed / Tests 14 passed（对应先红 EV-13） | [docs/v0.4/evidence/green-server-insight-route.log](docs/v0.4/evidence/green-server-insight-route.log) |
| EV-10 | git_commit | direct | ok | readableMoodInsightSummary：ACTIVE 归因过滤 + 脏点跳过 + 样本<3 STABLE + 关键词频次/首现 top3；零 Prisma 依赖 | [apps/server/src/lib/moodInsight.ts](apps/server/src/lib/moodInsight.ts) |
| EV-11 | log | direct | ok | insights.test.ts：Test Files 1 passed / Tests 8 passed（5 旧 + 3 新） | [docs/v0.4/evidence/green-mobile-insight.log](docs/v0.4/evidence/green-mobile-insight.log) |
| EV-12 | git_commit | direct | ok | MoodInsightPanel：degraded/empty/ready 三态文案渲染，无任何写调用 | [apps/mobile/src/components/MoodInsightPanel.tsx](apps/mobile/src/components/MoodInsightPanel.tsx) |
| EV-13 | log | indirect | ok | 先红：chat.routes.test.ts 4 failed（路由未注册/用例缺失），红绿证据链完整（red-* 3 份 + green-* 3 份） | [docs/v0.4/evidence/red-server-insight-route.log](docs/v0.4/evidence/red-server-insight-route.log) |
| EV-14 | git_commit | indirect | ok | 01-19 步骤字节级未变（git show d7c91fa diff 为证）；追加 20 就绪摘要 / 21 sampleSize=1 / 22 空态契约 | [scripts/smoke.sh](scripts/smoke.sh) |
| EV-15 | log | indirect | ok | 3537ca9 提交时点：server 46 + mobile 26 全绿（验收侧另以 worktree 独立复现 build exit 0 + 46/46 + 26/26） | [docs/v0.4/evidence/server-step-test.log](docs/v0.4/evidence/server-step-test.log) |

> 回写：pending → requirement_verification_result@docs/v0.4/QA-ACCEPTANCE.md、notification@workflow-node:delivery · schemaVersion 1.0 · criteriaHash sha256:d3f10c7100b697d24d7216ac2cb0b5cde668c9b86789a7ec3ac6da409bc8a0b2