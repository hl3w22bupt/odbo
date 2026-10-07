# 心伴 v0.6 P0 · JSON 数据导入冻结版

状态：FROZEN（本轮执行期不接受口头扩需求）。

## 1. 冻结目标

补全 v0.5 `备份导出 → 恢复导入` 写侧闭环：登录用户可把 v0.5 导出的 `xinban-json` 备份导入当前账号，且重复导入不得产生重复业务数据。

## 2. 冻结范围

| # | 冻结项 | 内容 |
|---|---|---|
| F1 | 导入 API | `POST /api/v1/import`；Bearer 鉴权；body 为 v0.5 用户导出 JSON |
| F2 | 恢复实体 | 按 conversation 批次恢复 messages、memories、emotion、moodSnapshots 及 corrections；不恢复 DeviceSession/SmsCode/凭据/订单 |
| F3 | 拒收/跳过分列 | schema 非法 → 整批拒收且零写入；已存在 conversation → 记录级 skip 并继续其他 conversation |
| F4 | 版本门 | `schemaVersion` 缺失或 `> 1` 整批拒收；`format != xinban-json` 整批拒收 |
| F5 | 幂等锚点 | 同一备份重复导入：首次 imported，二次全部 skipped；业务表计数不变 |
| F6 | 往返一致 | 同一账号导入后再导出，`conversations` 与源备份逐字段一致（不含顶层 `exportedAt`） |

## 3. 契约四件套

### 3.1 接口契约

- 成功：HTTP 200，`code=OK`。
- 请求：`POST /api/v1/import`，`Authorization: Bearer <accessToken>`，`Content-Type: application/json`。
- 响应 data：`{ schemaVersion, format, received, imported, skipped, results[] }`。
- `results[]`：`{ conversationId, status: 'imported'|'skipped', reason? }`。

### 3.2 数据契约

- 输入实体与字段复用 `apps/server/src/lib/exportData.ts` 的 `UserExportContract / ExportConversationContract`。
- 不新增迁移、不改 v0.5 表结构、不引入外部依赖。
- `metadata`、`payload` 存 SQLite JSON 字符串；`keywords`、`tags` 存逗号分隔字符串。
- 日期必须是可解析 ISO 字符串；枚举与导出契约一致。

### 3.3 错误契约

| 场景 | HTTP | code | 写入数 |
|---|---:|---|---:|
| 版本标记缺失 | 422 | `IMPORT_VERSION_MISSING` | 0 |
| 版本高于 1 | 422 | `IMPORT_VERSION_UNSUPPORTED` | 0 |
| format/schema/记录结构非法 | 422 | `IMPORT_SCHEMA_REJECTED` | 0 |
| 未登录/token 无效 | 401 | `UNAUTHORIZED` | 0 |
| 环境引用缺失（如 characterId 不存在） | 200 | 记录 `CHARACTER_NOT_FOUND` | 该记录 0 |

### 3.4 兼容契约

- v0.5 导出文件必须原样可导入。
- v0.4/v0.5 冒烟命令语义不变：`npm run smoke`、`npm run persist:check`、`npm run deploy:v02`。
- 老导出 `schemaVersion=1` 与本轮输入版本一致；若未来版本升到 2，v1 只能继续由当前服务导入，v2 必须新增显式兼容层。

## 4. 可机判 DoD 打勾表

- [ ] F1 路由契约：route test 断言 `POST /api/v1/import` 已注册、鉴权后 200、响应字段完整。
- [ ] F2 实体恢复：route test 注入捕获创建调用，断言 4 类实体及其关联全部传给存储层。
- [ ] F3 整批/跳过分列：schema 非法时 route test 断言 422 且零 `create`；重复 conversation 时返回 `skipped` 并继续导入新 conversation。
- [ ] F4 版本门：缺 `schemaVersion` 与 `schemaVersion=2` 分别返回固定 code；`schemaVersion=1` 通过。
- [ ] F5 幂等：持久化测试首次 `imported=1`，同备份第二次全部 `skipped`，conversation/message/memory/moodSnapshot/correction 计数不变。
- [ ] F6 往返：纯函数/持久化测试先导出→导入→再导出，`conversations` JSON 逐字段一致。
- [ ] 冒烟：`scripts/smoke.sh` 在 v0.5 01-31 后追加 32-38 导入链；末行 `心伴 v0.6 冒烟通过：38 项 / 38 项`。
- [ ] 兼容回归：`npm run build`、`npm test`、`npm run smoke`、`npm run persist:check`、`npm run deploy:v02` 全 0。
- [ ] 死测试：四类扫描 0 且 Vitest 无 skipped/todo。
- [ ] 文档：`docs/smoke/v0.6.md` 同步为 v0.6 基线。

状态必须在红测→绿测→冒烟证据齐备后才改 `[x]`。

## 5. 非范围

- CSV/PDF、匿名导入、管理员跨账号导入、字段级合并、删除覆盖、自动定时备份、导入进度任务、新存储引擎。
