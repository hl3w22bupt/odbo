# 心伴 v0.9 开发说明

## 1. 交付顺序

1. 基线复核与 v0.9 缺证裁决 → 切换还账。
2. 冻结上述契约；先写 server 纯函数红测试，再实现转绿。
3. 补 route 鉴权/空态/降级/CSV 机判，再补 mobile 视图状态三态。
4. 更新 48 项 smoke；全量 build/test/smoke/persist；最后部署复跑。

## 2. 模块边界

- `apps/server/src/lib/moodPeriodReport.ts`
  - 仅 additive 导出 `periodBoundsFromPeriodId`、`moodPeriodAverageScore`、`moodPeriodCompleteness`。
  - `readableMoodPeriodReport` 新增第 5 个可选 `periodId`；缺省仍按真实 now 取当前自然周，不破坏 v0.8。
- `apps/server/src/lib/periodComparison.ts`
  - 输入两个 v0.8 聚合结果，只做确定性比较；无 Prisma、无随机、无 Date.now。
- `apps/server/src/lib/periodCsv.ts`
  - 输入聚合结果派生 CSV；列序为唯一事实来源。
- `apps/server/src/routes/period.ts`
  - 鉴权、periodId 校验、按用户查询、组装多会话输入、降级与日志。
- `apps/server/src/lib/response.ts` + `localServer.ts`
  - additive `rawBody/rawContent`；仅 standalone 使用，JSON 老路径不变。
- `apps/mobile/src/utils/periodComparison.ts`
  - 脏结构→empty、失败→degraded、overall EMPTY→empty；不渲染编造趋势。

## 3. 关键实现决策

- 用户级周期报告在内存中把每个会话分别经既有 `readableMemories/readableMoodTimeline` 清洗后合并，避免复制 latest-wins/脏点规则。
- 对比平均值由 v0.8 `moods[].averageScore * count` 重算，并统一 4 位精度，保证端点可重放。
- CSV `date` 行级为自然日，`average_score` 行级为当日均值；汇总仍由 `sample_size/coverage_days/completeness` 表达。
- 周期 ID 采用 UTC 日期字符串加/减 7 天推导上一周，避免本地时区漂移；边界解析仍由 v0.8 固定 UTC+8 模块负责。

## 4. 验证命令

```bash
cd apps/server && npx vitest run src/lib/periodComparison.test.ts src/lib/periodCsv.test.ts src/routes/period.routes.test.ts
cd apps/mobile && npx vitest run src/utils/periodComparison.test.ts
npm test && npm run build && npm run smoke && npm run persist:check
```
