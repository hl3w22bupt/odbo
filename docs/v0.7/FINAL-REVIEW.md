# 心伴 v0.7 上游产出终审（FINAL REVIEW）

审查对象：v0.7 五节点接力全部产出（基线裁决 → 范围冻结 → 增量实现 → 质量验收 → deploy 闭环，含跨轮复验）。
审查方法：verification 六阶段（S1 标准解析 → S2 证据采集 → S3 逐条判定 → S4 独立红队 → S5 评分结论 → S6 报告落盘）。

**终审结论：通过（PASS / CERTIFIED 等价）。score=100；8/8 判定 pass；0 fail / 0 partial / 0 unverified；红队 0 blocker / 0 major / 3 minor（不降级）。**

- 我方九项门禁独立复跑全部 exit 0，与上游 QA/DEPLOY/RECHECK 记录逐项一致，无回退、无阻塞漂移。
- 全部修改意见为非阻塞 minor（7 条，见 §6），不触及「空态/降级/内容断言」三条底线。

## 1. 验收标准与逐条判定

| # | 标准（源自任务需求） | 判定 | 关键证据（锚定文件/命令，均可复现） |
|---|---|---|---|
| AC-01 | 节点1：基线复跑对照 v0.6，阻塞级漂移先修 | pass | `BASELINE.md` §1 五门记录；我方在 HEAD 复跑 smoke 01-38（v0.6 兼容段）全绿，无阻塞漂移 |
| AC-02 | 节点1：轨迹可视化三判据复核并归档（缺一即未实质落地） | pass | 三锚点逐行核验实存：`ChatScreen.tsx:519` 挂载 `MoodTimelinePanel`（用户可触达）；`chat.routes.test.ts:164 test_correction_latest_wins`（持久层+修正后数据）；`insights.test.ts:60 asserts timeline content instead of pixels`（内容级断言）。结论「已实质落地」成立，P0=周报分支选择正确 |
| AC-03 | 节点1：死测试四口径清零 + 停车场三判据盘点 | pass | 四口径扫描我方复跑 = 0 条；`BASELINE.md` §4 五候选清单在案，未占主线 |
| AC-04 | 节点2：二选一裁决 + 契约四件套落字（空态/降级具体文案）+ DoD 双锚定 | pass | `REQUIREMENTS.md` FROZEN；§3.3 空态/降级文案逐字落到 `MoodWeeklyReportPanel.tsx:13-24`；§4 九项 DoD 均含「测试名 + 用户可见行为」双锚定（F3 引用名漂移见 §6-M1） |
| AC-05 | 节点3：只做冻结范围；纯函数化+单向依赖；空态/降级测试前置先红后绿；每步独立提交；冒烟文档同提交 | pass | `moodWeeklyReport.ts` 零 Prisma import（纯函数）；`chat.ts:316-353` 路由单向调用派生层；红证据 `red-weekly-report-exit.txt`（exit=1×2，4 用例失败）先于实现提交 `e2a2ed4`；`docs/smoke/v0.7.md` 与功能同在 `e2a2ed4` 提交；提交序列 eb45340→222026a→e2a2ed4→5548069→71deb68 与节点序一致 |
| AC-06 | 节点4：DoD 逐项机判；红绿链完整；v0.4-v0.6 兼容回归全量复跑 | pass | 7 条 DoD 具名测试逐一 grep 命中（见 §3）；我方复现 smoke 42/42（01-38 兼容段全绿）、persist 9/9、persistence:v02 18/18 |
| AC-07 | 节点5：AppHost 导出发布；部署后重跑冒烟一致才签发 | pass | AppHost 四件自洽（PUT 200 / GET 200 / 190724 字节 / SHA256 三处一致 `4b2eeecc…61726c`，红队另做本机独立重算复核）；我方部署后 smoke 42/42 与部署前一致 |
| AC-08 | 代码正确性 / 可维护性 / 规范符合度 | pass | 见 §5；5 项低风险坏味道全部非阻塞且多数已在册 |

## 2. 我方独立复跑机判（2026-10-09，HEAD=75bc5b3，工作树干净）

