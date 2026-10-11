# 心伴 v0.5 质量验收报告

## 结论

**验收通过（准备 deploy）**。终验时间以证据文件为准；所有时间断言只使用 ISO 结构和“先写→重启→仍可读”的相对关系，没有绝对日期阈值或全文 diff。

## 1. 门禁结果

| 门 | 命令 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| 构建 | `npm run build` | 0 | 通过 | `docs/v0.5/evidence/qa-build.log` |
| 全量测试 | `npm test` | 0 | server 13 files / 59 tests；mobile 4 files / 31 tests | `docs/v0.5/evidence/qa-test.log` |
| 冒烟 | `npm run smoke` | 0 | 31/31 | `docs/v0.5/evidence/qa-smoke.log` |
| 持久 | `npm run persist:check` | 0 | 9/9 | `docs/v0.5/evidence/qa-persist.log` |
| 死测试 | grep + Vitest 输出复核 | 0 | 0 | `docs/v0.5/evidence/final-dead-test-scan.log` |
| 源码 lint | `npx eslint src --max-warnings 0` | 0 | mobile src 通过 | `docs/v0.5/evidence/mobile-src-lint.log` |
| 红测留证 | 增量实现前 targeted Vitest | 1 | 红 | `red-server.log` / `red-mobile.log` |
| 绿测锚点 | targeted Vitest | 0 | server 23 + mobile 2 | `green-server.log` / `green-mobile.log` |

## 2. 三元组绑定

| 验收项 | 具名测试 | 冒烟步骤 | 结论 | 证据 |
|---|---|---:|---|---|
| 修正追加并跨重启 | `test_edit_persists_across_restart` | 23-24 | PASS | `green-server.log`、`qa-smoke.log` |
| 不存在禁 500、明确 404 | `test_edit_nonexistent_returns_defined_error` | 26 | PASS | 同上 |
| latest-wins | `test_correction_latest_wins` | 25 | PASS | 同上 |
| 写失败旧值可读 | `test_correction_write_failure_preserves_old_value` | 28 | PASS | 同上 |
| 导出空库合法结构 | `test_export_empty_db_returns_valid_empty` | 31 | PASS | 同上 |
| v0.4 数据 v0.5 可读 | `test_v04_data_readable_by_v05` | P01-P09 + 23-30 | PASS | `qa-persist.log`、`qa-smoke.log` |
| UI 最小修正入口/即时更新 | `creates the minimal correction form...`、`applies a correction result...` | 27 | PASS | `green-mobile.log` |
| JSON only + schema | `serializes the frozen export schema...` | 29-30 | PASS | `qa-smoke.log` |

## 3. 冒烟增量链

- **① 编辑链 23-25**：POST correction → kill → 同一 SQLite 重启 → 二次 correction → jq 断言 `mood/score/originalMood/originalScore`。
- **② 标注链 27**：同一 correction payload 携带 `tags` 与 `reason`；timeline/导出可见；UI 回调与 state 局部更新具名测试锁定。
- **③ 导出链 29-31**：curl 记录 `Content-Type`；jq 断言 `schemaVersion/format/conversations/messages/memories/moodSnapshots/corrections`；新空用户返回 `conversations:[]`。
- **④ 降级×编辑 26/28**：不存在目标 HTTP 404 + `NOT_FOUND`；注入写失败返回 `degraded=true/persisted=false` 且 point 保留原值。

## 4. 兼容与数据

- `MoodSnapshot` 未改字段；`MoodCorrection` 是 additive 新表。
- v0.2 P01-P09 全绿；smoke 01-22 全绿。
- 旧 point 读回新增默认字段：`tags=[],reason="",originalMood=null,originalScore=null,correctionId=null,correctedAt=null`。
- 导出 schema 排除令牌、验证码、刷新会话与支付凭据。

## 5. 已知边界

- deploy 前不手工启动生产进程；`scripts/deploy-v02.sh` 已保留为工作流入口，并在 build 后同步 additive schema。
- 空态导出、空态 timeline、降级 timeline 均返回 200 显式结构；不把空库解释成 404/500。
- CSV/PDF、通知、新存储引擎、破坏性迁移全部留在停车场。
