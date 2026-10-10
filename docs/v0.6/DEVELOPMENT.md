# 心伴 v0.6 开发说明与接力留证

## 1. 任务拆解

1. **基线装配**：初始分支缺 v0.5，显式合并 `myrd/v05-json-deploy-id-*` 后复跑 build/start/test/smoke/persist。
2. **范围冻结**：`REQUIREMENTS.md` 固定接口、实体、拒收/跳过、版本门、幂等、往返和四件套契约。
3. **红测**：新增 `importData.test.ts` 与真实 SQLite `import.persistence.test.ts`，先证明模块/路由缺失为红。
4. **实现**：纯函数 schema 门 + 路由事务导入 + smoke 续编 32-38。
5. **验收**：build/test/smoke/persist/deploy 与死测试四类清账。

## 2. 技术选型

- 复用 v0.5 TypeScript + Prisma 7 + SQLite，不引入 JSON Schema/Zod 等新依赖。
- schema 校验保持手写冻结契约，错误分列为版本缺失、版本过高、schema 非法。
- 按 conversation 使用 Prisma transaction；不新增导入批处理队列或异步任务。

## 3. 三元组证据

| 验收项 | 具名测试 | 冒烟步骤 | 证据 |
|---|---|---:|---|
| 版本缺失/高版本拒收 | `test_import_missing_version_rejects_whole_batch` / `test_import_higher_version_rejects_whole_batch` | 36/37 | `green-import-pure.log`、`qa-smoke.log` |
| schema 整批拒收 | `test_import_invalid_record_rejects_schema_without_partial_plan` | 38 | 同上 |
| 往返一致 | `test_import_roundtrip_and_idempotent_anchor` | 34 | `green-import-anchor.log`、`qa-smoke.log` |
| 幂等锚点 | 同上 | 35 | 同上 |
| 记录级跳过 | `test_import_schema_rejection_is_whole_batch_and_record_skip_is_isolated` | 35 | 同上 |
| API 注册 | `importRoutes` 断言 `POST /api/v1/import` | 33 | `green-import-anchor.log` |

## 4. 已知边界

- 导入输入兼容 v0.5 HTTP 响应 envelope（`.data`）和裸 `UserExportContract`。
- 主键冲突视为已存在；跨账号同主键不会静默覆盖。
- AppHost 外部发布入口若工作流未注入，本轮只能执行仓库内 production deploy 复验；该阻塞将如实记录，不伪造 AppHost 记录。

