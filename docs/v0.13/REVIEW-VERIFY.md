# v0.13 上游产出独立审查（代码审查复核轮 · 2026-10-16）

> 审查对象：本轮接力全部 4 个提交（`1782749` feat → `cf20988` fix → `e9b45e2` 平台自动 → `3719ffe` 独立复核）。
> 方法：不采信上游自述，四门禁全部亲跑取退出码；红队变异测试反证 pass 判定；越界改动扫描。

## 评审结论

```json
{
  "verdict": "pass",
  "summary": "v0.13 两入口触达与未知周期定案按冻结契约完整落地；四门禁亲跑全绿、硬验收 6 项锚点三点一线、红队三变异全部变红证明测试真实有效，无关键问题。",
  "blockingIssues": [],
  "suggestions": [
    { "description": "PeriodDataExchangeCard 以失败明细文本作 React key（key={detail}），重复失败原因会撞 key；建议改用 row/line 组合或 index。" },
    { "description": "countPeriodCsvRows 的结果被 serverAuthoritativeImportResult 显式 void，属死计算：契约定位是『体验提示』但从未生成任何 UI 提示；建议消费（超限 toast 提示）或删除。" },
    { "description": "聚合/洞察套件（7 files / 72）的文件清单未固化进 QA-ACCEPTANCE，复核口径不可精确复现（另一合理 7 文件组合为 71）；建议在文档列出具名文件清单。" },
    { "description": "moodComparison.ts 导出在空 periods 时 fallback 文件名为 xinban-period-.csv（periodId 空串插值）；建议给出无 periodId 时的固定名。" },
    { "description": "smoke.sh 头部注释写『59-66 导入导出触达』而实际新增段到 67 步；注释与实现小漂移。" },
    { "description": "unknownPeriodNotice 在 period.ts 与 moodComparison.ts 双处相似实现；后续可下沉 shared lib。" },
    { "description": "period::comparison / period::insight 单周期路由的 malformed（非日期）periodId 容错无显式断言（现仅测非周一真实日期）；跨周期路由已用 'not-monday' 覆盖，建议补齐另两处。" }
  ],
  "securityChecklist": { "authorization": true, "authentication": true, "sqlParameterized": true, "noSecretLeak": true, "inputValidation": true, "resourceOwnership": true },
  "changeSummary": "新增可复用 PeriodDataExchangeCard 挂载 Home/Chat 两既有页面（零新页面、路由表零变更）；导出直连 v0.9 conversation CSV，Blob + anchor 下载 + RFC 5987 中文文件名；导入消费既有明细，行号/原因封顶 3 条转义渲染；未知周期在聚合/洞察/导入三处以 additive meta+warnings 200 容错，既有七字段 Object.keys 逐项回归通过。",
  "foundButNotTouched": [
    "仓库级 lint 扫描 apps/mobile/dist-web 构建产物报历史错误（上游已声明，非本轮范围）",
    "smoke 结束对 dev:standalone 进程树 kill 打印 Killed: 9 job notice（脚本 exit 0，v0.12 起既有）"
  ],
  "rejectTo": "code-change"
}
```

## 一、四门禁独立复跑（不采信上游自述）

| 门禁 | 上游声称 | 本轮亲跑 | 退出码 | 一致 |
|---|---|---|---|---|
| build | server tsc + mobile typecheck + Web export | 同命令 | 0 | ✅ |
| test | server 27 files / 175 + mobile 10 files / 59 | 27 files / **175** + 10 files / **59** | 0 | ✅ 逐项一致 |
| smoke | 67 / 67（01-58 基线 + 59-67 新增） | 67 / 67 全绿（含 v0.13 各步） | 0 | ✅ |
| persist:check | 9 / 9 | 9 项全绿 | 0 | ✅ |

deploy 证据时序核验：`node5-deploy.log` 最后更新于 `cf20988`（fix 提交），其后 `e9b45e2`（仅 .myrd-platform 平台文件）与 `3719ffe`（仅 docs）均不改源码，**deploy 证据与 HEAD 源码状态一致**；deploy.log 内 build=0 / start=/health up / test 175+59。

## 二、硬验收 6 项锚点核对（锚点 → 具名测试 → 实跑）

