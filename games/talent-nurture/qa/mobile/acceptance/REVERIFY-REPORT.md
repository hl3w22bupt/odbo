# 才艺养成移动端门禁证据 · 第二轮独立复核（使用验收）

- 验收执行：使用验收 agent（不信任实现方自述与首轮复核自述，全部重新取证）
- 验收时间：2026-10-24 17:30–17:55 (+0800)
- 钉定版本：分支 `myrd/talent-nurture-goal-cmvm1gjst0009m9gbzqvja0ji`（开始时 HEAD=66f245e，期间远端前移至 950d34f 已快进同步，被验证据 `5f729c7` 为两者共同祖先，证据对象无漂移）
- 被验对象：`qa/mobile/report.json`（sha256 `a10c97a44679e63e42d2e1c8388cd2e148f1e0fa3c7718322ba3474a4b707519`）+ 6 张分阶段截图

## 六项核验矩阵（机器可判项，全部独立重取证）

| # | 项 | 结论 | 本次独立证据 |
|---|---|---|---|
| ① | report.json 存在且 verdict=PASS | ✅ | 完整读原文全文（279 行）：verdict=PASS、checks 9/9、failures=[]、summary.failed=0；工作树与 HEAD `git show` 字节一致 |
| ② | 分阶段截图齐全且与阶段对应 | ✅ | 6/6 重算 sha256 与 report.screenshotDigests **逐一吻合**（bytes 亦同）；阶段命名 01-title…06-ending 与 SOP 六阶段基线一致 |
| ③ | sha256/commit 溯源 | ✅ | report 于 `5f729c7` 入库（该提交 ∈ talent-nurture 分支且 ∈ 远端 HEAD）；6 截图同提交归档；本轮另以 29 资产字节级比对反证线上部署=HEAD 导出 |
| ④ | 线上 liveUrl 可达 | ✅ | `…/apps/talent-nurture/` → 网关 308 规范化 → 无尾斜杠形态 **200 text/html**（2877B，curl -L 跟随后判定）；入口 html 与 `export/web/landing.html` sha256 一致（`fc933642…`） |
| ⑤ | 关键资产经 api/public/assets/* 通道 | ✅ | **全量 29 个资产**（非抽样）逐一 curl：全 200 且与 `export/web/` 同名文件**字节级一致**（含 style.css/main.mjs/5 scenes/6 levels/8 systems/4 data） |
| ⑥ | 序章双事件完整走通不中断 | ✅ | **两次独立 headless 会话**（experience-harness sessiond 真实触摸管线）复测：`ev-pro-roommate`（室友初见）→选「交换联系方式」→mood 70→75、flag `befriendedZhouyu=true`→「继续」接力→`ev-pro-first-costume`（第一套练习服）→选「对着镜子练一个定格」→dance 10→13、stress 0→2→`fired` 全程恰 2 次无重复触发→周面板落账与 `events-placed.mjs` effects **同源复算全吻合**→教程 5 行动→试镜确认（体力 64≥25）→结算 32 分·及格（29×0.5+14×0.35+83×0.15=31.85→32，与首屏公示公式一致）→第 1 周「深夜加练的诱惑」照常触发，**全程无中断** |

## 移动端门禁结论

`smoke-mobile.mjs` 375×720 移动仿真 9/9 PASS 成立（网络全 200、首屏可点、touch 管线至结局、连点防重、热区无重叠最矮 44px、console 零 error 零 warning）。本轮以双会话独立复测交叉印证，**门禁 PASS 与六项验收全部维持全绿**。

## 如实记录的瑕疵与观察（不粉饰）

1. **report 内部一处数字口径瑕疵**：`network.totalResponses=31` 与 `checks.network.detail` 文案「请求 30 个」差 1（疑似 detail 生成时窗口内少计 1 个非资产请求）。不影响 PASS 判定（failures=[] 与 assets 28 条全 200 为硬数据），但 detail 文案与 totalResponses 应同源，供下轮取证脚本修正。
2. **证据生成史含 FAIL→PASS 覆写**：`19356d7`（17:09 auto-commit）曾入库 FAIL 版报告（stageVisits=823 卡死）；`5f729c7` 收口为修复后 PASS 版，因果链在 reproNote 自述且两版报告 diff 互证，属实非篡改。
3. **门禁 PASS 局结局为 fail-return（公演 0 分）**：12 周终局体力不足按规则弃权的合法 BAD END，与桌面 smoke（歌姬结局 76 分）差异源于脚本玩法路径；该局不构成「正面结局可达」的证据（由 qa/live 歌姬结局取证另行覆盖）。
4. **本轮取证过程自我瑕疵（记录在案）**：第一会话收尾时因「事后从时序目录挑帧」发生帧名错配、并误删唯一试镜结算帧；已用第二会话以**状态驱动即时存帧**重拍 r08/r09 修复。教训固化为：回放留证必须 phase 变化即存、以状态命名，禁止事后凭时序猜帧。
5. **复测视口口径**：本轮双会话为 harness 默认视口（clientWidth=390，无横向溢出 scrollWidth=390）；375w 视口/热区/溢出的门禁级判定以 report.json（375×720 @2x）为准，本轮为其交叉印证而非替代。

## 待用户回填（不代填）

- 主观体验（好不好玩/画面审美/文案）与**真机专项**（iOS Safari / Android Chrome 实测触摸热区、滚动穿透）仍需用户真机试玩后回填。
- 线上入口：https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/

## 本包文件清单

- `REVERIFY-REPORT.md`（本文）
- `replay-steps/v01…v10.png`：首轮复核（950d34f）逐状态帧，本轮哈希比对确认未被动过
- `reverify/r01…r10.png`：本轮两次独立会话复测帧（哈希互异、名实相符、视觉复核通过）：
  r01 标题 / r02 序章 intro / r03 事件1题面 / r04 事件1结果(+5心情) / r05 事件2题面 / r06 事件2结果(+3舞技+2压力) / r07 周面板落账(75/13/2) / r08 试镜确认(64≥25) / r09 试镜结算(32分及格) / r10 第1周事件续接
