# 心伴 v0.3「核心交互价值闭环」质量验收审查报告

- 审查轮：五节点接力第 4 站（质量验收 / 代码审查）
- 审查对象：基线确认（`docs/smoke/v0.2-base.md`）、范围冻结（`docs/v0.3/DEVELOPMENT.md`）、增量实现（24705b3..88e6e52 共 7 个交付提交）、冒烟文档（`docs/smoke/v0.3.md`）
- 审查方法：平台 Verification skill 六阶段流水线（S1 标准解析 → S2 证据采集 → S3 逐条核验 → S4 独立红队对抗 → S5 确定性评分 → S6 报告落盘 + 出口门禁）
- 结构化报告：[`verification-report.json`](./verification-report.json)（已过 `validate-report.mjs` 门禁）· 渲染版 [`verification-report.md`](./verification-report.md) · 证据固化 [`evidence/`](./evidence/)
- 审查日期：2026-10-04

## 1. 结论

**NEEDS_WORK（73/100）—— 有修改意见的通过：四条阻塞级判定全部未触发，不构成打回；但存在 4 项 upheld major（3 项为验收锚点强度缺口、1 项为注入安全位置），列出必修清单 M1-M4，建议在进 deploy 前或紧随 deploy 的第一个修复轮内清偿。**

| 项 | 结果 |
|---|---|
| 阻塞级① 持久性回归不过 | **未触发**：验收侧独立复跑 `npm run persist:check` exit 0（P01-P09 全绿，含 P05 kill → P06 重启 → P07/P08 读回一致 → P09 写失败降级断言） |
| 阻塞级② 死测试处置栏缺失或三态无口径 | **未触发**：处置栏存在且有口径（基线 0 个 → 修 0 / 删 0 / 缓 0）；验收侧以更宽口径全仓重扫复核为 0 |
| 阻塞级③ 冒烟 v0.3 段缺增量步或 deploy 段未记重跑退出码 | **未触发**：基线/增量(14-19)/deploy 三段齐全，每步有断言内容与锚点；deploy 段已记本地五门重跑退出码均 0 |
| 阻塞级④ 提交说明与 DoD 验收项对不上 | **未触发**：7 个交付提交逐一标注「验收项：V3-x + 锚点」，与冻结 DoD 六条一一对应 |

判定分布：pass 3（AC-03 跨重启持久 / AC-05 冒烟全局项 / AC-06 死测试处置），partial 3（AC-01 / AC-02 / AC-04，均因红队 major upheld 按仲裁规则降级），fail 0，unverified 0。

## 2. 三点一线核销（验证锚点 → 测试名 → 运行结果）

核销方式：解析 DoD 冻结表每条锚点 → grep 测试源码确认测试名存在 → 验收侧独立复跑并核退出码。

| DoD | 锚点指认的测试名/脚本 | 测试名存在 | 实跑结果 | 核销 |
|---|---|---|---|---|
| V3-1 | `chat.routes.test.ts > exposes the conversation memory read API / serves the explicit empty memory state... / degrades the memory read...`；`conversationInsights.test.ts > returns an explicit empty state...`；smoke 14/15/18 | ✅ 全部存在 | `npm test` exit 0（server 7 files/32 tests）· smoke 19/19 | ✅ |
| V3-2 | `chat.routes.test.ts > exposes the structured mood timeline read API / serves the explicit empty mood timeline... / degrades the mood timeline...`；`insights.test.ts > asserts timeline content instead of pixels`；smoke 16/17/19 | ✅ 全部存在 | 同上 · smoke 19/19 | ✅（口径强度见 M2） |
| V3-3 | `scripts/persistence-regression.sh` P01-P08 | ✅ 脚本存在 | `npm run persist:check` exit 0，P01-P08 全绿 | ✅ |
| V3-4 | `conversationInsights.test.ts > maps a memory write failure to the degraded read contract`；persist P09 | ✅ 存在（P09 以 `vitest -t` 指认同名测试） | exit 0 · P09 绿 | ✅（证明力见 M1） |
| V3-5 | `npm run smoke`；`docs/smoke/v0.3.md` | ✅ — | exit 0，末行「19 项 / 19 项」逐字匹配 | ✅ |
| V3-6 | `docs/smoke/v0.2-base.md` 死测试处置栏；全仓 grep | ✅ — | 验收侧重扫 0 标记 | ✅ |

