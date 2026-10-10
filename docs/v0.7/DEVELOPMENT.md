# 心伴 v0.7 开发说明

## 1. 任务拆解与交付顺序

1. **装配基线**：fetch v0.5/v0.6 装配分支，`--ff-only` 推进，复跑 build/start/test/smoke/persist。
2. **三判据裁决**：按用户可触达 UI、持久层+修正数据、内容级测试复核轨迹可视化，结论「已落地」。
3. **冻结范围**：轨迹已落地，因此选择周报最小版，契约与空态/降级文案先落字。
4. **红绿实现**：先提交失败断言，再实现纯聚合器、HTTP 读接口、客户端状态映射与面板。
5. **质量门**：类型/单测/冒烟/持久性/死测试复跑，最后 deploy 与部署后冒烟闭环。

## 2. 技术选型与理由

- **不引入图表库**：最小周报只要趋势方向与一句解释；图表渲染入停车场。
- **不新增存储模型**：窗口是读侧派生事实，`MoodSnapshot + MoodCorrection` 已足够。
- **Prisma 只读查询 + 纯函数派生**：HTTP 层负责鉴权、 ownership 和读库；`moodWeeklyReport.ts` 只消费契约数据并注入 `now`，保证窗口边界可测。
- **React Native 文本面板**：与既有情绪洞察/轨迹面板一致，避免 Web/RN 双端分叉。
- **Vitest + shell smoke**：单测锁 7 日边界、修正值、空态/降级；smoke 锁真实 SQLite、HTTP、重启后修正和用户可见状态。

## 3. 模块边界

| 模块 | 路径 | v0.7 职责 |
|---|---|---|
| 读侧纯派生 | `apps/server/src/lib/moodWeeklyReport.ts` | 固定 7 日窗口、ACTIVE 归因、脏点过滤、趋势与一句文案 |
| HTTP 读接口 | `apps/server/src/routes/chat.ts` | `GET /api/v1/conversations/:id/mood-weekly-report`、鉴权、本人会话、读失败降级 |
| 客户端契约 | `apps/mobile/src/types/index.ts` | 与后端 additive JSON 契约一致 |
| 状态映射 | `apps/mobile/src/utils/weeklyReport.ts` | ready/empty/degraded 收敛，畸形载荷不进入面板 |
| 用户面板 | `apps/mobile/src/components/MoodWeeklyReportPanel.tsx` | 标题、趋势标签、一句解释和固定空/降级文案 |
| 编排入口 | `apps/mobile/src/screens/ChatScreen.tsx` | 会话加载、发送、修正后刷新周报 |
| Mock API | `apps/mobile/src/api/mock.ts` | 离线演示同一接口形态 |
| 冒烟 | `scripts/smoke.sh` | 01-38 兼容基线 + 39-42 周报全链路 |

依赖方向固定为：`routes -> contracts/derived lib -> Prisma rows as input`；派生器不 import Prisma，反向依赖禁止。

## 4. 关键规则

- 7 日窗口：`[now - 7d, now]` 双端闭区间；`window.from/to` 恒 ISO-8601。
- 有效样本：必须有点位 id、可解析时间、合法 mood/score，且 `memoryId` 命中 ACTIVE 记忆。
- 修正值：先走既有 `readableMoodTimeline(... correctionRows)` latest-wins，再进入周报。
- 趋势：有效样本 `<2` 为空态；`>=2` 按时间序前后半段均分比较。
- 失败：存储或聚合异常返回 HTTP 200 周报降级契约；404/401 不被降级吞掉。
- 兼容：不改 schema、不改旧接口；新路由 additive。

## 5. 验证协议

```bash
npm run build
npm test
npm run smoke          # 42/42
npm run persist:check  # 9/9
npm run deploy:v02
```

红证据：`docs/v0.7/evidence/red-server-weekly-report.log`、`red-mobile-weekly-report.log`。绿证据与本目录 `qa-*.log` 一一对应。
