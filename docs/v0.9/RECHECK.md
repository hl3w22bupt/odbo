# 心伴 v0.9 独立复验（Recheck）

本轮执行轨迹对已入库的 v0.9 五节点闭环（`89fcf19` → `6386924` → `7bcf1b3` → `a37dbae` → `80b5348`）做**独立复核**：不采信上轮 DoD 打勾表，全部门禁与锚点在本轮工作区重新实测。

## 1. 四门禁独立复跑（本机实测）

| 门 | 退出码 | 实测结果 | 留证 |
|---|---:|---|---|
| build | 0 | server tsc + mobile typecheck + Expo Web 静态导出（EXPO_PUBLIC_API_URL 默认指向 127.0.0.1:3888，非 mock 模式） | `recheck-build.log` |
| test | 0 | server 18 files/95 tests + mobile 5 files/33 tests，server/mobile 两段齐全 | `recheck-test.log` |
| smoke | 0 | 46/46（01-45 v0.8 基线 + 46 周期对比 CSV 产物探针） | `recheck-smoke.log` |
| persist:check | 0 | 9/9（写→kill→重启→读回一致 + 写失败降级） | `recheck-persist.log` |

汇总退出码：`recheck-gate-exits.txt`。

## 2. DoD 锚点三点一线复认

锚点测试文件 `apps/server/src/routes/moodComparison.routes.test.ts` 单独实测 **13/13 通过（167ms）**，与 DoD 逐条对齐：

| DoD | 锚点测试（实测通过） |
|---|---|
| ☑2 对比值级+趋势复算 | `aggregates two known cycles and recalculates adjacent trends` |
| ☑3 空态两档 | `distinguishes one empty period from overall partial completeness`、`returns a machine-readable no-file signal for empty source data` |
| ☑4 边界（N=3 拒绝/补空/跨年） | `rejects a period count above the frozen N=3 limit`、`pads only missing source cycles...`、`aligns weekly boundaries across a Gregorian year boundary` |
| ☑5 导出三验+转义 | `exports a non-empty parseable CSV...`、`escapes RFC 4180 control characters in CSV cells` |
| ☑6 导出元信息 | 行数头断言含于导出三验测试；generatedAt 仅存在+ISO 格式 |
| ☑7 降级（注入重试/部分失败双断言） | `returns the comparison JSON degraded state...retries once`、`retries an injected source failure once...without a file`、`returns a usable CSV with degraded and partial signals...` |
| ☑8 死测试余量 | `recheck-dead-test-count.txt` = 0（复扫命中的 5 条均为 `process.exit(` 误匹配，非 skip/only） |

红绿链复核：红测提交 `6386924` 先于实现 `7bcf1b3`（`node3-red-comparison-exit.txt`=1）；本轮实现与契约逐条比对（N=3 冻结、UTC+8 周一窗口、五维度顺序、5% 趋势阈值、完整度三态、CSV RFC 4180 + BOM、`X-Report-Row-Count` 不含表头、204 空态、413 超限、重试一次降级 + 部分失败三头）均一致。

## 3. 冻结口径零触碰复核

- schema diff（`e625075..HEAD`，`*schema.prisma*`）= 0 行：`recheck-schema-diff-count.txt`。
- `node4-changed-paths.txt`：无 Prisma schema、无移动端功能面、无 v0.7/v0.8 既有路由契约改动；新路由只读。
- 故障注入钩子 `__setMoodComparisonSourceForTests` 为本轮唯一新增测试基建点，仅作用于读数据源边界。

## 4. 结论

v0.9 五节点闭环（基线确认 → 范围冻结 → 增量实现 → 质量验收 → deploy 冒烟）经本轮独立复验**全部维持绿**，无需返工。本轮仅追加复验留证并提交，不改动任何交付代码。
