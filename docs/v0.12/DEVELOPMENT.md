# v0.12 开发说明

## 技术选型

- Prisma + SQLite；只新增 `ImportedPeriodMetric` 台账表，不修改既有表字段。
- 零 CSV 依赖；新增纯函数 RFC 4180 parser + validator，Node `TextDecoder({fatal:true})` 承担 UTF-8 硬边界。
- 导入产物映射为既有 P0 记忆 + P1 快照，保证既有导出/聚合/洞察不需要修改契约。
- Web 入口复用 Toast 与既有 ChatScreen 信息区，无新路由页面。

## 模块边界

1. `apps/server/src/lib/periodCsvImport.ts`
   - 解析 BOM/RFC4180、精确表头、行数、UTF-8、行字段/日期/维度/数值。
   - 周期组无损还原校验和 1000 行门禁。
   - 输出纯结果，不触 Prisma。
2. `apps/server/src/routes/moodComparison.ts`
   - additive import handler；鉴权/归属、CSV 字节适配、调用纯函数、单事务写 P0/P1/台账。
   - 不改既有 comparison/export handler 与路由注册。
3. `apps/server/src/lib/periodCsvImportPersistence.test.ts` + `periodCsvImport.route.test.ts`
   - 错误矩阵、幂等、原子、往返、聚合/洞察消费。
4. `apps/mobile/src/utils/csvImport.ts`
   - 结构化结果摘要、封闭码文案、禁静默契约。
5. `apps/mobile/src/screens/ChatScreen.tsx`
   - 信息区按钮 + 隐藏 Web file input；完成后刷新当前周期洞察并 toast。

## 交付顺序

1. 冻结契约与 DoD 落盘（本目录）。
2. 红测：导入模块/路由目标接口先挂；留红日志。
3. 增量实现 schema/model、parser、route、client summary 与入口。
4. 绿测 + build/test/smoke/persist/重启持久化。
5. QA 独立复核错误码 fixture、计数、原子、往返、双端消费、边界与死测试。
6. deploy 后执行 v0.11 全量 smoke + v0.12 55-58 增量链。

## 技术债清扫

- 清扫 mobile Vitest 未来 loader 兼容警告：`vitest.config.ts` 迁移为 `vitest.config.mjs`，测试输出不再出现 Vite native loader 警告；证据入 QA。
