# FIX：AC-13 / RT-05 — CSV 导出 413 超限保护生产不可达（已修复）

- 关联：docs/v0.9/VERIFICATION.md（结论 NEEDS_WORK 96/100，唯一 partial 判定 AC-13；红队 RT-05 upheld）
- 状态：**FIXED**（一行级修复 + 契约级红绿测试留证）
- 日期：2026-10-12

## 缺陷

`loadSource` 的 `prisma.moodSnapshot.findMany` 以 `take: 1000` 拉取，使
`source.moodRows.length` 恒 ≤ 1000，`exportMode && length > CSV_EXPORT_ROW_LIMIT (=1000)`
恒 false → 生产路径 `413 CSV_EXPORT_TOO_LARGE` 永不可达，超限源数据被静默截断，
违反冻结契约 §3「超大数据拒绝＋上限提示」。原 413 测试仅可经注入钩子构造 1001 行触达。

## 修复（一行级）

`apps/server/src/routes/moodComparison.ts`：`moodSnapshot.findMany` 的
`take: 1000` → `take: CSV_EXPORT_ROW_LIMIT + 1`（=1001）。

- 第 1001 行可被取到 → `length > 1000` 判定生产可达，413 按契约拒绝；
- 恰好 1000 行的边界不误伤（1000 > 1000 为 false，正常导出）；
- 对比端点（非 exportMode）行为不变（多取一行不影响最近 3 自然周聚合）。

## 红绿留证（本工作区实测，非采信文档）

| 相位 | 证据 | 结果 |
|------|------|------|
| 红 | evidence/fix-413-red.log（新增测试 `pulls one row beyond the frozen limit so the 413 guard is reachable in production`） | 1 failed \| 13 passed：`expected 1000 to be 1001`，EXIT=1 |
| 绿 | evidence/fix-413-green.log（同一文件修复后复跑） | 14 passed (14)，EXIT=0 |
| 全量回归 | evidence/fix-413-full-test.log（server 全套件） | 18 files / 96 tests（基线 95 + 新增 1）passed，EXIT=0 |
| 修复后冒烟 | evidence/fix-413-smoke.log（`npm run smoke`，dev:standalone 跑源码） | 46 项 / 46 项，EXIT=0 |

新增测试性质：契约级断言——生产查询必须以 `take: 1001` 拉取，使 413 判定输入可得；
防止未来再把 take 收窄回 ≤1000 而无声 reopening 该缺陷。

## 口径

本修复只回填 VERIFICATION.md 中 AC-13 的唯一 partial 缺陷项（RT-05），不动该审计报告
历史快照原文；其余 minor 项（RT-03/04/08/09/11/13/14/16 等）保持审计记录原状，
其中「整体趋势保守口径与冻结文本解释偏差」已由实现注释声明，属产品知悉项。
