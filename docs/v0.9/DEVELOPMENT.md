# 心伴 v0.9 开发说明

## 1. 技术选型

- 继续 standalone Node HTTP runtime + Prisma/SQLite 读侧；不引入 CSV 依赖、图表库、外部进程或新存储。
- 新增纯函数模块承载自然周对齐、聚合、趋势与完整度；新增 CSV writer 承载 RFC 4180 序列化；HTTP 层只做鉴权、参数、读取、重试和响应映射。
- 响应对象增加 additive `rawBody` 能力，standalone 直接输出 CSV；既有 JSON 响应不受影响。

## 2. 模块边界

- `apps/server/src/lib/moodPeriodComparison.ts`：周期边界、有效点过滤、5 维聚合、补空、趋势、完整度。
- `apps/server/src/lib/csvExport.ts`：CSV 单元转义、表头、BOM、writer。
- `apps/server/src/routes/chat.ts`：注册两个新 GET 路由，复用归属校验和 latest-wins 读契约；持有本轮唯一故障注入钩子。
- `docs/smoke/v0.9.md` + `scripts/smoke.sh`：v0.8 45 步后增量追加导出探针，不改旧编号。

## 3. 交付顺序

1. 冻结产品契约与审查缺口四点裁决（REQUIREMENTS §2-§3 已签认）。
2. 先落接口层/纯函数红测：对比聚合值、趋势复算、空态、边界、CSV 三验、降级与故障注入。
3. 留存红证据后实现模块和路由。
4. 跑 build/test/smoke/persist/schema/d死测试，回填 QA。
5. deploy 回流并执行 v0.8 全量 smoke + v0.9 CSV 产物探针。

## 4. 故障注入设计

- 只导出 `__setMoodComparisonSourceForTests` / `__resetMoodComparisonSourceForTests` 两个具名钩子。
- 注入点在读路由数据源边界，可模拟：首次失败后成功（重试闭环）、全量失败、单周期失败但其余可用、超源上限。
- 生产代码默认不启用钩子；测试结束必须 reset。
