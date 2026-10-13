# 心伴 v0.10 · 节点 1 基线硬门槛复核记录（v0.9）

复核时间：2026-10-13 07:05–07:35（提交 `1db62c4` / `ca20551` 基线上）。

## 三证据 AND 复核

| # | 证据 | 复核方式 | 结论 |
|---|---|---|---|
| 1 | 对比端点趋势三值 + 完整度标记值级断言 | `scripts/smoke.sh` 步骤 46 jq 值级断言（三值 `all(type=="number")` + current/previous 逐字段）+ `periodComparison.test.ts` `toEqual` 全值断言（`{currentAverage: 0.3333, previousAverage: -1, deltaScore: 1.3333}`） | ✓ |
| 2 | CSV 固定列序 + 不含行数元信息 | `scripts/smoke.sh` 步骤 47/48（表头 14 列 exact + `! grep -qiE 'row.?_?count'`）+ `periodCsv.test.ts` 全行值级断言 + 字节稳定测试 | ✓ |
| 3 | build / start / test 复跑 | `npm run build` 全绿；`npm test` exit 0；`npm run smoke` 48/48 exit 0 | ✓ |

结论：三证据 AND 成立，v0.9 实质落地，**不触发备选切换**（P0 = insight 照常）。

## 漂移清单

| 级别 | 位置 | 内容 | 处置 |
|---|---|---|---|
| 非阻塞（文档记述） | `docs/smoke/v0.9.md` 步骤 46 | 记述 `coverageDays=2`，脚本断言与实测为 `coverageDays=1`（2 条样本同属一个东八区自然日） | 本轮顺手修正记述，代码零改动 |

阻塞级漂移：无。