**未发现「锚点指不到测试名」的条目**——六条 DoD 的三点一线全部闭合。下述 M1/M2/M3 是锚点**证明力**问题，不是锚点缺失问题。

## 3. 死测试三态核销

- 处置口径：基线 0 个 → **修 0 / 删 0 / 缓 0**（`docs/smoke/v0.2-base.md`，含根因归类说明：未发现断言过期/用例失效/环境依赖）。
- 验收侧独立复核：以 `\.skip\( | \.only\( | \.todo\( | \bxit\( | \bxdescribe\( | skipIf` 及空测试体、断言密度（每文件 expect/it ≥ 1）三重视角全仓重扫（排除 node_modules）——**0 个真实死测试标记**（唯一命中为组件代码 `setOutfit(` 的 `fit(` 子串误报）。
- 三态计数可核：**修 0（无可修）/ 删 0（无可删）/ 缓 0（无缓交，故无复激活版本要求）**。
- 口径缺口（改进项 S3）：现有 grep 口径无法发现「永不失败」弱断言；本轮确实存在一处部分循环断言（见 M2），建议下轮把循环断言/断言密度检测纳入死测试处置口径。

## 4. 正确性 / 可维护性 / 规范符合度

正确实现（抽查确认）：
- 读写路径均有 `userId` 归属过滤，无越权读他人会话记忆；Prisma 参数化查询，无 SQL 注入面。
- 记忆提取使用**内容过滤后**的 `safeContent`（非原文），并做空白归一化 + 160 字截断。
- P1 快照严格从成功保存的 P0 记忆派生（`memoryId` 强关联，persist P04 断言生效）。
- 三态读契约（empty/ready/degraded）在 server 纯函数、HTTP 信封、mobile 视图函数三层一致；mobile 对 `null`/网络失败的回退落在 degraded，不展示脏数据。
- 空态/降级态为显式契约字段而非隐式空数组，前端不展示 QUARANTINED 与空白行。
- `set -euo pipefail` + trap cleanup，门禁脚本无残留进程（13888/13889 复跑后核验为空）。

规范符合度：
- ✅ TS 规范：interface 定义对象类型、联合类型代替枚举（`'ACTIVE'|'QUARANTINED'`、`ConversationMood`）、未见 `any`（测试辅助的 `as never` 为路由注册契约桩，可接受）。
- ✅ React 规范：每组件单文件、组件名与文件名一致、函数组件 + Hooks、Props 用 interface、无过度解构。
- ⚠️ React 性能规范：`MemoryPanel` / `MoodTimelinePanel` 为纯展示组件但**未用 `React.memo` 包裹**（项目 CLAUDE.md 明确要求）→ S1。

## 5. 红队对抗裁决（独立子代理，0 blocker / 4 major upheld）

 upheld（实证成立）：RT-01（P09 为单测复跑，写路径无进程级/路由级失败覆盖）、RT-02（memoryPoints 注入零测试锚点）、RT-03（记忆注入位于合规声明之后且无清洗；QUARANTINED 无写入方）、RT-04（serializeMood 断言循环 + classifyMood 零覆盖）。
 overturned（仲裁推翻）：RT-05（`"score":0.8` 在 Int 契约域外不可达）、RT-08（npm exec 使 tsx 为直接子进程，kill 真实生效且残留会 EADDRINUSE fail-loud）。
 范围攻击未命中：无删测试、无放宽既有断言、无越权、无注入面。

## 6. 修改意见清单

### 必修（M，建议进 deploy 前或紧随 deploy 的修复轮清偿）

