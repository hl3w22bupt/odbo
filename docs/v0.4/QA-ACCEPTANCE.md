# 心伴 v0.4 质量验收记录（质量验收节点独立复审，2026-10-05）

本记录是五节点接力中「质量验收」节点的独立产出：不采信上游自述，全部结论以本节点独立复跑的证据为准。
机器可读报告：[`verification-report.json`](./verification-report.json)（过 `validate-report.mjs` 门禁，exit 0）· 渲染版：[`verification-report.md`](./verification-report.md)。

## 1. 门禁独立复跑（对照 docs/smoke/ 一致/漂移清单）

| 门 | 命令 | 本轮实跑 | 对照文档 | 判定 |
|---|---|---|---|---|
| build | `npm run build` | exit `0`（server tsc + mobile typecheck + Expo 导出） | `docs/smoke/v0.3.md` §3 / `v0.4.md` §3 | 一致 |
| start | `apps/server` 产物 `node dist/localServer.js` | `/health` → `status=up, mode=standalone` | `docs/smoke/v0.3.md` §3 产物启动门 | 一致 |
| test | `npm test` | exit `0`；server 9 files/46 tests + mobile 3 files/29 tests | `docs/smoke/v0.4.md` §3 测试门 | 一致 |
| smoke | `npm run smoke` | exit `0`；`22 项 / 22 项`（01-19 全绿 + 20-22 增量） | `docs/smoke/v0.4.md` §1-§2 | 一致 |
| persist | `npm run persist:check` | exit `0`；P01-P09 全绿（含 P05 kill → P06 重启 → P07/P08 读回 → P09 降级） | `docs/smoke/v0.3.md` §2 / `v0.4.md` §3 | 一致 |

**漂移清单：0 条阻塞级、0 条非阻塞级。**（上游 REPLAY.md 声称的零漂移，本轮独立复跑后确认成立。）

证据：`docs/v0.4/evidence/qa-{build,start-health,test-server,test-mobile,smoke,persist}.log`（sha256 已登记进 verification-report.json）。

## 2. 五条阻塞级拦截标准

| # | 拦截标准 | 本轮核验方式与结果 | 判定 |
|---|---|---|---|
| B1 | 无锚点或锚点失败 | DoD 全部 11 个测试锚点在源树逐字 grep 命中（moodInsight 4 + chat.routes 4 + insights 3），且随 46+29 全量套件绿 | 未触发 |
| B2 | 破坏 v0.3 冒烟基线 | smoke 01-19 逐项 ✅、22/22 exit 0；persist 9/9 exit 0；smoke.sh diff 纯追加（01-19 字节级未变） | 未触发 |
| B3 | 派生层反向写入或改契约 | `git diff ee98243..HEAD`：schema 零改动；新 handler 仅 `findFirst/findMany`；`moodInsight.ts`/`MoodInsightPanel.tsx` 零 Prisma、零写调用；`conversationInsights.ts`（读契约）零改动；`chat.routes.test.ts` 纯追加零删行 | 未触发 |
| B4 | 三件套缺一 | 空态（moodInsight/route/insights 各 1+）、脏数据·聚合失败降级（2+3）、兼容（既有契约测试未动且绿）均齐备 | 未触发 |
| B5 | 红绿证据缺失 | `red-*` 3 份（模块缺失/路由未注册/函数缺失，真实失败）+ `green-*` 3 份（4/4、14/14、8/8，真实通过）逐一核对内容 | 未触发 |

## 3. DoD 逐项锚点验收