| 门 | 命令 | 我方结果 | 与上游记录 |
|---|---|---|---|
| build | `npm run build` | exit 0（Web 导出 336 modules） | 一致 |
| test | `npm test` | exit 0；server 16 files/76 tests + mobile 5 files/33 tests | 一致 |
| smoke（部署前） | `npm run smoke` | exit 0；42/42（01-38 兼容 + 39-42 周报） | 一致 |
| persist | `npm run persist:check` | exit 0；9/9 | 一致 |
| persistence:v02 | `npm run persistence:v02` | exit 0；18/18（含 kill -9 重启） | 一致 |
| deploy | `npm run deploy:v02` | exit 0；build=0 start=0 test=0 | 一致 |
| smoke（部署后） | `npm run smoke` | exit 0；42/42，与部署前一致 | 一致 |
| 死测试四口径 | grep `.skip/.only/.todo/xit/xdescribe` | 0 条 | 一致 |
| schema 底线 | `git diff f02d97e..HEAD -- '*schema.prisma*'` | 空 diff | 一致 |

## 3. 红绿证据链核验

- 红：`red-server-weekly-report.log` 真实 4 failed（route 未注册）、`red-mobile-weekly-report.log` 模块缺失、`red-weekly-report-exit.txt` = `red_server_exit=1 red_mobile_exit=1`；红日志 mtime 先于实现提交 `e2a2ed4`。
- 绿：`green-server-weekly-pure.log`（2 tests）→ `green-server-weekly-route.log` → `green-mobile-weekly-util.log` → 全量 76+33。
- 内容断言非渲染烟雾：周报断言覆盖 counts/trend/reason 中文字面/keywords/window 边界/降级契约（`moodWeeklyReport.test.ts:67-80` toEqual 全量结构；`chat.routes.test.ts:423-435` toMatchObject + 具名包含断言）。
- DoD 具名测试 7/7 存在；其中 F3 源码实际名为 `includes exact window boundaries and skips out of window dirty and unattributed points`，与 QA 表精确一致、为冻结表引用名的超集（见 §6-M1）。
- 0 字节证据定性：`*-dead-test-scan.log`、`implementation-mobile-src-lint.log` 为「空输出=通过」的合法留证（grep/eslint 无命中即空）；但 `qa-start.log`/`baseline-start.log` 作 start 门直接证据证据力不足（见 §6-M3）。

## 4. 红队对抗结果（独立子 agent，全程只读）

三类攻击（反证 5 项 / 证据抽查 4 项 / 范围攻击 3 项），**UPHELD 3 条全部 minor，REFUTED 9 项**：

| ID | 攻击点 | 结果 |
|---|---|---|
| ATTACK-1.1 | 窗口 to 端点（恰好 now 的点）无测试，测试名 "boundaries" 名不副实 | **UPHELD minor**（§6-M2） |
| ATTACK-1.2 | latest-wins 孤儿/多条 correction 语义漂移 | REFUTED（周报复用与 v0.3/v0.4 同一 `readableMoodTimeline`，该文件零改动，一致性由构造保证） |
| ATTACK-1.3 | 奇数样本中位点丢弃非冻结规则 | REFUTED（`REVIEW.md:47` 明文冻结） |
| ATTACK-1.4 | 空态/降级互串 | REFUTED（降级恒 `report:null`；客户端三处 `.catch(()=>null)` → degraded，符合契约） |
| ATTACK-1.5 | 畸形载荷 React child 崩溃 | REFUTED（ready 分支仅渲染经守卫的 headline/trend/reason 三字段） |
| ATTACK-2.1 | 证据文件内容 vs 文档声称（含 0 字节定性） | **UPHELD minor**（仅 start 门证据薄弱，§6-M3） |
| ATTACK-2.2 | SHA256 / apphost 自洽性 | REFUTED（红队本机重算 `/tmp/xinban-v0.7-web.tar.gz` SHA256 与字节数逐项一致） |
| ATTACK-2.3 | git 提交顺序 / RECHECK 夹带源码 | REFUTED（`75bc5b3` 仅文档+证据，零源码改动） |
| ATTACK-2.4 | F3 冻结 DoD 测试名 verbatim 命中 | **UPHELD minor**（§6-M1） |
| ATTACK-3.1 | diff 副作用（删测试/放宽断言/改既有路由） | REFUTED（全仓仅 4 行删除且无断言弱化；smoke 01-38 字节级未动） |
| ATTACK-3.2 | prisma 底线 | REFUTED（diff 为空） |
| ATTACK-3.3 | 冻结范围外夹带 | REFUTED（变更全落在周报垂直切片；附 mock 关键词排序漂移注记，§6-M5） |

