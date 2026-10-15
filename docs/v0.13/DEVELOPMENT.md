# v0.13 开发说明

## 技术选型

- 持续使用 Prisma + SQLite、standalone Node HTTP runtime、API 端口 3888；本轮零 schema 变更。
- Web 导入导出复用 React Native Web 事件模型：`input[type=file]` 选择文件，`Blob` + anchor click 下载；不引入文件库。
- 前端可测逻辑抽为纯函数：端点/方法、RFC 5987、反馈明细封顶/转义、服务端权威收敛；组件只做编排与渲染。
- 服务端未知周期容错只新增响应字段与 additive `period_ids` 查询，不改既有聚合器算法、Prisma 读侧与错误码。

## 模块边界

1. `apps/mobile/src/utils/dataExchange.ts`
   - 导出端点/方法、Content-Disposition 解析、Blob/anchor 下载、RFC 5987。
   - 导入端点/方法、1000 行预检、服务端权威收敛、纯文本转义。
2. `apps/mobile/src/utils/csvImport.ts`
   - 消费既有 `failures`，输出计数、封顶 3 条行号/原因明细与 `+N 行`。
3. `apps/mobile/src/components/PeriodDataExchangeCard.tsx`
   - 唯一卡片组件；由 HomeScreen（设置位）与 ChatScreen（报告位）复用。
   - 组件负责文件选择、raw CSV 下载、toast、明细列表；不新建路由。
4. `apps/server/src/routes/period.ts` / `moodComparison.ts`
   - 单周期/跨周期洞察未知目标或显式未知序列改 200 合法降级 + additive 提示位。
   - 跨周期洞察支持 `period_ids` 混合/未知输入，并输出 additive 提示位。
5. `apps/server/src/routes/moodComparison.ts`
   - CSV 导入响应在未知周期场景追加 `meta` / `warnings`；既有七字段与 failures 明细零变更。

## 交付顺序

1. 冻结契约与本开发说明；不中途扩权。
2. 先红：server 开放点、导入契约、导出头；mobile 数据交换纯函数。
3. 后绿：路由实现 + 卡片组件双入口挂载。
4. 复跑聚合/洞察既有测试全集、全量 server/mobile、smoke、持久化与 deploy 冒烟。
5. 回填 QA/REVIEW/smoke 文档与 evidence。

## 冻结边界

- 无 Prisma schema diff、无删除字段、无新增外部依赖。
- 不改 v0.9 CSV 解析/导出算法、不改导入事务写入主链路。
- 不改既有 API 七字段导入结果语义；只允许未知周期场景追加字段。
- 不新建页面、不改路由表；卡片只挂两处。
