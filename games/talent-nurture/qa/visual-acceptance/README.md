# 使用验收：v+1 视觉升级线上实测证据包（qa/visual-acceptance）

> 取证时间 2026-10-25，独立使用验收 agent 对线上 liveUrl 实测。
> 线上部署：`cmvn7x4aq008gm9gbbyl8zy3z` @ build `183a2f9`（`/health` version=`v2-visual-1`），
> 版本核验：15 个关键资产 sha256 与本地 HEAD（c835113）导出逐一一致——验收对象无误。
> 纪律：harness 只产证据；本包机器可判项给确定性结论，主观体验一律待 owner 回填。

## 一句话结论

**不全绿**：人物六态动画、序章 cine 开场、结算滚动/浮字/四档分色、舞台四方案灯效、
唱/舞养成闭环与移动端可玩性全部线上实证 PASS；但 **v+1 策划案②「分支事件 420ms 幕布过场」
从未可见（缺陷 V1）**——按任务口径退回「实现玩法」返工这一项，其余达标。

## 目录结构

```
qa/visual-acceptance/
├── README.md                        本文件（结论与索引）
├── findings.json                    结构化验收发现（12 项机器判定 + 缺陷 + 覆盖缺口）
├── anim/                            人物动画帧序列
│   ├── idle-breathing/              待机呼吸 8 帧 + idle-breathing.gif + manifest
│   ├── train-vocal/                 训练态+汗滴 8 帧 + train-pose-sweat.gif
│   ├── train-dance/                 舞蹈特训汗滴循环 6 帧
│   ├── social-celebrate/            庆祝态瞬态 7 帧 + celebrate-pose.gif
│   ├── rehearsal-dance/             彩排舞蹈态 7 帧（探针语法错误，帧有效）
│   └── ending-screen/               结局页庆祝态 8 帧
├── transitions/                     过场与结算
│   ├── prologue-cine-opening/       序章 cine 开场 12 帧 + prologue-cine.gif
│   ├── ev-roommate-choice-reveal/   事件选项效果揭示（panelIn+badgePop）8 帧
│   ├── ev-costume-choice-reveal/    同上 8 帧
│   ├── ev-midnight-choice-reveal/   同上 6 帧
│   ├── ev-birthday-choice-reveal/   同上 6 帧
│   ├── to-week-board/               事件→周板转场 6 帧
│   ├── stage-result-score-roll/     结算评分滚动（5→30）12 帧
│   ├── stage2-inner-score-roll/     结算滚动（8→49）12 帧
│   ├── stage4-debut-score-roll/     首秀滚动（8→61）+ 粉丝浮字 14 帧 + stage-score-roll.gif
│   └── finale-score-roll/           公演结算 70 分·良好 14 帧 + finale-result.gif
└── loop/                            （空，闭环证据以 transitions/ 与 findings.json 承载）
```

每个 burst 目录含 `burst-manifest.json`：逐帧 sha256 / 字节数 / 探针值（DOM 动画名、时长、
computed transform、粒子计数等）。**帧间哈希互异 = 画面真实在动；全同 = 静止**——这是
「动画 vs 静态贴图」的直接判据（工具只记录，判读见 findings.json）。

## 机器可判项速览（详见 findings.json）

| # | 项目 | 结论 | 关键证据 |
|---|------|------|---------|
| 1 | 待机呼吸 | **PASS** | 8/8 帧异；poseIdle 2.4s running；translateY -2.80→-0.004→-2.88→-0.055 正弦轨迹 |
| 2 | 训练态+汗滴 | **PASS** | poseTrain 0.8s；汗滴 opacity 0→0.98→0 循环；行动 5→4 真实推进 |
| 3 | 庆祝态 | **PASS** | 社交→粉丝 0→15 + poseCelebrate ~650ms→自动回切；结局页同态 |
| 4 | 演唱态 | **PASS** | 三场结算页 pose-sing 连续帧 |
| 5 | 舞蹈态 | PARTIAL(C2) | 帧序列有、computed 佐证因探针笔误缺 |
| 6 | 序章 cine 开场 | **PASS** | 12 帧：黑边 2+颗粒+透黑+缓推挂载 7 帧→时序收尾 |
| 7 | **事件幕布过场** | **FAIL(V1)** | 幕布挂载 0.1ms 即被 clear(root) 移除（两次 MutationObserver 独立记录），从未可见 |
| 8 | 结算滚动/分色/浮字 | **PASS** | 三场滚动序列 + t-pass/t-good + 「💗 +107」浮字实拍 |
| 9 | 彩带/灰烬粒子 | NOT-COVERED(C1) | pass 档按设计无粒子；good 档两次错过连发窗口 |
| 10 | 舞台四方案灯效 | **PASS** | 1 束/3 束/VS=1/灯海 56 点/公演 40 点全线上实测 |
| 11 | 唱/舞闭环+移动可玩 | **PASS** | 12 周通关 GOOD END B；≥10 个分支事件；防重/体力边界/重开无残留 |
| 12 | 证据落盘 | **PASS** | 本包 + tools/burst-capture.mjs 随分支归档 |

## 缺陷 V1（退回返工项）

**现象**：任意分支事件触发时的 420ms 幕布过场肉眼不可见。
**根因**：`src/main.mjs` render() 的 event 分支先 `curtain(root)` 挂幕布，
`renderEventDialog`（`src/scenes/event-dialog.mjs:14`）第一行 `clear(root)` 立即清空——
幕布存活 0.1ms（同 tick 同步移除，未及任何绘制帧）。
**复现**：MutationObserver 两次独立事件转场记录 added→removed 均 0.1ms
（t=1108156.6→1108156.7、1224886.8→1224886.9）。
**对照**：序章 `introCinematic(root)` 在 renderIntro **末尾**调用，故正常工作。
**修复建议**：把 `curtain(root)` 移到 `renderEventDialog(...)` 之后调用（对齐序章模式），
或让 renderEventDialog 不做全量 clear。curtain() 函数与 curtainL/R CSS 本身无缺陷。

## 主观项（待 owner 回填，不在机器取证范围）

- 画面审美 / 动效手感 / 好玩程度 / 四问量表：试玩入口 https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/
- 真机专项（iOS Safari / Android Chrome 实测、热区、滚动穿透）：待真机执行

## 复跑方式

```bash
# 1) 起 experience-harness 会话（375w 级移动仿真）
.claude/skills/experience-harness/scripts/sessiond.mjs --url <liveUrl> --viewport mobile
# 2) 连发截帧（复用会话的 Chrome CDP 端口）
node games/talent-nurture/tools/burst-capture.mjs --port <CDP端口> \
  --out <目录> --frames 8 --interval 300 [--tap x,y] [--probe '<js 表达式>']
# 3) 动图合成（PIL）
# 4) 判定对照 findings.json
```
