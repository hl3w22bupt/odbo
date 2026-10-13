# 心伴 v0.10 P0 · 独立验收报告（节点间审查）

验收对象：本分支 `45560cb`（feat v0.10）+ `0f9c681`（docs）全部产出；契约基线 `docs/v0.10/REQUIREMENTS.md`（FROZEN）。
验收方法：平台 Verification 六阶段流水线（S1 标准解析 → S2 证据采集 → S3 逐条核验 → S4 红队对抗 → S5 评分结论 → S6 报告落盘）；结构化报告 `evidence/verification-report.json`（已过 `validate-report.mjs` 出口门禁，validator 独立重算一致）。

## 结论速览

| 项 | 值 |
|---|---|
| 评分 | **95**（加权：18.0 / 19，pass 9 / partial 1 / fail 0 / unverified 0） |
| 结论 | **NEEDS_WORK**（唯一差距：AC-07 红绿证据链，见下） |
| 六项门禁实测 | build / test(158) / smoke(51) / persist(9) / deploy / 发布后 smoke **全 0，全绿** |
| 技术实现判定 | **通过**（三类封顶、值级一致、三层用例、枚举闭合、UTC+8 周界、空态/降级契约、范围纪律全部实测成立） |
| 修改意见 | 1 项已由验收方闭环（证据补证），2 项 minor 留档给后续版本 |

## 逐条判定（S3）

| # | 标准 | 权重 | 判定 | 关键证据（全部亲测/亲读，非转述自述） |
|---|---|---|---|---|
| AC-01 | 三类洞察值级一致 | core 2 | pass | server lib 独立重算 `toEqual`；smoke 50 为 jq `.value == {...}` 全值断言；变异（平票优先级反转）→ 1 failed，断言有牙齿 |
| AC-02 | 三层独立用例 | core 2 | pass | lib 11 条（正常/空态/降级三 describe）+ 路由 7 条含独立空态/降级用例；全量 158 条 exit 0 |
| AC-03 | 输出稳定 + 黄金用例 | 1 | pass | 双端稳定用例 + golden 全结构 `toEqual` |
| AC-04 | 枚举闭合 + 第 4 类判红 | core 2 | pass | 双重变异穿透双层防御后判红用例变红（1 failed \| 9 passed），判红真实有效 |
| AC-05 | UTC+8 周界双端 | core 2 | pass | 周日 23:59:59 CST / 周一 00:00:00 CST 双向 + 错配周期空态，两端固定时钟 |
| AC-06 | 兼容回归 | core 2 | pass | 验收方逐项复跑：TEST_EXIT=0（112+46 与声称逐项一致）、BUILD=0、SMOKE=0（51/51）、PERSIST=0（9） |
| AC-07 | 红绿证据真实且与索引一致 | core 2 | **partial** | 6 条红绿文件中 5 条真实；`red-server-lib.txt` 原实物仅 `RED_EXIT=0`（零失败输出），原索引描述错位 + 时间线自述与实物矛盾 → **RT-01 major upheld 降级**；已补真实红（`REAL_EXIT=1`）并修正索引 |
| AC-08 | 范围外 diff 拒收 | core 2 | pass | v0.7 渲染三文件 + prisma schema 零 diff；smoke.sh 仅追加 49-51（基线断言零改动）；技能文件属平台自动提交 `ca20551` |
| AC-09 | 空态/降级契约 | core 2 | pass | 空态 200 合法结构；降级 200 + `logger.error`（变异删除该调用 → 用例红，留痕断言有牙齿）；AppError 直抛保留 401/400 |
| AC-10 | deploy + 发布后冒烟闭环 | core 2 | pass | 亲测 DEPLOY_EXIT=0 + 发布后 51/51 POST_SMOKE_EXIT=0（RT-02 minor 保留：冒烟为源码级复跑口径） |

## 红队对抗（S4，独立子 agent + 本机变异双通道）

