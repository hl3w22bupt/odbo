# 心伴 v0.6 Deploy 留档

## 仓库 production deploy 复验

| 门 | 命令/检查 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| deploy build | `npm run deploy:v02`（production dist build） | 0 | server + mobile Web 导出 | `deploy-replay.log` |
| deploy schema | `prisma db push` additive | 0 | deploy SQLite ready | 同上 |
| deploy start | `dist/localServer.js` + `/health` | 0 | `status=up` | 同上 |
| deploy build 复跑 | `npm run build` | 0 | 通过 | 同上 |
| deploy start 复跑 | production start + health | 0 | 通过 | 同上 |
| deploy test 复跑 | `npm test` | 0 | server 70 + mobile 31 | 同上 |
| 部署后冒烟 | `npm run smoke` | 0 | 38/38 | `post-deploy-smoke.log` |
| 部署后持久 | `npm run persist:check` | 0 | 9/9 | `post-deploy-persist.log` |

## AppHost 资产导出

- 导出来源：`npm run build` 生成的 `apps/mobile/dist-web`。
- AppHost 对象存储：`OBJECT_STORAGE_ENDPOINT`，bucket `myrd`。
- 对象键：`runs/cmuyq23k10021m93ew3n6padp/xinban-v0.6/xinban-v0.6-web.tar.gz`。
- 上传结果：HTTP 200。
- AppHost 下载 URL（SigV4，7 天有效）：
  \`http://localhost:9000/myrd/runs/cmuyq23k10021m93ew3n6padp/xinban-v0.6/xinban-v0.6-web.tar.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=myrd%2F20261007%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261007T233929Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=d02023ba0988be39a3a9f2e664a2a32e44d73b2f8c6e20e598c9a6a7531a8642\`
- SHA256：\`f582695db7e336f57df9c86e7fd1fd4763c7fa7f73a8ed0ad6d2e486d3e06da1\`
- 直接未签名 GET 返回 403；已验证 AppHost 签名 GET 为 200。
- 平台本轮未注入额外的 AppHost 发布登记 API；因此以上为可复现资产导出和签名发布物，不伪造平台部署单号。

## 复验命令

\`\`\`bash
npm run deploy:v02
npm run smoke
npm run persist:check
\`\`\`
