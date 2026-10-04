# 心伴 v0.4 质量验收记录

## 1. 五条阻塞级拦截标准

| # | 拦截标准 | 核验方式 | 判定 |
|---|---|---|---|
| B1 | 无锚点或锚点失败 | 每条 DoD 指认测试/冒烟锚点；最终测试、smoke、persist 均 exit 0 | 未触发 |
| B2 | 破坏 v0.3 冒烟基线 | `npm run smoke` 01-19 全绿，20-22 新增；exit 0 | 未触发 |
| B3 | 派生层反向写入或改契约 | schema diff 为空；新增派生层仅 `findFirst/findMany`；无 Prisma 写 API；既有契约测试未放宽 | 未触发 |
| B4 | 空态 / 脏数据·聚合失败降级 / 兼容三件套缺一 | `moodInsight.test.ts` 4 例、`chat.routes.test.ts` 新增 4 例、`insights.test.ts` 新增 3 例、smoke 22 | 未触发 |
| B5 | 红绿证据缺失 | server/mobile 的 red/green 日志均留档；服务端模块先模块缺失红，客户端先函数缺失红 | 未触发 |

结论：0 条阻塞级触发，可签收。

## 2. DoD 锚点复核

| DoD | 锚点结果 |
|---|---|
| V4-1 | `moodInsight.test.ts > returns an explicit empty insight...`、`> aggregates an explainable trend...` 绿 |
| V4-2 | `> skips dirty points...`、`> degrades when either source read is degraded`、route 空/存储降级/聚合失败三例绿 |
| V4-3 | route exposes 新 API；v0.3 四个 memory/mood behavior 测试原样保留且绿 |
| V4-4 | mobile 空/降级/就绪三例绿；`MoodInsightPanel` 构建进 332 modules |
| V4-5 | smoke 22/22；01-19 无回归 |
| V4-6 | persist 9/9 |
| V4-7 | 死测试扫描 0；Vitest 无 skipped/todo |

最终测试计数：server 9 files / 46 tests，mobile 3 files / 29 tests，全绿。

## 3. 提交级构建与测试抽查

| 提交 | 范围 | 验证 |
|---|---|---|
| `2093115` | 基线与范围冻结 | 基线 build/start/test/smoke/persist 已在提交前实跑并留档 |
| `3537ca9` | server 纯函数 + HTTP | 全仓 build exit 0，test server 46 + mobile 26 |
| `ba8b54d` | mobile 状态/API/面板 | 全仓 build exit 0，test server 46 + mobile 29 |
| `d7c91fa` | smoke 20-22 | smoke 22/22，persist 9/9 |

## 4. 范围与安全审查

- 新增 `GET /api/v1/conversations/:id/insight-summary`，先鉴权，再用 `id + userId` 查会话；越权会话进入既有 404 语义。
- 派生层只允许 `ACTIVE` 记忆作为归因源；`QUARANTINED`、空 id、无效时间/情绪/分数、无来源点都会跳过。
- `summary.reason` 只描述聚合规则与计数/均分，不输出用户原文；keywords 只来自既有结构化关键词。
- 读失败、序列化失败、聚合失败统一 `available=false / degraded=true / summary=null`。
- 客户端把 null/无效 sample、降级态收敛为空或降级，不渲染部分脏数据。

## 5. 非阻塞项（停车场）

| 项 | 影响 | 处置 |
|---|---|---|
| `apps/mobile npm run lint` 会扫到产物 `dist-web` | 开发体验；src 级 `npx eslint src` exit 0 | 留停车场，不混入本轮 |
| smoke 20-21 是单样本观察摘要 | 覆盖端到端空/就绪契约，但不覆盖多点多趋势 | 服务端多点多趋势已有单测，周期化趋势留停车场 |
| 部分 v0.3 review M/S 项未清偿 | 非本轮验收口径 | 已入 `DEVELOPMENT.md` 停车场 |

## 6. 签收

满足验收口径：v0.3 冒烟全绿无回归；v0.4 P0 DoD 逐条打勾且有锚点；死测试挂账清零。**签收：通过。**
