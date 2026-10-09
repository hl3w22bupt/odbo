# 心伴 v0.7 跨轮复验（RECHECK）

## 1. 复验背景与方式

本轮执行时工作分支已停留在 v0.7 闭环提交 `7356d87`（前序运行已完成五节点接力：`eb45340` 基线裁决 → `222026a` 范围冻结 → `e2a2ed4` 周报实现 → `5548069` QA 机判 → `71deb68` deploy 闭环），工作树干净。

按「禁止盲目重试」纪律，本轮不做重复交付，改为**独立复现全部门禁**：只信本机命令退出码与本目录留证日志，不复述上轮结论。

## 2. 门禁复现结果（本机复跑，2026-10-09）

| 门 | 命令 | 本机结果 | 与上轮记录对照 | 留证 |
|---|---|---|---|---|
| build | `npm run build` | exit 0（server tsc + mobile typecheck + Web 导出 336 modules） | 一致 | `rerun-deploy.log`（内含 2 次完整 build）、`rerun-test.log` |
| test | `npm test` | exit 0；server 16 files / 76 tests；mobile 5 files / 33 tests | 一致 | `rerun-test.log` |
| smoke | `npm run smoke` | exit 0；42 / 42（01-38 兼容 + 39-42 周报） | 一致 | `rerun-smoke.log` |
| persist | `npm run persist:check` | exit 0；9 / 9 | 一致 | `rerun-persist.log` |
| persistence:v02 | `npm run persistence:v02` | exit 0；18 / 18（含 kill -9 重启与坏数据降级） | 一致 | `rerun-persist-v02.log` |
| deploy | `npm run deploy:v02` | exit 0；build=0 start=0 test=0 | 一致 | `rerun-deploy.log` |
| 部署后 smoke | `npm run smoke` | exit 0；42 / 42，与部署前一致 | 一致 | `post-deploy-rerun-smoke.log` |
| 部署后 persist | `npm run persist:check` | exit 0；9 / 9，与部署前一致 | 一致 | `post-deploy-rerun-persist.log` |
| 死测试四口径 | `grep -R -nE '\.(skip\|only\|todo)\b\|\<xit(\|\<xdescribe('` | 0 条 | 一致（上轮亦为 0） | 本文件 §4 |
| schema 底线 | `git diff f02d97e..HEAD -- '*schema.prisma*' '*prisma*'` | 空 diff | 一致（不动 schema 机判成立） | 本文件 §4 |

**漂移清单：无阻塞级漂移。** 唯一环境噪音为 Vitest config 的 `configLoader` 弃用告警（上轮已记录为非阻塞既有噪音），不影响任何断言结果。

## 3. 证据链与 DoD 复锚定

- 红→绿：`red-weekly-report-exit.txt`（`red_server_exit=1 red_mobile_exit=1`，server 4 用例失败、mobile 模块缺失）→ `green-server-weekly-*.log` / `green-mobile-weekly-*.log` → 全量 76+33 全绿。红在实现提交（e2a2ed4）之前产生，链条完整。
- DoD 具名测试 7/7 逐条在源码中命中（verbatim）：`chat.routes.test.ts` 4 条、`moodWeeklyReport.test.ts` 2 条、`weeklyReport.test.ts` 1 条，与 `REQUIREMENTS.md` §4 与 `QA-ACCEPTANCE.md` §2 双锚定一致。
- 冒烟文档 `docs/smoke/v0.7.md` 与功能同提交于 `e2a2ed4`（git show --stat 核验）。
- 三判据基线结论（轨迹可视化已实质落地，见 `BASELINE.md` §2）复核无需推翻：其证据锚点（`MoodTimelinePanel` 挂载、`mood-timeline` 读侧 latest-wins、内容级断言测试）在本轮 42/42 冒烟 14-17/23-25 步与 76+33 单测中继续可复现。
- 停车场盘点（`BASELINE.md` §4）维持「只出清单不占主线」，本轮无捞回。

## 4. 本轮机判命令与输出摘录

```text
$ npm test                 # Test Files 16 passed (16) / Tests 76 passed (76)
                           # Test Files 5 passed (5)  / Tests 33 passed (33)
$ npm run smoke            # ✅ 心伴 v0.7 冒烟通过：42 项 / 42 项
$ npm run persist:check    # ✅ 心伴 v0.3 持久性硬门槛通过：9 项，exit=0
$ npm run persistence:v02  # 心伴 v0.2 持久化增量通过：18 项 / 18 项
$ npm run deploy:v02       # 心伴 v0.2 deploy 复验：build=0 start=0 test=0
$ 死测试扫描               # 0 条（四口径：.skip/.only/.todo/xit/xdescribe）
$ schema diff              # f02d97e..HEAD prisma 相关 diff 为空
```

## 5. 跨轮基线事实（归档）

1. **v0.7 交付在 `7356d87` 处可完整复现**：九项门禁本机重跑全部 exit 0，数值与 `QA-ACCEPTANCE.md` / `DEPLOY.md` 记录逐项一致，无回退、无阻塞漂移。
2. **裁决分支正确性成立**：轨迹可视化三判据「已实质落地」结论维持，v0.7 P0 = 周报最小版的分支选择无需变更。
3. **验收闭环状态维持：PASS / CLOSED**（不重签发，只维持并留证）。
4. 遗留非阻塞项仍以 `REVIEW.md` §5 的 7 条 minor 为准，全部在停车场，不阻塞任何后续增量。
