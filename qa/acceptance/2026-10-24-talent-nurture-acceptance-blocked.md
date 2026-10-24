# 使用验收记录：才艺养成 Demo 线上实测

- 验收节点：`wf-sg-accept` 指派「使用验收」对才艺养成 Demo 线上实测并回写
- 执行时间：2026-10-24
- 执行方式：experience-harness 流程（只产证据不判定）+ 机器可判项确定性核查
- **结论：BLOCKED —— 验收对象不存在，实测无法开始**

## 一、为什么 BLOCKED（完整事实链）

验收的前置三要素（git 状态 / liveUrl·部署 / goal artifacts 现状）核查结果：

| # | 核查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | goal.liveUrl | **null** | `GET /api/v1/goals/cmvm1gjst0009m9gbzqvja0ji` → `liveUrl: null` |
| 2 | 上游构建节点 wf-sg-build | **failed** | workflowDag.nodes：`status: "failed"`，lastError 见下 |
| 3 | goal artifacts | 仅 2 条：design_spec（成功）+ run_workflow failed 记录 | 无任何部署 / hostedApp / 验收产物条目 |
| 4 | 部署记录 | 不存在 | `GET /hosted-apps?goalId=…`、`GET /goals/…/deployments`、`GET /projects/…/apps` 均 NOT_FOUND |
| 5 | Demo 工程文件 | 不存在 | `git log --all` 全分支仅 1 个 commit（b457a4d，与才艺养成无关）；全仓 grep `才艺 / talent.*nurture / starlight` 零命中；`apps/` 下只有既有 server / mobile 工程，无 Demo |
| 6 | 本地 vs 远端 | 同步 | 本地与 `origin/auto-team-evolve` 均指向 b457a4d，无落后提交——排除「后续节点已在前端继续提交并重部署」的情形 |

### 构建节点失败原文（lastError）

> 工作流「小游戏工坊流水线」缺少 run 参数：gameName, gameGenre, gamePitch, gameDecisions, referenceImage, repoUrl, goalBranch, gamePath, hostedAppId, hostedAppSlug, liveUrl, goalId, smokeFrames。该工作流是参数化模板，需要随目标委派（goal 挂载参数）或调用方显式传入 params 后再运行

## 二、为什么不「硬做」

- 实测三项（开箱即玩 / 事件分支生效 / 技能成长闭环）全部要求一个真实部署的线上 Demo；对象不存在时任何「实测结论」都只能是伪造，违反验收纪律（结论只能来自真实使用，检查单未回填就如实标注）。
- 策划案（design_spec `cmvm29gtn0011m9gb69e36p3j`）已成功固化，质量不在本次质疑范围；缺的是把 spec 变成可玩部署的构建环节。

## 三、机器可判项核查结论（确定性，无主观判定）

| 验收标准（acceptanceCriteria 摘要） | 本次判定 | 说明 |
|---|---|---|
| ① 开箱即玩闭环（选方向→训练→事件→分支→结局） | **unverified** | 无部署可测 |
| ① 至少 3 个分支事件真实生效 | **unverified** | 无部署可测 |
| ② 状态边界 / ③ 对抗输入 / ④ 输入语义 / ⑤ 双端一致 / ⑥ 真机专项 | **unverified** | 无部署可测 |

主观体验四问量表 / 人工检查单：**本次不产生、不回填**（对象不存在，回填无意义且属伪造）。

## 四、解除阻塞条件（给上游的唯一诉求）

修复 `wf-sg-build` 的委派方式后重跑：该工作流是参数化模板，需随目标挂载或显式传入 13 项 params（gameName / gameGenre / gamePitch / gameDecisions / referenceImage / repoUrl / goalBranch / gamePath / hostedAppId / hostedAppSlug / liveUrl / goalId / smokeFrames）。部署成功并产出 liveUrl 后，本验收节点可原样重跑，无需改验收方案。

## 五、证据自证

- 本文件所在 commit 即本轮验收唯一产物；artifacts 回写条目（acceptance 类型，status=blocked）与本文件内容一致。
- 回写后已验证：goal artifacts 既有的 2 条条目（design_spec / run_workflow failed）逐字保留，仅追加本条（append-not-overwrite 纪律）。
