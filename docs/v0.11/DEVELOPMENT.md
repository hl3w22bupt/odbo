# 心伴 v0.11 开发说明

## 模块地图

| 层 | 文件 | 增量职责 |
|---|---|---|
| server 对比管道 | `apps/server/src/lib/moodPeriodComparison.ts` | additive 导出 `comparisonRelativeTrend`，继续复用同一 ±5% 判定 |
| server 纯函数 | `apps/server/src/lib/moodPeriodInsightComparison.ts` | 周期序列、三类指标映射、空态/降级封闭标记、确定性中文文案 |
| server 路由 | `apps/server/src/routes/period.ts` | additive 注册 `period::insight-comparison`；专用参数校验与统一聚合降级 |
| server 错误码 | `apps/server/src/lib/errors.ts` | additive 新增两个互不冲突错误码 |
| mobile 类型 | `apps/mobile/src/types/index.ts` | additive comparison 命名空间 |
| mobile API | `apps/mobile/src/api/index.ts` / `mock.ts` | additive `getPeriodInsightComparison`，mock 返回合法全空结构 |
| mobile 视图状态 | `apps/mobile/src/utils/moodPeriodInsightComparison.ts` | additive 纯函数：ready / empty / degraded / 第 4 类判红 |

## 交付顺序

1. 冻结契约与五态断言表（REQUIREMENTS.md）。
2. 先落 server 纯函数、路由、mobile 视图状态红测并留档。
3. 实现纯函数与路由；复跑红测转绿。
4. smoke 53 起追加跨周期洞察探针；build/test/smoke/persist/schema/死测试清账。
5. deploy 复验 + deploy 后 smoke 闭环。

## 常用命令

```bash
cd apps/server && npx vitest run src/lib/moodPeriodInsightComparison.test.ts src/routes/periodInsightComparison.routes.test.ts
cd apps/mobile && npx vitest run src/utils/moodPeriodInsightComparison.test.ts
npm run smoke
npm run deploy:v02
```
