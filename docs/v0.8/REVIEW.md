# 心伴 v0.8 重入轮 · 代码审查终审（上游全部产出）

- 审查角色：代码审查节点（Verification 六阶段流水线：S1 标准解析 → S2 证据采集 → S3 逐条核验 → S4 红队对抗 → S5 评分结论 → S6 报告落盘）
- 被审对象：`54c9046`（装配）→ `a077a8b`/`be8ef48`（节点0）→ `b558e33`（节点1）→ `3813ce4`（节点2 冻结）→ `e5d3e6b`（节点3 实现）→ `0ae0851`/`0354272`（节点4 验收）→ `3f7310f`（节点5 deploy）→ `c488aca`（上游终审四门认证）
- 审查时间：2026-10-11T07:46–08:08 (+0800)
- 审查方式：**不采信上游任何自述**，全部关键声称由审查端独立复跑/复判取实退出码与日志内容；复跑证据落盘于 `docs/v0.8/evidence/review-*`（首轮@c488aca）与 `review2-*`（终态含审查端补验），命令原文+退出码+时间戳见 `review-gates-summary.txt` / `review2-gates-summary.txt`。

## 1. 审查端独立门禁复跑（对照上游声称值）

审查端命令原文：`npm run build` / `npm test` / `npm run smoke` / `npm run persist:check` / `npm run persistence:v02`（按序串行，输出重定向落盘，退出码逐个捕获）。

| 门 | 上游声称 | 审查端首轮实测（HEAD=c488aca） | 对照 | 留证（sha256 前 16 位） |
|---|---|---|---|---|
| build | exit 0；336 modules | **rc=0**；server tsc + mobile typecheck + expo 导出 `index-3676416ecd…js (670KB)` | 一致 | `review-build.exit=9a271f2a` |
| test | exit 0；server 17 files/81 + mobile 5 files/33 | **rc=0**；81 passed + 33 passed | 一致 | `review-test.exit=9a271f2a` |
| smoke | exit 0；45/45 | **rc=0**；✅×46（45 步+汇总行）、❌×0，43/44/45 步全绿 | 一致 | `review-smoke.exit=9a271f2a` |
| persist | exit 0；9/9 | **rc=0**；P01–P09 全绿 exit=0 | 一致 | `review-persist.exit=9a271f2a` |
| persistence:v02 | exit 0；18/18 | **rc=0**；18 项全绿 | 一致 | `review-persist-v02.exit=9a271f2a` |

计数口径复核：server 17 files/81 tests = v0.7 基线 16 files/76 tests + 新增 `moodPeriodReport.test.ts`（2 测试）+ `chat.routes.test.ts` 新增 3 测试；与上游逐字一致。终审补验后为 **82 + 33**（多出的 1 条为审查端新增的越权 404 用例，见 §5 处置记录）。

## 2. 逐条核验（S3，四态判定）

