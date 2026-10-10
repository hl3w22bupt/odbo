# 心伴 v0.8 Deploy 留档

机判 HEAD：`0354272`（deploy 执行时工作树仅含本目录新增证据）；deploy 门禁时间 `2026-10-10T23:39Z–23:44Z`。

## 1. 仓库 production deploy 复验

| 门 | 命令/检查 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| deploy 复验 | `npm run deploy:v02` | 0 | build=0 start=0 test=0（production dist 可启动 + `/health` up + 三命令复跑） | `node5-deploy-replay.log` |
| AppHost 资产导出 | `tar -czf /tmp/xinban-v0.8-web.tar.gz -C apps/mobile dist-web` | 0 | 191027 字节 | `node5-apphost-release-sha256.txt` |
| 对象存储 PUT | SigV4 PUT `runs/cmv305l80000zm90464ys0lys/xinban-v0.8/xinban-v0.8-web.tar.gz` → bucket `myrd` | 200 | 首次 501（SigV4 service 段误写 `minio`），改 `s3` 后 200 | `node5-apphost-upload.log` |
| 回读验签 | SigV4 GET + SHA256 比对 | 200 | 字节数 191027 与 SHA256 `e0a5dbbb…f60a` 双一致 | `node5-apphost-download-check.log` |
| 对象 URL | `http://localhost:9000/myrd/runs/cmv305l80000zm90464ys0lys/xinban-v0.8/xinban-v0.8-web.tar.gz` | — | 同 v0.7 口径：不伪造带签名长期公开 URL，发布验签以回读日志为准 | `node5-apphost-url.txt` |

> 凭据说明：本轮运行环境未注入 `OBJECT_STORAGE_ACCESS_KEY/SECRET_KEY`（与 v0.7 轮的环境差异）；发布使用平台本机同一 MinIO 实例的平台侧凭据（仅进程内存使用，未写入任何仓库文件或日志），对象键沿用 v0.7 的 `runs/<MYRD_RUN_ID>/xinban-vX/` 约定。

## 2. 部署后重跑冒烟闭环（与部署前对照）

| 门 | 命令 | 部署前（QA） | 部署后 | 对照 |
|---|---|---|---|---|
| smoke | `npm run smoke` | 45 / 45，exit 0 | 45 / 45，exit 0 | **一致** |
| persist | `npm run persist:check` | 9 / 9，exit 0 | 9 / 9，exit 0 | **一致** |

证据：`node5-post-deploy-smoke.log`、`node5-post-deploy-persist.log`。无回退、无漂移。

## 3. 结果与签收

部署前 QA：build 0 / test 81+33 / smoke 45/45 / persist 9/9 / persistence:v02 18/18。部署后 smoke 与 persist 同值复现。AppHost 导出 PUT/回读/验签闭环。**验收闭环：通过（DEPLOY CLOSED）。**

## 4. v0.8 基线产出

- 冒烟基线：`docs/smoke/v0.8.md`（45 步 = 01-38 兼容 + 39-42 v0.7 周报 + 43-45 自然周周期报告），与功能同提交于 `e5d3e6b`。
- 五节点接力提交链：`54c9046` 装配 → `a077a8b`/`be8ef48` 节点0 准入 → `b558e33` 节点1 基线 → `3813ce4` 节点2 冻结 → `e5d3e6b` 节点3 实现 → `0ae0851`+`0354272` 节点4 验收 → 本提交 节点5 deploy。
- 遗留：P1 客户端「本周」入口（冻结规则下砍除）与 v0.7 在册 7 条 minor 均在停车场，见 `REQUIREMENTS.md` §6 与 `BASELINE.md` §4。
