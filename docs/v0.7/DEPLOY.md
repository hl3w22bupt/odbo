# 心伴 v0.7 Deploy 留档

## 仓库 production deploy 复验

| 门 | 命令/检查 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| deploy build | `npm run deploy:v02` | 0 | server + mobile Web 导出 | `deploy-replay.log` |
| deploy schema | additive `prisma db push` | 0 | 本轮无 schema diff，仅既有部署库同步 | 同上 |
| deploy start | `dist/localServer.js` + `/health` | 0 | `status=up` | 同上 |
| deploy build 复跑 | `npm run build` | 0 | 通过 | 同上 |
| deploy start 复跑 | production start + health | 0 | 通过 | 同上 |
| deploy test 复跑 | `npm test` | 0 | server 76 + mobile 33 | 同上 |
| 部署后冒烟 | `npm run smoke` | 0 | 42 / 42，与 QA 一致 | `post-deploy-smoke.log` |
| 部署后持久 | `npm run persist:check` | 0 | 9 / 9 | `post-deploy-persist.log` |

## AppHost 资产导出

- 导出来源：`npm run build` 生成的 `apps/mobile/dist-web`，打包为 `xinban-v0.7-web.tar.gz`。
- 对象存储：`OBJECT_STORAGE_ENDPOINT` / bucket `myrd`。
- 对象键：`runs/cmv05adee002sm9vi6dtn7xlt/xinban-v0.7/xinban-v0.7-web.tar.gz`。
- PUT：HTTP 200，见 `apphost-upload.log`。
- SHA256：`4b2eeecc7823ccbe984f21d16aebbc795f0d4e4ebdec59ff220f59034961726c`，见 `apphost-release-sha256.txt`。
- 回读：带 S3 签名的 GET HTTP 200，大小 190724 字节，SHA256 与发布包一致，见 `apphost-download-check.log`。
- 对象 URL：见 `apphost-url.txt`。当前环境未注入公开下载授权 API；为不泄露对象存储凭据，不伪造带签名的长期公开 URL，发布验签以回读日志为准。

## 结果一致性与签收

部署前 QA：smoke 42 / 42、persist 9 / 9、test 76+33 全绿。部署后同一三组数值完全一致，无回退。**验收闭环：通过。**