## 5. 代码质量审查（正确性 / 可维护性 / 规范符合度）

- **正确性**：7 日闭区间窗口、ACTIVE 归因（`activeMemoryIds` 集合命中）、latest-wins 修正先行、`<2` 空态、异常降级（AppError 重抛不被吞）均与冻结契约一致；趋势方向语义正确（score 正向=好转）。
- **可维护性**：模块边界清晰（派生器纯函数 / HTTP 层管鉴权与读库 / 客户端状态收敛函数可单测）；依赖单向 `routes → contracts/derived lib → Prisma rows`。
- **规范符合度**：interface 定义类型、联合类型代替枚举（`MoodWeeklyTrend`）、PascalCase 组件且文件同名、函数组件 + Hooks、常量 UPPER_SNAKE_CASE（`WEEKLY_WINDOW_MS`）、commit 符合 `<type>(<scope>): <subject>`。测试中 `2 as never` 为刻意的脏点注入，属合理类型逃逸。

## 6. 修改意见（全部非阻塞 minor，建议下轮或停车场处置）

| # | 意见 | 处置建议 |
|---|---|---|
| M1 | 冻结 DoD F3 引用测试名与源码实际名不一致（实际名为其超集）；`RECHECK.md` §3「7/7 verbatim 双锚定一致」对 REQUIREMENTS 表言过其实 | docs 勘误：回写 REQUIREMENTS F3 引用名，或在 RECHECK 追加一条勘误说明 |
| M2 | 窗口 `to` 端点（恰好 now 的点）零测试覆盖，与测试名 "boundaries" 复数不符 | 补 1 条恰为 `NOW` 的计入断言（一行级成本） |
| M3 | `qa-start.log`/`baseline-start.log` 为 0 字节却作 start 门证据，无法直接证明 exit 0 / status=up | 后续 start 门留证改用带输出的日志或直接引用同侧 `qa-health.json` |
| M4 | `moodWeeklyReportEmpty(conversationId, now = new Date())` 的 `now` 参数从未使用（死参数） | 移除参数或用于注释性窗口回显 |
| M5 | mock 与 server 纯函数重复实现且已现漂移实例：mock 关键词取 `Set` 插入序，server `pickKeywords` 按频次降序；mock 过滤弱于 server（不校验 `point.id`/score 值域） | 停车场既有「monorepo shared lib」条目补充这两处具体漂移点 |
| M6 | smoke 39/40 步断言混用 `$BODY` 文件副作用与命令替换变量（`$weekly`/`$fresh_weekly`），语义正确但脆弱 | 统一改为读取命令替换变量 |
| M7 | 既有在册项维持：`take:50` 升序截断、奇数样本中位点丢弃（冻结规则）、客户端 headline/reason 深度类型守卫 | 维持停车场，不阻塞 |

## 7. 跨轮基线事实归档

1. v0.7 五节点接力产出在 `75bc5b3` 处可完整独立复现：九项门禁我方重跑全部一致。
2. 节点1 三判据裁决「轨迹可视化已实质落地」经逐行锚点核验维持成立，P0=周报分支选择正确。
3. 本轮终审不推翻 `QA-ACCEPTANCE.md` 的「通过 / DEPLOY CLOSED」与 `RECHECK.md` 的「PASS / CLOSED」；验收闭环状态维持。
4. 7 条 minor 全部不阻塞，纳入下轮增量与停车场清单。