| # | 验收 | 具名锚点 | 核验 |
|---|---|---|---|
| ① | 导入↔导出回环幂等 | `periodCsvImport.persistence.test.ts > imports a real export into a clean cycle, stays idempotent, and round-trips value-for-value`（导入 5/5 → 重导 skipped=5, imported=0 → 再导出**字节一致**）+ smoke 59-61 | ✅ 常驻 npm test |
| ② | 未知周期容错 | `returns a legal degraded comparison/...for an unknown...`、`skips mixed known and unknown...`（计数=1）、`returns the empty degraded contract for all unknown...`（纯未知，计数=2）+ smoke 63-66 | ✅ 全部值级断言 |
| ③ | 前端值级断言 | `dataExchange.test.ts`：端点/方法 toEqual、anchor.download=RFC5987 文件名 + click、`csvImport.test.ts`：行号/原因/封顶 3 条/+N 行 | ✅ 非仅按钮存在 |
| ④ | 防注入 | `escapes script payloads...`：`<script>alert(1)</script>` → `&lt;script&gt;...`；UI 仅 RN `Text` 无 innerHTML | ✅ |
| ⑤ | 预检/服务端不一致双向 | `keeps a 1000-row client count advisory-only and defers to the server in both mismatch directions`（双向均返回 server） | ✅ |
| ⑥ | 只加不改契约回归 | `keeps every v0.12 result field unchanged...`：`Object.keys` 七字段精确断言 | ✅ |

聚合/洞察既有测试全集：按组合 A（period.routes + periodInsightComparison.routes + periodCsvImport.persistence + moodComparison.routes + moodPeriodInsight + moodPeriodInsightComparison + periodComparison）亲跑 **7 files / 72 passed**，与声称精确复现；全量 175 全绿零回归，v0.10 空态契约零回归。

## 三、红队变异测试（对 pass 判定的独立反证）

| 变异 | 注入点 | 结果 |
|---|---|---|
| ① 删除 `escapeDisplayText` 的 `<` 转义行 | apps/mobile/src/utils/dataExchange.ts | **2 个防注入测试变红**（csvImport + dataExchange），恢复后全绿 |
| ② `serverAuthoritativeImportResult` 改为返回 client 侧预检 | 同上 | **双向不一致测试变红**，恢复后全绿 |
| ③ 服务端导出头退回无 `filename*` 旧形式 | apps/server/src/routes/moodComparison.ts | **导出契约测试变红**，恢复后全绿（工作区 0 dirty） |

结论：三处关键断言均具备真实捕获能力，不存在「假绿」测试。

## 四、越界与契约边界检查

- Prisma schema / migrations diff（579d6ec..HEAD）：**0 变更** ✅
- 路由表：零新增路由定义；Screen 文件集合无新增（`PeriodDataExchangeCard` 仅挂载 Home/Chat 两处）✅
- smoke.sh：95 insertions / 2 deletions，删除行仅为版本注释与汇总计数（58→67），**01-58 冻结基线段逐字未动** ✅
- v0.12 停车场清账声称：`InsightEvidence{type,value,evidence,message}` 四元组在 `moodPeriodInsight.ts` 真实存在（既有 v0.12 交付），清账留痕属实 ✅
- 既有测试改写（400/404 → 200 容错）：属冻结契约 REQUIREMENTS §4 明文要求的契约演进，非违规放宽 ✅

## 五、范围与规范符合度

- 冻结契约 6 大点（两入口 / Blob+RFC5987 / 封顶+转义 / 边界①服务端权威 / 边界②只加不改 / 未知周期定案）逐条有对应实现与测试，无实现期扩权。
- 提交拆分符合接力语义（feat / fix / test 三段 + 平台自动提交），commit message 符合 `<type>(<scope>): <subject>` 规范。
- 安全六项全过：鉴权（全部路由 authenticate）、越权（scopedUserPeriodInput 以 userId 收敛）、SQL（全 Prisma 参数化，业务代码零裸 SQL）、敏感信息（日志无 token/密钥）、入参校验（period_ids 1-3 非空 / periods 1-3 整数 / periodId 东八区周一 / CSV parser 八类封闭错误码）、资源归属（conversation where userId）。

## 六、审查维持

上游 REVIEW.md 的 `verdict: pass` **维持有效**。上述 7 条 suggestions 均为非阻塞改进项，不拦截本轮合入，建议随下一轮或技术债专项轮处理。