| # | 验收项 | 权重 | 判定 | 审查端证据（命令 → 锚点） |
|---|---|---|---|---|
| AC-01 | 节点 0 六项机判准入，证据四要素齐全 | 2 | **pass** | 独立复判：branch 名 ✓、`git merge-base --is-ancestor 44f27b8 HEAD` rc=0 ✓、`git cat-file -e` 三产物（v0.7.md / v0.7/BASELINE.md / moodWeeklyReport.ts）均 rc=0 ✓；`NODE0.md` 六项均含命令原文+输出锚点+UTC 时间戳+HEAD SHA（`54c9046`） |
| AC-02 | 节点 1 五门复跑对照 v0.7，阻塞级漂移为零 | 2 | **pass** | `node1-baseline-*.log` 为 v0.7 时点真值（76 tests / 42 smoke / 336 modules / health up@23:23:19Z），非事后伪造；审查端五门实测全 rc=0；`git diff f02d97e..HEAD -- '*schema.prisma*'`=0 行 |
| AC-03 | v0.7 轨迹可视化三证据 AND | 2 | **pass** | 三锚点实存：`ChatScreen.tsx:519` 挂载 MoodTimelinePanel ✓；`chat.routes.test.ts:165` `it('test_correction_latest_wins')` ✓；`insights.test.ts:60` 值级断言（`toMatchObject({mood:'POSITIVE',score:1})`，非存在性断言）✓ |
| AC-04 | 死测试四口径清账清零 | 1 | **pass** | 审查端复跑 grep=0 行；终态四要素版留证 `review2-dead-test-scan.log`（含命令原文/HEAD/时间戳/hits=0） |
| AC-05 | 节点 2 冻结三件套（口径/DoD 打勾表/契约四件套） | 2 | **pass** | `REQUIREMENTS.md`：聚合口径 5 条逐字冻结（周一自然周/缺省剔除不零填充/显式披露覆盖率/空周期合法空结构非 404/500/降级 degraded 非静默）；DoD T1–T6 五个具名测试锚点与代码 verbatim 一致（`node4-dod-anchor-tests.txt` verbatim_hits=1×5，审查端逐一比对源码确认）；契约含边界值/字段级/空态/降级四件套 |
| AC-06 | 节点 3 只做 P0、additive、先红后绿、断言三件套 | 2 | **pass** | diff 范围：schema/迁移零改动（prisma 目录 `44f27b8..HEAD` 空，`review2-schema-diff.log` 四要素留证）、既有路由零修改（仅 additive 注册 `chat::conversation-period-report`）、`smoke.sh` 仅追加 43–45 段（01–38 未动，红队以逐段 diff 复核：仅追加 `19a20,22` 三行 + 头注/尾行替换，不在任何步骤段内）；红证据 `node3-red-server-period.log` 为真实 vitest 失败输出（3 failed：路由未注册×2+模块缺失，18 existing passed），时间 07:30:55 早于实现提交 `e5d3e6b`（07:35:37）；断言三件套 = T1 正常聚合（值级 toEqual 5 天桶）+ T2 空周期逐字段 + T3 降级+`logger.error` 断言 |
| AC-07 | 节点 4 DoD 机判 + 兼容回归 + 冒烟文档同提交 | 2 | **pass**（附红队修正，见 §5-A4） | QA 表 6/6 ☑ 且独立机判有效（抓到 build TS2322 阻塞并修复于 `0ae0851`，红日志 `node4-qa-build.log` 07:36:23 真实显示 `moodPeriodReport.ts(75,5) TS2322`，与修复逐字对应，修复后 build/test 双绿）；`docs/smoke/v0.8.md` 与功能同提交于 `e5d3e6b`；审查端 45/45、9/9、18/18 实测。**红队修正**：QA 对 T4 的判定口径较冻结版缩水（「越权 404」未验证），审查端已补验闭环（§5-A4），闭环后本条按最终态判 pass |
| AC-08 | 节点 5 AppHost 导出 + 部署后冒烟闭环 + v0.8 基线产出 | 2 | **pass** | `node5-apphost-release-sha256.txt`（sha256=e0a5dbbb…、191027 字节）与回读 `download_sha256` 双一致（`sha256_match=true`，红队独立复验属实）；部署后 smoke 45/45、persist 9/9 与部署前同值（`node5-post-deploy-*.log`）；`docs/smoke/v0.8.md` 45 步基线在案 |
| AC-09 | 红线：空态/降级契约 + 无纸面交付 | 2 | **pass** | 空态逐字段 `toEqual` 断言（非空结构非 404/500）；降级信封 `period:null/degraded:true` + 非静默 `logger.error` 断言（消息含 `period mood report degraded`，底层 `console.error` 真实落 stderr）；终审报告+全部复跑证据随本终审提交入库（红队 E2 指出的「终审证据未入库」于最终提交时点自愈闭合） |

