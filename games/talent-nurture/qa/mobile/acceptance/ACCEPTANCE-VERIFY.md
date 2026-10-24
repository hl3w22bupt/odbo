# 才艺养成移动端门禁证据 · 独立验收包（使用验收）

- 验收执行：使用验收 agent（不信任实现方自述，全部独立复核）
- 验收时间：2026-10-24 17:10–17:40 (+0800)
- 被验证据钉版本：分支 `myrd/talent-nurture-goal-cmvm1gjst0009m9gbzqvja0ji` @ commit `5f729c7`（与远端 HEAD 一致）
- 被验对象：`games/talent-nurture/qa/mobile/report.json`（sha256 `a10c97a44679e63e42d2e1c8388cd2e148f1e0fa3c7718322ba3474a4b707519`）+ 6 张分阶段截图
- 线上地址：https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/（入口 308 规范化 → 200）

## 六项核验矩阵（机器可判项）

| # | 项 | 结论 | 关键证据 |
|---|---|---|---|
| ① | report.json 存在且 verdict=PASS | ✅ | verdict=PASS，checks 9/9 过，failures=[]，summary.failed=0；完整读原文（含 reproNote/evidenceMethod/screenshotDigests） |
| ② | 分阶段截图齐全且与报告阶段对应 | ✅ | 6/6 在库；sha256 与报告 screenshotDigests **逐一吻合**（01-title 233926B … 06-ending 145880B）；视觉抽查 4 张（01/03/04/06）内容与阶段名一致，04-week-board 的数值状态（心情81/唱功10/舞技10/行动5/5、非教程动作置灰）与 touchLog 自洽 |
| ③ | sha256/commit 溯源到 talent-nurture 分支 | ✅ | 报告内含 6 条截图 sha256；报告本体 sha256=`a10c97a4…` 于 commit `5f729c7` 入库，`git show HEAD:` 与工作树字节一致；本地=远端 HEAD（FETCH_HEAD 同步核验） |
| ④ | liveUrl 可达 | ✅ | 裸 URL → 308 → `…/apps/talent-nurture` → **200**（2877B，跟随重定向后判定）；入口 html 与本地 `export/web/landing.html` sha256 一致（`fc933642…`） |
| ⑤ | 关键资产经 api/public/assets/* 通道可达 | ✅ | 抽 10 个资产（style.css/main.mjs/numeric.mjs/levels/prologue.mjs/data/events.mjs/endings.mjs/events-placed/events-conditional/systems/event-engine/scenes/ui）**全 200 且与本地导出字节级一致**——线上部署=当前 HEAD 版本，验收无对象漂移 |
| ⑥ | 序章双事件流程完整走通不中断 | ✅ | 独立 headless 会话（experience-harness sessiond，390w 视口）实测：标题→序章 intro→**事件1「室友初见」触发→选「交换联系方式」→徽标「+5 心情」**→**事件2「第一套练习服」接力触发→选「对着镜子练一个定格」→徽标「+3 舞技 +2 压力」**→周面板状态落账（心情75=70+5、舞技13=10+3、压力2=0+2）→教程三步→试镜结算 20 分·及格（复算 10×0.5+13×0.35+71×0.15=20.2→20；<30 过线靠 `tutorialProtect:true`，与源码一致）→第 1 周「深夜加练的诱惑」照常触发，全程无中断 |

## 移动端门禁结论

`smoke-mobile.mjs` 375×720 移动仿真 9 项检查全过：网络资产全 200、首屏可点、touch 管线全程推进至结局、scrollWidth 不超视口、分支选项连点 3 次只计 1 次（独立复测亦见选项点击后 disabled=true）、热区无重叠最矮 44px、console 零 error 零 warning。**门禁 PASS 成立。**

## 如实记录的瑕疵与观察（不粉饰）

1. **证据生成期间发生过 FAIL→PASS 覆写**：auto-commit `19356d7`（17:09）入库的是 FAIL 版报告（network/touch-pipeline 两项败、stageVisits=823）；前序「收口」节点随后修复 `smoke-mobile.mjs` 两处口径缺陷（tapSelector 不跳过 disabled 按钮、html 入口 308 形态判漏）并于 17:12 复跑得 PASS、17:15 补注 digest 后以 `5f729c7` 收口。本验收钉住的是修复后版本；FAIL→修复→PASS 的因果链在报告 `reproNote` 与两版报告 diff 中互证，属实。
2. **门禁 PASS 局的结局是 fail-return（BAD END）、公演 0 分**：为合法游戏结局（12 周终局体力不足按规则弃权），与桌面 LIVE SMOKE（歌姬结局/公演 76 分）差异源于脚本玩法路径而非端差异——报告 conclusion 已自述，本次复核认可；但该局不构成「正面结局可达」的证据（正面结局由 qa/live 取证另行覆盖）。
3. **周末结算固有衰减**：结束本周时 心情-4/压力-3（`scheduler.settleWeek` × `numeric.RECOVERY.weeklyMoodDecay=4 / weeklyStressDecay=3`），实测 75→71、2→0 与源码一致，非缺陷。
4. **取证方法论**：experience-harness 会话守护进程 stop/TTL 均回收临时截帧目录——留证必须「随走随存」，本验收第三轮回放帧因映射错位作废，第四轮逐状态即时落盘（`replay-steps/v01–v10`，10 帧哈希互异）。

## 待用户回填（不代填）

- 主观体验（好不好玩/画面/文案）与目标级验收中的**真机专项**（iOS Safari / Android Chrome 实测触摸热区与滚动穿透）仍需用户真机试玩后回填；本包仅覆盖机器可判项。
- 线上入口：https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/

## 本包文件清单

- `ACCEPTANCE-VERIFY.md`（本文）
- `replay-steps/v01…v10.png`：第四轮独立复测逐状态截帧（标题/序章/双事件题面与结果/周面板/试镜确认/试镜结算/第 1 周续接）
