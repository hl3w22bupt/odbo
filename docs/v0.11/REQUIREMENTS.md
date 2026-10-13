# 心伴 v0.11 P0 · 情绪洞察跨周期对比（insight 多周期）

状态：FROZEN（节点 1 基线三证据 AND 通过；insight 前端可触达，不启用呈现备选）。

## 1. 范围与选型

1. 新增只读端点：`GET /api/v1/periods/:periodId/insight/comparison?periods=N`。
   - `periodId` 是目标周期 C（东八区周一）；N 默认 3，请求序列为 `C-(N-1) 周 ... C`。
   - 继续 standalone Node HTTP + Prisma/SQLite 读侧；无 ML、无随机、无外部调用、零写侧、零新采集、零 schema 变更。
2. 消费并只读复用：
   - v0.8 周期聚合（`readableMoodPeriodReport`）；
   - v0.9 对比管道（`MAX_COMPARISON_PERIODS=3`、东八区/ISO 周一、±5% 阈值；通过 additive 导出复用同一 `relativeTrend` 判定）；
   - v0.10 `buildMoodPeriodInsight` 三类洞察生成器。
3. 不改造 v0.9 `/comparison`、v0.10 `/insight`；不新建页面；不扩洞察类。

## 2. 响应契约

成功信封新增于 `data`：

```ts
{
  conversationId: string
  available: boolean
  degraded: boolean
  degradedReason: null | 'SOURCE_DEGRADED' | 'AGGREGATION_FAILED'
  granularity: 'NATURAL_WEEK'
  timezone: 'UTC+8'
  targetPeriodId: string
  requestedPeriods: number
  periodIds: string[]
  periods: Array<{
    periodId: string
    available: boolean
    degraded: boolean
    empty: boolean
    insights: PeriodInsightItem[]
  }>
  insights: Array<{
    type: 'DOMINANT_MOOD' | 'PERIOD_TREND' | 'ANNOTATION_CORRELATION'
    status: 'READY' | 'EMPTY'
    reason: null | 'PERIOD_EMPTY' | 'METRIC_MISSING' | 'ZERO_BASE'
    value: null | {
      direction: 'UP' | 'STABLE' | 'DOWN'
      rate: number
      fromPeriodId: string
      toPeriodId: string
      fromValue: number
      toValue: number
    }
    evidence: {
      fromPeriodId: string
      toPeriodId: string
      fromSampleSize: number
      toSampleSize: number
      source: string
    }
    message: string
  }>
}
```

## 3. 冻结口径

1. **3 类封顶**：type 只能是 v0.10 三类；新增周期维度表达为 `direction/rate/fromPeriodId/toPeriodId`，不是第 4 类。
2. **指标映射（只读）**：
   - `DOMINANT_MOOD` 比较 A/C 各自主导情绪 `count`；
   - `PERIOD_TREND` 比较 A/C 平均分；
   - `ANNOTATION_CORRELATION` 比较 A/C 修正标注数；健康非空周期缺标注按 0 参与对比。
3. **阈值**：沿用 v0.9 `(to-from)/from`；`>= +5%` 为 `UP`，`<= -5%` 为 `DOWN`，其余 `STABLE`；分母 0 记 `ZERO_BASE` 空标记。
4. **空/降级**：任一窗口周期空时，跨窗口整体不做跳空结论，相关 item 一律 `EMPTY/PERIOD_EMPTY`； degradation 原因封闭为 `SOURCE_DEGRADED`（聚合结果降级）和 `AGGREGATION_FAILED`（读库/派生抛错）。
5. **错误码**：
   - `periods` 非整数、越界（`<1` 或 `>3`）：400 + `PERIOD_INSIGHT_COUNT_REJECTED`；
   - 目标 `periodId` 非法/非周一：404 + `PERIOD_INSIGHT_TARGET_NOT_FOUND`（本任务书冻结的 404 约定；不改 v0.10 既有端点的 400 行为）。
6. **鉴权/边界**：Bearer；仅当前用户 ACTIVE 会话；脏点沿用既有聚合器静默剔除。

## 4. 输入态 → 期望响应 → 可机判标记

| 输入态 | 期望响应 | 可机判标记 |
|---|---|---|
| ① 目标周期 C 空，A/B 有数据 | 200；`available=true`、`degraded=false`、`degradedReason=null`；C period `empty=true` | 存在 item `status='EMPTY'`、`reason='PERIOD_EMPTY'`、`value=null`、`toPeriodId=C` |
| ② 任一对比周期空（如 B 空，A/C 有数据） | 200；不产出跨越空窗的整体方向 | 每个 item `status='EMPTY'`、`reason='PERIOD_EMPTY'`、`direction/rate=null`（由 `value=null` 表达） |
| ③ 全部周期空 | 200；`available=true`、`degraded=false`、`insights=[]` | 三个 `periods[].empty=true`；`degradedReason=null` |
| ④ 聚合失败 | 200；`available=false`、`degraded=true`、`periods=[]`、`insights=[]`、非静默日志 | `degradedReason` 只能为 `AGGREGATION_FAILED` 或 `SOURCE_DEGRADED` |
| ⑤ `periods=4/0/foo` | 拒绝，不读聚合 | HTTP 400 + `code='PERIOD_INSIGHT_COUNT_REJECTED'` |
| ⑥ `periodId` 非法/非周一 | 拒绝，不读聚合 | HTTP 404 + `code='PERIOD_INSIGHT_TARGET_NOT_FOUND'` |

## 5. 冻结边界

- Prisma schema diff=0；既有路由路径/响应字段/测试零修改。
- v0.7 渲染、v0.9 CSV+对比、v0.10 insight 三条契约只复跑比对，不改写。
- 移动端本期只做 additive 类型/API/视图状态解析，不改既有页面挂载与 v0.10 展示。

## 6. DoD 冻结清单（交付回填）

- [x] 基线 build / start / test 三证据 AND 固化，v0.10 证据归档。
- [x] insight 前端触达二值结论交付，判定可触达，不启用备选。
- [x] 新端点只读、additive；schema diff=0；零写侧。
- [x] 三类封顶且只扩周期维度；第 4 类两端判红。
- [x] 五态断言表落地为值级测试/冒烟：目标空、任一周期空、全空、聚合失败、超限/非法参。
- [x] `periodId` 非法按本版 404 专用码拒绝；既有 v0.10 端点行为不改变。
- [x] v0.7 / v0.9 / v0.10 冻结契约复跑零漂移。
- [x] build / test / smoke / persist / deploy / deploy 后 smoke 全绿并四要素留痕。
- [x] 死测试扫描清零。