| DoD | 锚点（本轮逐一验证存在且绿） | 判定 |
|---|---|---|
| V4-1 服务端洞察契约 | `moodInsight.test.ts > returns an explicit empty insight…`、`> aggregates an explainable trend…` | ✅ |
| V4-2 脏数据与降级 | `> skips dirty points…`、`> degrades when either source read is degraded`；route 空/存储失败/聚合失败三例 | ✅ |
| V4-3 HTTP 兼容 | `chat.routes.test.ts > exposes the insight summary read API`；v0.3 既有契约测试未修改且全绿 | ✅ |
| V4-4 客户端读视图 | `insights.test.ts > treats an insight summary as empty…`、`> hides dirty or degraded…`、`> asserts explainable insight content instead of pixels`；`MoodInsightPanel` 三态 | ✅ |
| V4-5 全链路 | smoke 20/21/22 本轮 exit 0；01-19 无回归 | ✅ |
| V4-6 v0.3 持久门 | persist P01-P09 本轮 exit 0 | ✅ |
| V4-7 死测试清账 | 扫描 0 命中（含 fit( 误报排除）；Vitest 输出无 skipped/todo | ✅ |

## 4. 逐提交构建+测试抽查

| 提交 | 方式 | 结果 |
|---|---|---|
| `3537ca9`（server 增量） | 验收侧 git worktree 独立检出，补跑 `prisma generate` 后实跑 | build exit `0`；server 46/46；mobile 26/26 ✅ |
| `ba8b54d`（mobile 增量） | 上游 `mobile-step-{build,test}.log`（46+29）+ 验收侧逐行 diff 审查 + HEAD 组合态全绿 | 一致 ✅ |
| `d7c91fa`（smoke 20-22） | 验收侧 HEAD 实跑 smoke/persist + diff 纯追加核验 | 一致 ✅ |
| `2093115`/`cc3df77`/`14a4b47` | 纯文档/证据提交 | 无构建面 ✅ |

注：worktree 首跑失败（`Cannot find module './generated/prisma/client.js'`）为验收环境缺 `prisma generate`（该目录 gitignore，`npm run setup` 既有约定），非提交缺陷；补生成后全绿。

## 5. 非阻塞项（记录在案，不卡交付；建议入 v0.5 停车场）

| # | 项 | 影响 | 建议 |
|---|---|---|---|
| N1 | `readableMemories` MEMORY_LIMIT=20 与路由 `findMany take:50` 口径不一 | 21+ 条 ACTIVE 记忆支撑的合法快照会被摘要按脏点跳过（红队可运行反例证实），与 `/mood-timeline`（cap 50）样本口径不一致 | 统一两处 cap，或在契约中显式声明截断口径 |
| N2 | `isValidDate` 用 `Date.parse` 宽容解析，非 ISO 串可进 `window.from/to` | 当前 Prisma 写路径不可达；派生器被复用时成真 | window 输出归一为 `toISOString()` |
| N3 | 客户端 `moodInsightViewState` 不校验 keywords/trend，`request<T>` 裸 cast | 服务端发畸形载荷时面板 TypeError（当前不可达） | viewState 补 `Array.isArray(keywords)` 守卫 |
| N4 | mock 的 `getMoodInsightSummary` 恒 STABLE/恒不降级/不做 ACTIVE 归因 | mock 演示环境与真实派生行为不一致（v0.3 stub 模式延续） | 对齐或注明为演示桩 |
| N5 | `3537ca9` 把原 `chatSend` doc 注释挪给新函数后未补回 | 可维护性小瑕疵 | 下次触碰该文件时补回 |
| N6 | mobile `npm run lint` 扫到 `dist-web` 产物噪音（上游已留档）；smoke 21 为单样本观察口径 | 开发体验/覆盖面 | 均已在既有停车场，维持 |

## 6. 红队对抗（独立子 agent）

12 项攻击：反证 7、证据抽查 17 条 digest 全一致、独立复现 smoke/persist/死测试扫描、范围与 diff 副作用扫描。结果 **0 blocker / 0 major upheld**，4 minor upheld（N1-N4）+ 1 记录级（N5）；7 条 pass 判定全部维持，无降级。安全面结论：鉴权先行、`findFirst({id,userId})` 越权隔离、404 不被降级吞掉、`reason/keywords` 不含用户原文（仅聚合规则与既有结构化关键词）。

## 7. 结论

- 验收口径三条全满足：v0.3 冒烟全绿无回归 ✅；v0.4 P0 DoD 7/7 打勾且每条有测试锚点 ✅；死测试挂账清零 ✅。
- 五条阻塞级拦截标准 0 触发；评分 100/100，结论 **CERTIFIED（通过签收）**。
- 上游产出（BASELINE/DEVELOPMENT/REVIEW/REPLAY/smoke 文档）与本轮独立复跑结论一致，无虚报；非阻塞项 N1-N6 已记录，不卡交付。