- **M1（V3-4/AC-04）把写失败降级从「单测复跑」升为进程级证明**：在 `persistence-regression.sh` 增加进程级写失败注入步（如以只读 DB 文件/损坏 DATABASE_URL 启动旁路实例后调 `POST /chat/send`，断言响应 `memory.degraded=true`、后续 `GET /memory` 不含脏数据），或在 `chat.routes.test.ts` 补 `chatSend` 写失败分支的路由级测试；同步更新 P09 文案，使「硬门槛」名实相符。
- **M2（V3-2/AC-02）修复循环断言并补 classifyMood 单测**：`serializeMood` 测试改为**手写期望值**（不得由被测函数输出派生），覆盖 mood 别名归一、score 正负截断、keywords 串→数组；为 `classifyMood` 增加直接单测，至少覆盖 POSITIVE/NEGATIVE/NEUTRAL 三分支（当前 NEGATIVE 全仓零断言）。
- **M3（V3-1/AC-01）补记忆注入锚点**：为 `buildSystemPrompt` 增加 `memoryPoints` 断言（prompt 包含记忆行、≤20 条、无记忆时不出现记忆段），覆盖 V3-1「利用」半边。
- **M4（安全，RT-03）调整记忆注入位置并清洗**：将记忆段移到合规声明**之前**（或在注入前剥离指令样文本，如「忽略以上/ignore previous」类模式），并在 `DEVELOPMENT.md` 契约增量中固化为行为要求；同时为 QUARANTINED 写入路径给出明确归宿（接入内容审核 REPLACE 结果）或在注释中标注为 v0.4 预留。

### 建议（S，不阻塞，转停车场或顺手项）

- **S1**：`MemoryPanel` / `MoodTimelinePanel` 用 `React.memo` 包裹（项目 React 性能规范）。
- **S2**：`persistence-regression.sh` 的 `assert_contains` 与 smoke.sh 对齐改 `grep -qF`（当前 needle 恰好无正则风险，属隐患）。
- **S3**：死测试处置口径补「循环断言/零断言」检测视角（见 §3）。
- **S4**：`chat.ts` L363-364 `classifyMood(memory.content)` 调用两次，提取为局部变量（可维护性）。
- **S5**：`chat.routes.test.ts` 补越权 404 分支断言（他人会话 id 读取应 404），防回归删除 `userId` 过滤。
- **S6**：smoke 步骤 15 增补 `available:true` 断言，使同会话契约完整（当前靠步骤 18 部分弥补）。
- **S7**：`buildSystemPrompt` 文案「用户确认过的长期记忆」与实际「自动提取」不符，改为「从对话中记住的」避免误导模型与审计。
- **S8**：`docs/smoke/v0.3.md` deploy 段将「本地部署等价门」与「部署环境复跑」分列小节，避免误读（RT-07）。

## 7. 放行建议

1. **可以进入 deploy 节点**：四条阻塞级均未触发，本地五门（build/test/smoke/persist/start-standalone）exit 0 已由验收侧独立复核。
2. **deploy 闭环硬要求**：部署后必须在部署环境重跑 `npm run smoke` 并把真实退出码回填 `docs/smoke/v0.3.md` deploy 段（当前为待回填占位，回填前闭环留档不完整）。
3. **M1-M4 转下一修复轮**：建议以「修=绿+测试名被指认」三态口径逐条核销；M4 完成前不建议接真实 LLM provider。

## 8. 证据索引

| 证据 | 内容 |
|---|---|
| `evidence/gate-results.log` | 验收侧复跑四门禁退出码（全 0） |
| `evidence/gate-test.log` / `gate-smoke.log` / `gate-persist.log` | 测试 32+26 全绿 / 冒烟 19 项 / 持久门 9 项 |
| `evidence/anchor-tests.txt` | DoD 锚点测试名存在性 |
| `evidence/dead-test-scan.txt` | 死测试标记重扫结果 |
| `evidence/git-log.txt` | 交付提交与验收项对照 |
| `evidence/redteam-verification.txt` | 红队指控的核验侧复核记录 |
