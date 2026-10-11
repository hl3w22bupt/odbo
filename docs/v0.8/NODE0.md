# 心伴 v0.8 重入轮 · 节点 0 硬门槛机判（六条就绪检查单）

- 机判时间：`2026-10-10T23:19:52Z`（UTC）
- 机判 HEAD：`54c90464a6a9762caa17fad6a4ce9b6964ee9d08`
- 检查单出处：2026/10/10 冻结（上一轮 workflow run `cmv305l80000zm90464ys0lys` step-1 输出在案，平台 workflow_runs.nodes 留痕），证据四要素规范=命令原文+输出锚点+时间戳+commit SHA。
- 装配前置：按上一轮停轮记录「后续重入前置」执行 —— 以 `git merge --no-ff 44f27b8` 将基线推进到含 v0.7 闭环提交（合并提交 `54c9046`，沿用 v0.6 轮 `chore: assemble v0.5 baseline for v0.6 increment` 的装配修正模式；唯一冲突 `.myrd-platform/.claude/PRODUCT_CONTEXT.md` 为平台注入产物，取本工作区较新注入侧解决）。

## 六项机判结果（全部 PASS）

| # | 检查项 | 命令原文 | 输出锚点 | 时间戳 | 判定 |
|---|---|---|---|---|---|
| 1 | 当前分支可识别 | `git branch --show-current` | `myrd/v08-deploy-20261010-commit-cmv305l80000zm90464ys0lys`（rc=0） | `2026-10-10T23:19:52Z` | PASS |
| 2 | 交付面工作树干净 | `git status --porcelain=v1 -- apps/server apps/mobile docs package.json scripts` | 提交后复跑 0 行 / rc=0（首跑仅 `?? docs/v0.8/` 为本机判自产证据目录，交付面 apps/package.json/scripts=0 行） | `2026-10-10T23:22:32Z` | PASS |
| 3 | v0.7 装配提交包含于 HEAD | `git merge-base --is-ancestor 44f27b809ff75621ddee27394401a25d33d28e16 HEAD` | `ancestor_rc=0`；`HEAD..44f27b8=0`、`44f27b8..HEAD=2`（装配提交+自动提交） | `2026-10-10T23:19:52Z` | PASS |
| 4 | v0.7 冒烟基线存在于 HEAD | `git cat-file -e HEAD:docs/smoke/v0.7.md` | `rc=0` | `2026-10-10T23:19:52Z` | PASS |
| 5 | v0.7 基线文档存在于 HEAD | `git cat-file -e HEAD:docs/v0.7/BASELINE.md` | `rc=0` | `2026-10-10T23:19:52Z` | PASS |
| 6 | v0.7 周报能力锚点存在于 HEAD | `git cat-file -e HEAD:apps/server/src/lib/moodWeeklyReport.ts` | `rc=0` | `2026-10-10T23:19:52Z` | PASS |

原始输出留证：`docs/v0.8/evidence/node0-six-checks.log`（提交后干净态复跑版）。

## 结论

**六项全过（6/6 PASS）→ 准入成立，进入节点 1 基线确认。**

对照上一轮（2026-10-10）停轮：当时检查 3–6 因「分支停留在 v0.4 合入点、缺 v0.7 装配产物」FAIL 而停轮；本轮按其留档的重入前置完成装配后复判，4 项由 FAIL 转 PASS，无遗留阻塞。装配过程仅引入合并提交 `54c9046`，未改动任何 apps/docs 交付面文件（`git diff 44f27b8..54c9046 -- apps docs scripts package.json` 为空）。
