# 心伴 v0.10 开发说明（情绪洞察最小版）

## 模块地图

| 层 | 文件 | 职责 |
|---|---|---|
| server 纯函数 | `apps/server/src/lib/moodPeriodInsight.ts` | 三类封顶洞察派生器（确定性，无时钟/无随机）；`PERIOD_INSIGHT_TYPES` 枚举闭合 |
| server 纯函数测试 | `apps/server/src/lib/moodPeriodInsight.test.ts` | 黄金全结构 / 值级重算一致 / 稳定 / 空态 / 降级 / 平票优先级 / 枚举闭合 / UTC+8 周界 / 脏数据防御 |
| server 路由 | `apps/server/src/routes/period.ts` | additive `GET /api/v1/periods/:periodId/insight`（`period::insight`）；空态 200 合法结构；失败降级 + `logger.error` |
| mobile 类型 | `apps/mobile/src/types/index.ts` | `PeriodInsight*` 命名空间类型（与 v0.9 服务端契约同构） |
| mobile API | `apps/mobile/src/api/index.ts` / `mock.ts` | `getPeriodInsight`；mock 返回合法空结构 |
| mobile 视图状态 | `apps/mobile/src/utils/moodPeriodInsight.ts` | `periodInsightViewState`（ready/degraded/empty；未知第 4 类整体判红）+ `currentPeriodId`（UTC+8 自然周周一） |
| mobile 展示 | `apps/mobile/src/components/MoodPeriodInsightPanel.tsx` | 只读 Panel（非图表），三态文案 |
| 挂载 | `apps/mobile/src/screens/ChatScreen.tsx` | 报告列挂载 + 会话初始化时按当前周期取数 |

## 口径要点

- 周期窗口：UTC+8 / ISO 周一 / 左闭右开 `[from, to)`，服务端复用 `moodPeriodReport.ts` 冻结模块（引用非复制）。
- 标注关联：timeline 点位经 v0.7 修正应用后携带 `correctionId`（`number | null`）；洞察按「与周期报告同口径的有效点 + 带 correctionId」计数，保证 `correctedSamples ≤ sampleSize`。
- 平票优先级：`NEGATIVE > NEUTRAL > POSITIVE`（保守披露）。
- `share` / `averageScore` 四舍五入 4 位；文案为确定性中文模板。

## 常用命令

```bash
npx vitest run src/lib/moodPeriodInsight.test.ts          # server（apps/server 下）
npx vitest run src/routes/period.routes.test.ts           # server 路由
npx vitest run src/utils/moodPeriodInsight.test.ts        # mobile（apps/mobile 下）
npm run smoke        # 51/51
npm run deploy:v02   # dist 启动 + /health + 复跑 build/start/test
```

## 扩展留白（本期不做）

多周期洞察对比（可复用 v0.9 comparison 的 current/previous 双报告分别喂 `buildMoodPeriodInsight`）；洞察类型的增补必须同时更新两端枚举闭合测试与契约表。