**加权评分**：Σ(w×1.0)/Σw = 17/17 = **100**（9 条 core 全 pass；其中 AC-07 为红队发现 + 审查端闭环后的最终态判定）。

## 3. 红队对抗（S4）

1. **变异测试反证（审查端执行，全部已还原、tracked 树零残留）**：
   - 变异 A：`coverageDays: buckets.size` → `PERIOD_TOTAL_DAYS`（模拟零填充语义篡改）→ `vitest run src/lib/moodPeriodReport.test.ts` **exit=1（1 failed）**，T1 值级断言咬住篡改；
   - 变异 B：注释降级路径 `logger.error`（模拟静默吞错）→ `vitest run -t 'degrades the period report and logs loudly'` **exit=1（1 failed）**，T3 非静默断言咬住篡改；
   - 变异 C：移除 `conversationPeriodMoodReport` 越权守卫（模拟越权放行）→ 审查端新增的 T4 越权 404 测试 **exit=1**（`AssertionError: promise resolved 200 instead of rejecting`），证明该测试有真实咬合与安全意义。
2. **独立子代理红队**：独立上下文执行反证（含 esbuild 打包纯函数跑跨年周/周日归属/奇数样本/畸形时间探针）、证据抽查（12/43 ≈ 28%，含全部关键链）、范围攻击（逐提交 numstat + smoke 逐段 diff）。结论：五条判定（T1/T2/T3/T5/T6）维持成立；T4 判定存在口径缩水（upheld major，已闭环）；范围与兼容声称全部核实为真（无越界、既有断言零删改零放宽）。完整记录见 §5 附录。
3. **红绿日志内容核验**：红日志均为真实失败输出（非占位文件）且时间线自洽：节点 3 红（07:30:55）< 实现提交（07:35:37）；QA build 红（07:36:23）< 修复提交（07:38:15）。基线日志为 v0.7 时点真值（76/42/336），无事后伪造。

## 4. 结论

**通过（CERTIFIED，含 1 项审查端闭环记录）**。v0.8 重入轮五节点接力完整闭环：六项机判准入 → v0.7 基线一致（零阻塞漂移）→ 二选一裁定正确（三证据 AND 成立 → 周期情绪报告最小版）→ P0 实现先红后绿、断言三件套齐备、schema 零 diff、契约纯 additive → QA 独立机判（抓到并修复 1 项 build 阻塞）→ AppHost 发布验签闭环 + 部署后冒烟同值复现。审查端五门独立复跑全绿，DoD 三点一线（锚点 → 测试实存 → 实跑同值）逐条成立。

红队发现的唯一实质缺口（T4 越权 404 验证缺位）由审查端在终审中补验闭环：新增具名测试 `rejects cross-user or missing conversations with the defined 404 error`（变异 C 证明咬合），终态 test 82+33 全绿、五门全 rc=0（`review2-gates-summary.txt`）。**若不含该闭环，本轮应为 NEEDS_WORK（T4 partial）**——此判定路径已在 §5 完整披露，供审计回溯。

### 非阻塞意见（入停车场，不影响本轮签收）

