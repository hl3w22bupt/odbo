# 心伴 v0.9 Deploy 留档

deploy 执行锚点：`a37dbae`（QA 闭环提交；deploy 时交付代码已全部入库，工作树仅含本轮 deploy 留档）。门禁时间 `2026-10-12T07:27-07:28 Asia/Shanghai`。

## 1. production deploy 复验

| 门 | 命令/检查 | 退出码 | 结果 | 留证 |
|---|---|---:|---|---|
| deploy build/start/test | `npm run deploy:v02` | 0 | production `dist/localServer.js` 启动 + `/health` up；post-deploy build=0、start=0、test=0（95+33） | `node5-deploy-replay.log` / `.exit` |

按平台纪律，不手动触发外部平台默认工作流；本轮完成仓内 production deploy 复验与部署回流冒烟，外部发布交由平台默认 deploy 工作流处理。

## 2. 部署后冒烟闭环

| 门 | 部署前 QA | 部署后 | 对照 | 留证 |
|---|---:|---:|---|---|
| smoke | 46/46，exit 0 | **46/46，exit 0**（01-45 v0.8 基线 + 46 CSV 产物探针） | 一致 | `node5-post-deploy-smoke.log` |
| persist | 9/9，exit 0 | **9/9，exit 0** | 一致 | `node5-post-deploy-persist.log` |
| test | 95+33，exit 0 | **95+33，exit 0** | 一致 | `node5-deploy-replay.log` |
| schema | 0 diff | 0 diff | 一致 | `node4-schema-diff.log` |

第 46 步按 `docs/smoke/v0.9.md` 验证：HTTP 200、UTF-8 BOM、固定表头、5 数据行、4 列、维度顺序、`X-Report-Row-Count=5`、ISO 生成时间。

## 3. 签收

deploy 冒烟全链路绿，QA DoD 第 9 条回填 ☑。**v0.9 验收闭环：通过（DEPLOY CLOSED）。**

停车场维持：轨迹增强 P1、PDF 导出、历史捞回候选均不入主线。
