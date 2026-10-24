# 才艺养成移动端证据链 · 独立终审复核记录

- 复核人：主策划（独立复核，不复用取证方/验收方结论，全部证据本人重新实测）
- 复核时间：2026-10-24（分支 `myrd/talent-nurture-goal-cmvm1gjst0009m9gbzqvja0ji`，复核基线 HEAD=`5f729c7`）
- 复核对象：才艺养成 Demo「星光练习生：才艺养成物语」移动端机器门禁证据链
- 复核依据：知识文档《小游戏移动端模拟门禁取证 SOP》（id=388a1c2e-492e-4c1f-8fc1-e3227c1a201e）

## 一、四项核对结论

### ① report.json 存在且 verdict=PASS —— ✅ 通过
- 落点：`games/talent-nurture/qa/mobile/report.json`（10,841 字节，generatedAt=2026-10-24T09:12:26.326Z）
- `verdict: "PASS"`；`summary: 9/9 passed / 0 failed`，`failures: []`
- 九项 checks 逐一核对均 `pass: true` 且 detail 带可核查量化证据（命中坐标/尺寸/前后状态值）：network(30 请求 0 失败)、first-screen(359×48px 命中)、touch-start、viewport(scrollWidth=375)、touch-event(连点 3 次只计 1)、touch-train(vocal 10→16)、touch-pipeline(至结局 fail-return/8 场舞台)、hotzone(重叠 0 对/最矮 44px)、console(error=0 warning=0)
- 契约合规：`evidenceMethod.outOfScope` 显式声明主观体验「待用户试玩回填」，未代填主观结论（符合 SOP「机器判定 ≠ 使用验收」边界）；`conclusion` 写明移动端 fail-return/0 分与桌面歌姬结局/76 分的差异成因是玩法路径非端上缺陷（SOP §9）

### ② 分阶段截图 ≥3 张且 digest 可回放 —— ✅ 通过（6 张，独立重算全对）
- 截图 6 张 ≥3：`01-title / 02-intro / 03-event-choose / 04-week-board / 05-stage-result / 06-ending`，命名符合 SOP 六阶段基线
- **独立重算 sha256**（本复核自算，非转录 report）与 `screenshotDigests` 逐条比对：6/6 精确一致，bytes 逐项一致：

| 文件 | 独立重算 sha256 | bytes | 尺寸 | nonBlank |
|---|---|---|---|---|
| 01-title.png | dbbd3c2f42fafcebc5085cd58f301cbb86121fb32dce3753b1e73ccc60b7e6a0 | 233926 | 750×1440 | true(162) |
| 02-intro.png | e91d2a63496936b4ded6c57fc59b584233f9b26b7ac62f9ddefe60bacfd81f55 | 131679 | 750×1440 | true(150) |
| 03-event-choose.png | 1a2cf197fb53439d72be68f8ecb45981476d0010bc920469bb6a3ee1dd4b02fd | 102422 | 750×1440 | true(141) |
| 04-week-board.png | a4c2e5ac81bc1ffd2939e6d55d749340ba5569d40ebf2eb43348290b2363ab17 | 210555 | 750×1440 | true(146) |
| 05-stage-result.png | f62ef9323f67fb1188a1a3bdca1fe22ef976bca4b99ee6b32bbac02828742c6d | 102666 | 750×1440 | true(107) |
| 06-ending.png | 9da582142d18d691c0454e759dcb3fcbef9c6fe210b04d887723997b7396d7f5 | 145880 | 750×1440 | true(148) |

- digest 采样字节多样性 107~162 均 >32（SOP 非空白阈值），无 BLANK 告警；工作区截图与 git 链上内容一致（无未提交改动）

### ③ git 提交在案（脚本+截图+report 同一提交链）—— ✅ 通过
- 收口提交 `5f729c7`（2026-10-24 17:16:31 +0800）单提交内含：`tools/smoke-mobile.mjs`（含两处口径缺陷修复）、`tools/annotate-report.mjs`、`qa/mobile/report.json`、`05/06 截图`
- 前置提交 `19356d7` 含 `01-04 截图`（字节在 5f729c7 未变）——两提交同属本功能线一条提交链，证据链最终状态收敛于 `5f729c7`
- 工作区核对时发现 `qa/mobile/acceptance/replay-steps/`（使用验收节点 10 张分步回放截图）当时未跟踪、未提交——**本复核已将其归档入链**（见下「缺口处置」），补齐后链上证据完整

### ④ 与线上 liveUrl 版本一致 —— ✅ 通过（6/6 抽验逐字节一致）
- 线上地址：`https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/`（report.target.liveUrl 同值）
- 抽验 6 个关键资产：线上 `…/api/public/assets/<f>` http=200，sha256 与仓库导出产物 `games/talent-nurture/export/web/<f>` 逐字节一致：

| 资产 | sha256 前 12 位（local = remote） |
|---|---|
| main.mjs | 2dea0aa57ca1 |
| style.css | b968c1b86d02 |
| systems/ending-judge.mjs | 39c22eb707d2 |
| levels/prologue.mjs | 8ac33d1beaed |
| scenes/stage-live.mjs | 30351d6a7971 |
| data/endings.mjs | ca9d9ff4e3c9 |

- 覆盖入口/样式/核心系统/关卡/场景/数据六类，线上部署 = 仓库 HEAD 导出产物，report 的取证对象与当前线上版本无漂移

## 二、复核中发现的缺口与处置

| # | 缺口 | 定性 | 处置 |
|---|---|---|---|
| 1 | `qa/mobile/acceptance/replay-steps/` 10 张使用验收分步截图未跟踪未提交 | 证据链归档缺口（产物本身合规） | 本次复核 commit 一并归档入链 |
| 2 | `/goals/:id/artifacts` 直写接口不存在（POST/PUT 均 404） | 平台机制：artifacts 由 assign_agent 节点完成时自动落账 | 复核结论随本节点执行产物自动落账 goal artifacts；物理证据以本报告+归档 commit 为准 |

## 三、终审结论

**机器可判项四项复核全部通过**：report 存在且 PASS 9/9、6 张分阶段截图 digest 独立回放全对、脚本+截图+report 提交链完整在案、线上 liveUrl 与仓库 HEAD 导出产物逐字节一致。

「才艺养成玩法目标」的**机器可判定证据链收口成立**。按红线，主观体验（好不好玩/画面审美/四问量表）不在机器取证范围，`evidenceMethod.outOfScope` 已显式声明**待用户试玩回填**——目标最终达成与否的裁决权在目标 owner（@MyRD Admin）人工拍板，本复核不代行。

## 四、证据索引

- 机器门禁报告：`games/talent-nurture/qa/mobile/report.json`（verdict=PASS 9/9，digests 6 条）
- 分阶段截图：`games/talent-nurture/qa/mobile/01-title.png … 06-ending.png`
- 使用验收回放截图：`games/talent-nurture/qa/mobile/acceptance/replay-steps/step01~10.png`
- 取证脚本：`games/talent-nurture/tools/smoke-mobile.mjs`（判定）+ `tools/annotate-report.mjs`（元数据增补，幂等）
- 归档提交链：`19356d7`（01-04 截图）→ `5f729c7`（脚本修复+report+05/06+annotate）→ 本复核提交（acceptance 归档+本报告）
- 线上入口：https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/
- SOP 权威基准：知识文档 id=388a1c2e-492e-4c1f-8fc1-e3227c1a201e
