# 心伴 v0.7 代码审查结论

独立审查 Agent 复验结论：**PASS（0 blocker / 0 major / 4 minor）**；完整结论见 `evidence/independent-code-review.md`。

## 1. 范围与差异

- 基线裁决：轨迹三证据已落地，本轮只做近 7 日周报；`docs/v0.7/BASELINE.md`。
- 冻结契约：`docs/v0.7/REQUIREMENTS.md`。
- 新增面：server 纯派生器 + additive GET；mobile 状态映射、面板、API 编排；smoke 39-42。
- 禁改面：`prisma/schema.prisma` 无变更；旧 route / 字段 / 错误码不改。

## 2. 机判审查

| 项 | 结论 | 锚点 |
|---|---|---|
| 单向依赖 | 通过 | `routes/chat.ts` 读库后调用 `moodWeeklyReport.ts`；派生器不 import Prisma |
| 所有权/鉴权 | 通过 | `authenticate(ctx)` + `conversation.findFirst({ id, userId })`；404 不被降级吞掉 |
| 7 日边界 | 通过 | `moodWeeklyReport.test.ts` 覆盖窗口左端点、越窗、future |
| ACTIVE 归因 | 通过 | 同上覆盖 `memoryId: missing`；实现只加入 ACTIVE memory id |
| latest-wins | 通过 | route test + smoke 39 使用 v0.5 correction 后数据 |
| 空态 | 通过 | `<2` 有效样本返回 `report:null`；固定文案 |
| 降级 | 通过 | 存储异常返回 `available:false/degraded:true/report:null` |
| 客户端畸形防御 | 通过 | `weeklyReport.ts` 校验样本、趋势、keywords 数组、window |
| 兼容 | 通过 | smoke 01-38 全绿、persist 9/9、deploy 后复跑一致 |

## 3. 红绿证据

- 红：`red-server-weekly-report.log`、`red-mobile-weekly-report.log`、`red-weekly-report-exit.txt`（server/mobile 均 exit 1）。
- 绿：`green-server-weekly-pure.log`、`green-server-weekly-route.log`、`green-mobile-weekly-util.log`。
- 全量：`qa-test.log`、`qa-smoke.log`、`qa-persist.log`、`deploy-replay.log`、`post-deploy-smoke.log`。

## 4. 独立审查判定

- Schema 与 db 入口 diff 为空；旧 chat route 不变，`chat::conversation-weekly-report` additive。
- `authenticate(ctx)` 先行，再 `conversation.findFirst({ id, userId })`；AppError 重抛，404 不降级。
- 7 日窗口、ACTIVE 归因、latest-wins、空态/降级、客户端状态收敛与 smoke 双锚定均通过。
- 无图表、推送、环比、跨会话、自定义窗口或 LLM 文案实现，范围未泄漏。

## 5. 非阻塞项（合并独立审查意见）

| 项 | 影响 | 处置 |
|---|---|---|
| 周报查询沿用 `take:50` 升序截断；理论 7 日超 50 点时可能漏最新点 | 当前样本规模不受影响；后续按窗口倒序拉取再排序，入停车场 |
| 客户端 headline/reason/时间类型守卫可再加强 | 受控服务端不可达；异常自造载荷理论可到 React child | 服务契约受控；shared contract schema 入停车场 |
| 修正后周报刷新失败保留旧态 | 不泄漏脏数据，但可能短暂未刷新 | 网络态策略统一入停车场 |
| 节点 5 文档当时未在审查 commit 范围 | 审查后已随闭环提交，不影响源码 | 见本轮闭环提交 |
| 前后段均分在奇数样本时忽略中位点 | 趋势规则稳定但样本利用非最大化 | 冻结为最小规则；加权窗口/环比入停车场 |
| Mock 不复用 server 纯函数（跨包不共享） | 可能出现实现漂移 | 已锁同一契约字段/趋势文案；monorepo shared lib 入停车场 |
| AppHost 未提供公开签名 API | 无长期公开 URL，不泄露凭据 | 以对象键、SHA256 与签名回读 200 作为发布证据 |
