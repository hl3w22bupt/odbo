# 心伴 v0.2 交付 DoD 打勾表

范围冻结：只交付 IN-1 基线与 IN-2 持久化增量；未改既有对外接口；未实现注册加固、交互增强、展示优化或外部供应商接入。

| # | 验收项 | 状态 | 可机判证据 | 测试 / 断言名 |
|---|---|---|---|---|
| 1 | 冒烟基线 | [x] | `docs/smoke/v0.2-base.md` 存在且非空；build=0 / start=0 / test=0；基线 41 过 / 0 挂 / 0 死 | `npm run build`；`npm run server:start` + `/health`；`npm test` |
| 2 | 重启持久性 | [x] | `npm run persistence:v02` 退出码 0；真实 HTTP 写入 → `kill -9` → 重启 → 读回一致 | `scripts/persistence-v02.sh` #12 `kill 后会话消息读回一致`；#13 `kill 后情绪读回`；#14 `kill 后情绪内容一致` |
| 3 | 新增量覆盖 | [x] | 每增量 ≥1 happy path + ≥1 边界/失败路径；新增挂 0 且死 0；全量 47 过 / 0 挂 / 0 死 | happy：`createEmotion 持久化合法情绪`、`upsertEmotion 覆盖现有伴生态`；边界：`getEmotion 丢弃旧/坏 payload 与未知情绪，回退默认`、`updateEmotion 边界分数被夹紧到 [-1, 1]`、`deleteEmotion 删除伴生态`；失败：`safeUpsertEmotionFromContent 持久层抛错时返回 false 且不阻断主链路`；集成：`scripts/persistence-v02.sh` #15-#18 |
| 4 | 部署复验 | [x] | `npm run deploy:v02` 退出码 0；deploy `/health` 过；部署后 build=0 / start=0 / test=0 | `scripts/deploy-v02.sh`：`deploy /health`、`post-deploy rerun: build`、`post-deploy rerun: start`、`post-deploy rerun: test` |

## 新增量覆盖矩阵

| 增量 | Happy path | 边界 / 失败路径 |
|---|---|---|
| 情绪 CRUD 持久化 | `createEmotion 持久化合法情绪` / `upsertEmotion 覆盖现有伴生态` / `deleteEmotion 删除伴生态` | `updateEmotion 边界分数被夹紧到 [-1, 1]` |
| 旧数据兼容 | 合法读回：`scripts/persistence-v02.sh` #14 `kill 后情绪内容一致` | 不可读丢弃：`getEmotion 丢弃旧/坏 payload 与未知情绪，回退默认`；`scripts/persistence-v02.sh` #15 `坏情绪数据丢弃回退默认` |
| 主链路降级 | 正常聊天伴生更新：`scripts/persistence-v02.sh` #05 `主链路消息写入` | 缺表写失败：`safeUpsertEmotionFromContent 持久层抛错时返回 false 且不阻断主链路`；`scripts/persistence-v02.sh` #16-#18 |

## 审查门槛回填

- 存量非阻塞债不阻断本合并；未发现新的存量阻塞项。
- 新增量未发现会话/消息/情绪数据丢失类缺陷；`persistence:v02` 18/18 通过。
- 新增量测试缺失为 0；新增挂 0、死 0。
