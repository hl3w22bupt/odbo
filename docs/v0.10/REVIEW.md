# 心伴 v0.10 · 审查守门记录（节点 4）

守门人：执行 agent（接力节点 4）；对象：本分支 `feat(v0.10)` 全部 diff（提交 `45560cb`）。

## 1. 范围守门

- diff 清单 = 契约 additive 清单（REQUIREMENTS.md §3），逐项核对通过。
- v0.7 轨迹渲染（`MoodTimelinePanel.tsx` / `conversationInsights.ts` / `utils/insights.ts`）零 diff。
- 既有路由/schema/测试零修改：v0.9 期间路由测试 7 条原样通过；全量 test 158 条通过。

## 2. 契约守门（抽查判定）

| 抽查点 | 判定 |
|---|---|
| 空库/无该周期 → 200 合法空结构（禁 404/500） | ✓ `buildMoodPeriodInsight` 空样本分支 + smoke 49 |
| 聚合失败 → 降级空态 + 降级标记 + 非静默日志 | ✓ 路由 catch `logger.error('[period] insight degraded', …)` + 降级信封 |
| 3 类封顶 + 四元组 | ✓ `PERIOD_INSIGHT_TYPES` 长度 3 闭合测试；item 仅 `type/value/evidence/message` |
| 结论值 = 规则重算值 | ✓ server 值级重算用例 + smoke 50 jq 值级断言（非元素存在） |
| 时钟注入固定 | ✓ 两端纯函数 0 处真实时钟；测试全部固定时刻 |
| UTC+8 / ISO 周一引用非复制 | ✓ 服务端窗口取自 `readableMoodPeriodReport`（冻结模块产出）；移动端独立实现并以周界用例锚定（客户端无法引用服务端模块，已在契约 §3 载明） |
| evidence = 依据数据引用 | ✓ 仅引用既有聚合字段（`moodPeriodReport.summary.*` / `moodTimeline.points[correctionId]`） |

## 3. 缺陷与处置（过程中真实发生）

| # | 缺陷 | 层 | 处置 |
|---|---|---|---|
| 1 | 值级重算用例把 dominant count 硬编码为 negative（该用例主导实为 POSITIVE） | 测试 | 修正测试表达 |
| 2 | 降级用例的 report 与入参 timeline 健康态不一致 | 测试 | 修正为同源降级输入 |
| 3 | 降级信封 periodId 丢失（report.period 为 null） | 设计 | builder 显式接收路由已知 periodId，降级回显 + 一致性守卫 |
| 4 | correctionId 真实类型为 `number \| null`，首版守卫只认 string | 实现 | 守卫同时接受正数/非空 string，路由测试暴露后修正 |
| 5 | `MOOD_PRIORITY[0]` 在 noUncheckedIndexedAccess 下报 undefined 索引 | 实现 | `as const` 元组化 |
| 6 | string 分支被 `number \| null` 声明收窄为 never | 实现 | `unknown` 中转保留运行时防御 |
| 7 | smoke 步骤 50 初版断言漏列 ANNOTATION_CORRELATION（seed 实含 1 条已应用修正） | 冒烟 | 按实测真值修正断言（fail-fast 暴露，符合冒烟约定） |

缺陷 1-2/5-7 均由先红后绿或门禁拦截暴露，无带病落库。

## 4. 死测试清账

全仓 `skip / only / todo / xit / xdescribe / fit` 扫描 0 处。

## 5. 结论

守门通过。四门禁（build / test / smoke 51 项 / persist 9 项）全绿后进入 deploy 节点。
