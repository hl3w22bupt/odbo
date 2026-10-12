# 心伴 v0.9 · 节点 1 基线硬门槛复核

## 1. 结论：v0.9 实质未落地，触发备选切换

- `docs/v0.9/` 不存在；全仓检索无「多周期对比」「CSV 导出」实现或冻结文档。
- `origin/main`、本地分支与 tag 均无 v0.9 提交；HEAD 为 v0.8 终审交付 `e625075`。
- 因此「对比端点趋势三值 + 完整度标记」与「CSV 固定列序 + 无行数元信息」两组三证据 AND 均不成立。
- 按任务冻结规则切换 P0：**v0.9 增量还账（多周期对比 + CSV 导出）**，暂缓 v0.10 insight，不做零准备扩需求。

## 2. v0.8 真实基线

执行环境首次门禁失败：`vitest` / `tsc` 不存在，属工作区依赖未安装漂移；先执行 `npm run setup`，再复跑。

| 门禁 | 结果 | 证据 |
|---|---|---|
| setup | rc=0 | `evidence/node1-setup.log` |
| npm test | 首跑 rc=127（依赖漂移）；修复基线用例时间漂移后局部复跑 rc=0 | `evidence/node1-baseline-test.log` |
| npm run build | rc=0（依赖修复后） | `evidence/node1-baseline-build.log` |
| npm run smoke | rc=0，45/45（依赖修复后） | `evidence/node1-baseline-smoke.log` |
| npm run persist:check | rc=0，9/9 | `evidence/node1-baseline-persist.log` |

### 阻塞级漂移与先修

1. 工作区未安装依赖：`setup` 还原，不改动业务代码。
2. `chat.routes.test.ts > reads persisted corrections into the period report` 使用固定 `2026-10-07`，当前自然周已漂移导致 1/82 挂。修复为按真实 now 计算当前东八区周一，并在当前周期内生成两条样本；路由契约与生产代码未改。

## 3. 判定

v0.8 属「修复续用」而非重建：build/start 语义、45 项 smoke、持久化门禁均能恢复全绿；v0.9 是全新还账增量，不覆写 v0.8 资产。
