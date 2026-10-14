# v0.12 基线复核（2026-10-15）

## 结论

v0.11 实质落地，v0.12 维持「CSV 导入」P0，不切换洞察还账。

## 真实门禁

| 门禁 | 命令 | 退出码 | 结果 |
|---|---|---:|---|
| setup | `npm run setup` | 0 | server/mobile 依赖安装；Prisma generate/db push/seed 成功 |
| build | `npm run build` | 0 | server tsc、mobile typecheck、Web export 成功 |
| start | temp SQLite + `npm run start:standalone` | 0 | `/health` 200，`status=up` |
| test | `npm test` | 0 | server 24 files / 140 passed；mobile 8 files / 49 passed |
| smoke | `npm run smoke` | 0 | 54 / 54，v0.11 旧编号零漂移 |

证据：`evidence/node1-baseline-*.log|exit|json`。

## 漂移分级

- **阻塞**：0。
- **非阻塞**：3。
  1. mobile Vitest 提示 `vitest.config.ts` 未来 Vite native loader 兼容性警告（本轮清扫为 `.mjs`，见 DEVELOPMENT）。
  2. `scripts/dev-up.sh` 的 stop 侧不负责本基线；手动临时服务必须递归清理 npm/tsx 进程树并按端口兜底，避免端口假占用。
  3. `apps/server/dist` 构建产物不入库，复验必须先 build/start。

## 冻结前干跑事实

以真实 v0.9 端点 `GET /api/v1/conversations/:id/mood-period-comparison/export.csv?periods=1` 生成 `evidence/dry-run-v09-export.csv`：

- UTF-8，字节序 `EF BB BF` BOM；CRLF 行尾。
- 表头精确为 `period_id,date,dimension,value`。
- 5 个数据行；`period_id === date`，均为东八区周一 `YYYY-MM-DD`。
- 数值保留 JSON number 直序列化；样本 averageScore 为 `0`。解析器按 finite number 保留双精度值，不四舍五入。
- 真实文件反向喂冻结前解析干跑成功，见 `evidence/dry-run-parser-facts.txt`。

## 未知周期标识容忍度定案

- 路由目标期非法（非真实日期/非周一）：既有 404/400 拒绝。
- 合法但无历史数据的周一：对比补空、洞察返回空结构，不 500。
- 导入采用更严格格式校验：`period_id` 与 `date` 必须是同一真实东八区周一；不存在于既有报告的历史周期可作为全新周期导入。
