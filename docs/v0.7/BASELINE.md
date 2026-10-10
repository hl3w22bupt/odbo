# 心伴 v0.7 基线确认

## 1. 装配与复跑

- 初始工作分支停留在 v0.4 合入点 `c63cd3b`，缺 v0.5/v0.6。
- 已显式 fetch 远端 v0.5 / v0.6 装配分支，并以 `git merge --ff-only origin/v06` 将基线推进到 `f02d97e`；未使用历史端口误报或纸面假设。
- 复跑结果均以本目录日志为准，退出码全部为 0：

| 门 | 命令 | 结果 | 对照 |
|---|---|---|---|
| build | `npm run build` | 通过 | `baseline-build.log` |
| start | `node dist/localServer.js` + `/health` | `status=up / mode=standalone` | `baseline-start.log`、`baseline-health.json` |
| test | `npm test` | server 15 files / 70 tests；mobile 4 files / 31 tests | `baseline-test.log` |
| smoke | `npm run smoke` | 38 / 38 | `baseline-smoke.log` |
| persist | `npm run persist:check` | 9 / 9 | `baseline-persist.log` |

结论：与 `docs/smoke/v0.6.md` 01-38 及 v0.6 记录一致；本轮发现的依赖安装脚本告警与 Vitest config warning 为非阻塞既有噪音，无功能契约漂移，无阻塞级漂移需要先修。

## 2. 情绪轨迹可视化三判据复核

判据按本轮更严口径逐条复核：

| # | 判据 | 证据锚点 | 判定 |
|---|---|---|---|
| 1 | 用户可触达轨迹视图（非摘要代偿/占位） | `ChatScreen.tsx` 挂载 `MoodTimelinePanel`；面板直接渲染每个情绪点位与修正入口 | 通过 |
| 2 | 源自持久层且反映 v0.5 编辑标注后数据 | `GET /conversations/:id/mood-timeline` 读 `MoodSnapshot` + `MoodCorrection`，读侧 latest-wins；`moodCorrection.persistence.test.ts`、`scripts/smoke.sh` 23-25 | 通过 |
| 3 | 内容级断言测试（点位序列/标注标记） | `conversationInsights.test.ts > serializes mood snapshots with structured keywords`；`chat.routes.test.ts > test_correction_latest_wins`；`insights.test.ts > asserts timeline content instead of pixels`；`scripts/smoke.sh` 16/17/25 | 通过 |

**跨轮基线事实：情绪轨迹可视化判定为「已实质落地」。** 因此 v0.7 裁决进入 P0 = 周报最小版，不重复还账轨迹可视化。

## 3. 死测试口径清账

扫描：`grep -R -nE '\.(skip|only|todo)\b|\<xit\(|\<xdescribe\(' apps/server/src apps/mobile/src --include='*.ts' --include='*.tsx'`

结果：`DEAD_TEST_COUNT=0`，无 skip / only / todo / xit / xdescribe；见 `baseline-dead-test-scan.log`。四类口径清零。

## 4. 停车场三判据盘点（只出候选，不占主线）

| 候选 | 三判据状态 | 捞回建议 |
|---|---|---|
| 真实 LLM 情绪洞察 | 用户价值明确；无持久层新模型需求；缺安全评测与内容断言 | 需先立安全评测轮 |
| 时间轴筛选/缩放/多周期对比 | 用户价值明确；持久层已有快照；缺冻结契约与内容断言 | 周报落地后单独排期 |
| 洞察行动建议 | 用户价值明确；不依赖 schema；缺安全边界与降级文案 | 与安全评测合并评审 |
| 多情绪周期聚合 | 周报是最小前置；当前仅有全历史摘要；缺窗口契约 | 本轮周报可提供可复用纯函数 |
| 客户端畸形载荷守卫 | 服务端当前不可达；用户可见异常成立；缺契约测试 | 小额加固可作顺手项 |
