# 心伴 v0.6 评审记录（第三方审查）

评审对象：五节点上游全部产出（freeze b9ba6dd / red b8c3788 / green 9165cfc / deploy f6b4a52 / 复验 34b047c）。
评审方式：文档逐份核对 + 代码逐行审查 + 门禁独立实跑（不采信上游日志）+ 行为探针实证。

## 1. 机判复验（评审独立实跑，2026-10-08）

| 门 | 结果 | 与上游声明 |
|---|---|---|
| `npm run build` | exit 0，Web 导出正常 | 一致 |
| `npm test` | server 15 files / 70 tests，mobile 4 files / 31 tests，exit 0 | 一致 |
| `npm run smoke` | `38 项 / 38 项`，exit 0；v0.5 锚点 01-31 原样保留 | 一致 |
| `npm run persist:check` | `9 项，exit=0` | 一致 |
| 死测试四类扫描 | 0 / 0 / 0 / 0 | 一致 |
| AppHost release tar | 签名 GET 200（189,981 bytes），SHA256 与留档逐位一致 | 一致 |

## 2. 范围与契约复核

- 冻结项 F1-F6 全部落地，均有具名测试与冒烟锚点对应（33-38 ↔ F1/F3-F6）。
- 契约四件套齐备：接口 / 数据 / 错误 / 兼容；三个 IMPORT_* 错误码已注册进 `errors.ts`，错误码表与实现逐项一致。
- 导出/导入契约字段级对齐：`metadata`/`payload` 对象化、枚举白名单、`keywords`/`tags` 逗号数组往返、日期 toISOString 归一，均与 `exportData.ts` 闭环自洽。
- 幂等锚点设计正确：主键保留 + 批次内唯一 ID / 内部引用校验 + `CONVERSATION_EXISTS` skip；smoke 修正 ID 落在 1,000,000+ 区间避开真实自增序列。
- 红测证据真实：`red-server.log` 两 suite 因 `ERR_MODULE_NOT_FOUND` 失败，属正确原因的红。
- `red()` 立即 `exit 1`，冒烟不可能带红打出 38/38。

## 3. 红队复核

1. **越权**：import 强制 Bearer，全部写入绑定 `authUser.id`；export 查询沿用 v0.5 `userId` 过滤。
2. **拒收零写入**：版本门 / format 门 / schema 门均在任何写库前抛 422；持久化测试以计数锁定零写入。
3. **记录级隔离**：已存在 conversation 仅 skip，同批其他 conversation 继续导入（测试 + 冒烟 33/35 双验证）。
4. **不导入敏感表**：DeviceSession/SmsCode/凭据/订单无任何写入路径。
5. **中段失败**：批次中段存储异常会以非 OK 响应返回且先前 conversation 已提交——契约未定义该语义（见发现 3）。

## 4. 发现与修改意见（均非阻塞，按优先级）

| # | 级别 | 发现 | 证据 | 建议 |
|---|---|---|---|---|
| 1 | 建议列入下轮冻结 | 版本门无下界：`schemaVersion = 0 / 0.5 / -1` 被接受并回显（探针实证）；冻结文本 F4 只定义"缺失或 >1 拒收"，实现与冻结字面一致，属契约口径缺口 | 本评审探针：0/0.5/-1 ACCEPTED，2 REJECTED | 冻结口径补"非正整数版本 → 422 IMPORT_VERSION_UNSUPPORTED"，红转绿补测试 |
| 2 | 文档漂移 | `README.md` L18 仍写"v0.5 全链路冒烟，预期 31/31"，与同文件 L52"38 项断言"及实际 38 项锚点矛盾 | README 快速验收段 | 1 行改为 v0.6 / 38 项 |
| 3 | 健壮性 | conversation 预检（findMany）与写入（create）非原子：并发同备份或中段 P2002 时出现"部分写入 + 非 OK 响应"；F5 只约束顺序重复导入（已满足） | routes/import.ts L151-175 | 后续将 P2002 归一为 skipped，或在契约中显式定义批次中段失败语义 |
| 4 | 设计取舍（已文档化） | 跨账号同主键 conversation 返回 `CONVERSATION_EXISTS`（预检未加 userId 过滤），存在会话 ID 存在性探测面 | DEVELOPMENT.md 已明示"跨账号同主键不会静默覆盖" | 原型可接受；生产化前评估按账号域隔离 skip 口径 |
| 5 | 死代码 | `importData.ts` L176 `message.metadata === undefined` 不可达（L75 `objectValue` 已拒非对象） | 代码审查 | 可删除 |
| 6 | 规范微偏 | 项目规范要求"使用 interface 定义对象类型"；`ImportResult`/`ImportSummary` 用了 type alias | routes/import.ts L14-27 | 随下次触达该文件时改为 interface |
| 7 | 平台侧待修 | code-review-graph 注册表仅注册 g2-blocks，心伴仓库未注册；仓库本体在位且全门可机判，不阻塞本轮 | `list_repos` 仅 1 条 | 请平台补注册，恢复图谱审查能力 |

## 5. 结论

**通过。** 五节点产出真实、可机判、可复现；冻结范围零越界，红绿留证与断言三件套齐备，v0.4/v0.5 兼容链无漂移，AppHost 发布物与留档逐位一致。第 1、2 项建议列入下轮最小修正，其余为备注级。