| # | 级别 | 意见 | 处置建议 |
|---|---|---|---|
| F1 | minor | 冻结文档 §3.1 边界值集合声明「测试须覆盖：仅 1 个有效点 → trend='STABLE'」，但无用例（现有覆盖 6/2/0 点；红队探针实测单点行为正确） | 下轮补 1 条单点 STABLE 用例（实现已有 `length<2` 双护栏） |
| F2 | minor | 周期报告路由取数 `take: 50, orderBy createdAt asc` 沿袭 v0.7 周报同款模式，会话历史快照 >50 时当周点可能取不到 → 静默空报告 | 预存在模式（v0.7 三处 handler 同款）；建议下轮 weekly+period 一并改为按窗口 `where createdAt >= from` 取数 |
| F3 | minor | `BASELINE.md` §2 引用 `chat.routes.test.ts:164`，实际锚点在 165 行 | 文档勘误级 |
| F4 | minor | 冒烟 43 步 `coverageDays>=1` 为弱断言（强值断言由 T1 具名测试与路由测试 `coverageDays=2` 锁定） | 可接受；如收紧可改 `coverageDays==2` |
| F5 | minor | 上游 3 个证据锚点文件为 0 字节（dead-test 扫描×2、schema diff×1），无命令原文/退出码/时间戳，违反本轮自定四要素标准（声称本身经审查端复验为真） | 已由审查端 `review2-dead-test-scan.log` / `review2-schema-diff.log` 示范补强；后续节点留证一律带内容 |
| F6 | minor | 趋势半分比较在奇数样本时中位点被丢弃（3 点取首尾各 1）——与 v0.7 `moodWeeklyReport.ts` 逐行同款且冻结口径明示「与 v0.7 相同」 | 记录在案；如产品认为需全样本参与，另立需求统一改两处 |

## 5. 附录：独立红队子代理结论与仲裁处置

红队以独立上下文执行（只喂标准+判定+证据清单），三类攻击全覆盖：

| 攻击 | 目标 | 结论 | 仲裁 |
|---|---|---|---|
| A1 反证（时区/周界/浮点/趋势/脏点探针） | T1 | not_upheld（附 2 minor：单点无用例=F1、take:50 截断=F2；跨年周/周日归属/左闭右开/缺省剔除全部正确） | 采信，F1/F2 入停车场 |
| A2 反证（全脏点/空 timeline/ARCHIVED 归因探针） | T2 空周期结构 | not_upheld（三路径均返回合法空结构，逐字段与冻结 §2.4 一致） | 采信 |
| A3 反证（AppError 透传/logger 落 stderr/degraded 触发探针） | T3 降级 | not_upheld（404/401 不被吞；logger.error→console.error 真实非静默） | 采信 |
| A4 反证（越权 404 覆盖检索） | T4 | **upheld（major）**：冻结口径含「越权 404」，但锚点测试仅断言注册不发请求，全仓无本路由 404/401 用例，QA 判定口径缩水未披露 | **成立，审查端闭环**：补具名 404 测试（新测试绿 → 变异 C 移除守卫变红 → 还原），终态全量门禁复跑全绿；QA 侧口径缩水记入 §2-AC-07 披露 |
| A5 反证（修正区分度：去修正则 counts/trend 断言必失败） | T5 | not_upheld（断言有区分度；latest-wins 在 timeline 聚合前应用） | 采信 |
| A6 复跑（六门数值全独立复现） | T6 | not_upheld | 采信 |
| E1 时间线自洽（红<实现提交<QA 红<修复提交） | 证据抽查 | 声称成立 | 采信 |
| E2 终审证据未入库 | 报告本体 | upheld（审查时点 REVIEW.md/review-* 未 commit） | 属时序问题：终审提交（本提交）将报告与全部 review-*/review2-* 证据入库，AC-09 于最终 HEAD 成立 |
| E3 三个证据文件 0 字节 | 证据抽查 | upheld（minor） | 成立 → F5；审查端已出四要素补强版证据 |
| S1 范围攻击（numstat + smoke 逐段 diff + prisma 零触碰） | 越界改动 | not_upheld（纯插入、无断言删改放宽、01–38 段未动、schema 零触碰） | 采信 |
| E5 特别观察 | 过程 | 红队会话初期恰好拍到审查端变异 A 的临时篡改态（随后已还原） | 反向佐证变异测试真实执行且可咬合；无残留（tracked 树零 diff 已复核） |

—— 终审：代码审查节点，2026-10-11。终审配套证据：`docs/v0.8/evidence/review-*`（首轮@c488aca）+ `review2-*`（终态，含五门 rc、四要素扫描补强、T4 补验、变异 C 红证）。