| # | 攻击 | 严重度 | 裁决 |
|---|---|---|---|
| RT-01 | `red-server-lib.txt` 实物 `RED_EXIT=0` 与索引声称矛盾；时间线自述被实物戳破（red-route `Start at 07:44:47` 晚于声称绿起点 07:43；red-mobile mtime 07:48 超窗；green 批量 07:54 落盘无时间戳） | **major** | **upheld** → AC-07 降 partial；验收方补证 `red-server-lib-verified.txt`（真实红：`Cannot find module` + exit 1）并修正 `RED-GREEN.md` |
| RT-02 | 「发布后冒烟」实为源码级复跑（dev:standalone + 临时 SQLite），非对部署 dist 实例冒烟 | minor | upheld，不改判（v0.9 以来既有口径，deploy 脚本本身已验 dist 启动 + /health + 复验，未降低标准） |
| RT-03 | 第 4 类判红疑依赖双层防御（单点变异 default 放行不红） | minor | overturned——双重变异穿透后判红用例变红，系防御深度冗余设计而非测试无效 |
| RT-04 | diff 含契约外文件（.gitignore、平台技能文件） | minor | overturned——技能文件归属 `ca20551` 平台自动提交；.gitignore 为工具链良性修复，记 minor 备注 |

未覆盖攻击面（留档）：并发重复请求下洞察端点行为；超大数据量下 `correctedSamplesInPeriod` 性能（当前 O(n) 可接受）。

## 缺陷与修改意见（按优先级）

1. **【已闭环·还账】AC-07 证据纪律**：上游 server lib 层先红证据失真（`RED_EXIT=0`）+ 索引描述错位 + 时间线自述错误。验收方已补真实红 `evidence/red-server-lib-verified.txt`、修正 `evidence/RED-GREEN.md`（修订说明标注原错误）。**修改意见：后续版本红证据随跑随存（红命令的 stdout+退出码一次落盘，勿事后补写包装行）；索引描述必须与实物逐字节对应。**
2. **【minor·建议】**（RT-02）后续版本可将发布后冒烟指向已部署 dist 实例（复用 15888 端口 + deploy db），使「发布后闭环」字面与实质一致。
3. **【minor·知悉】** ChatScreen 契约表述「一行挂载」实际为约 7 行最小增量（一次取数 + 一处挂载 + state），语义符合、字面超出行数；`.gitignore` 增 `/node_modules/` 为契约外良性工具链修复。两者均不构成范围违规。

## 复跑门禁记录（验收方本机，2026-10-13）

| 门禁 | 退出码 | 与上游声称比对 |
|---|---|---|
| `npm test` | 0 | server 21 文件 112 条 + mobile 7 文件 46 条，与 QA-ACCEPTANCE 逐项一致 ✓ |
| `npm run build` | 0 | 一致 ✓ |
| `npm run smoke` | 0 | 51/51（46 步骤 coverageDays=1 实测证实 v0.9 文档漂移修正属实）✓ |
| `npm run persist:check` | 0 | 9 项 ✓ |
| `npm run deploy:v02` | 0 | dist 启动 + /health + 复验 build/start/test=0 ✓ |
| 发布后 `npm run smoke` | 0 | 51/51 ✓ |

摘要归档：`evidence/review-rerun-gates.log`；过程日志 digest 见 `evidence/verification-report.json`。

## 判定说明（为何 95 分仍是 NEEDS_WORK）

按 Verification 确定性规则，CERTIFIED 要求 `partial=0`；AC-07 因 RT-01 major upheld 记 partial，结论机械落 NEEDS_WORK。该 partial 反映的是**上游交付时的证据归档失实**（过程缺陷），非技术实现缺陷——技术实现 9 项全 pass、六门禁全绿，且证据链已由验收方补证修复至完整。下游节点无需重做任何实现；本轮验收产出（本报告 + 补证 + 索引修正）即还账闭环。
