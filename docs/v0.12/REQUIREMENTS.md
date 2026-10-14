# 心伴 v0.12 P0 · 周期数据 CSV 导入

状态：FROZEN-SIGNED（2026-10-15 产品/架构/实现/QA 接力冻结；执行期不扩需求）。

## 1. 范围

1. 新增 v0.9 多周期对比 CSV 的导入解析、全量校验、单事务入库与幂等。
2. 导入产物写入 P0 `ConversationMemory` 与由其派生的 P1 `MoodSnapshot`，使既有 v0.9 导出、周期聚合、洞察零改动即可消费。
3. 新增用户可见导入入口（非新页面），完成即时 toast 计数摘要。
4. 不改 v0.7 轨迹渲染、v0.9 导出端点、v0.10/v0.11 insight 端点；不改既有 API 契约与既有主链路写入逻辑。

## 2. API 契约

- 路由：`POST /api/v1/conversations/:id/mood-period-comparison/import.csv`，挂在 v0.9 导出位旁。
- 鉴权：Bearer；未登录 401；非本人/不存在会话 404 `NOT_FOUND`。
- 请求：`Content-Type: text/csv`，body 为 UTF-8 文件字节；客户端 File Reader 转文本后也可用 JSON `{ csv }` 调用，仅作 UI 便捷通道，服务端同一解析器。
- 成功/行级校验响应均 200 JSON 信封；文件级格式错误见 §5。
- 结果：
```json
{
  "received": 15,
  "imported": 10,
  "skipped": 5,
  "failed": 0,
  "failures_total": 0,
  "failures": [],
  "result_code": "OK"
}
```
- 计数不变量：`imported + skipped + failed === received`。`failures_total` 是行级失败总数；`failures` 封顶 20 条，按原文件顺序。
- 行级失败项：`row`（表头后 1 起）、`line`（物理文件 1 起）、`periodId/date/dimension` 可提取值、`code`、`message`。

## 3. CSV 契约

- 列结构单一事实来源：`apps/server/src/lib/csvExport.ts` 的 `CSV_HEADER`，导入不得复制字符串数组。
- UTF-8；容忍 UTF-8 BOM；RFC 4180 记录解析。
- 表头逐字段、逐序精确匹配；否则文件级 `INVALID_HEADER`。
- 空字节流或仅 BOM/空白：200，`received=0`，`result_code=EMPTY_FILE`。
- 数据行 4 列；缺列/维度缺失或未知 → `MISSING_FIELD`。
- `period_id` 与 `date` 必须为同一真实东八区周一 `YYYY-MM-DD` → 否则 `INVALID_DATE`。
- `count/positive/neutral/negative` 为非负整数；`averageScore` 为 finite number → 否则 `INVALID_VALUE`。
- 每个周期 5 个维度齐备后才可构造样本组；缺维度时该组所有行 `MISSING_FIELD`。数值组还需满足 `positive+neutral+negative=count` 且 `averageScore===(positive-negative)/count`，否则相关行 `INVALID_VALUE`；这是将聚合值无损还原为 P0/P1 样本的必要约束。
- 同一文件内业务键重复：首次出现可入库，后续行 `DUPLICATE`。
- 幂等键：周期标识 + 日期 + 维度，以会话为归属分区；已存在键整行跳过且不覆盖。同文件重导时 5 键全命中 → `skipped=received`。
- 上限 1000 个解析数据行；1001 行触发 413 `ROW_LIMIT_EXCEEDED`，整文件拒绝。
- 非 UTF-8 字节触发 400 `ENCODING_ERROR`。

## 4. 写入与消费

- 全量校验通过后，单个 Prisma 事务写入：
  1. 每个可还原样本一条 ACTIVE `ConversationMemory`；
  2. 每个样本一条指向该 P0 记忆的 `MoodSnapshot`；
  3. 每 CSV 数据行一条 `ImportedPeriodMetric` 幂等台账。
- 样本 `createdAt` 使用周期周一日 12:00 UTC+8，保证落入自然周且可复现。
- 事务中途任何失败整体回滚，主链路零残留。
- 台账旧/脏数据不参与聚合；聚合只消费成功落库且 ACTIVE 的 P0/P1 数据。
- 全无效文件不建事务写样本，返回 200 合法空写结果。

## 5. 错误码封闭枚举

`EMPTY_FILE / INVALID_HEADER / MISSING_FIELD / INVALID_DATE / INVALID_VALUE / DUPLICATE / ROW_LIMIT_EXCEEDED / ENCODING_ERROR`

文件级映射：`INVALID_HEADER` 400；`ROW_LIMIT_EXCEEDED` 413；`ENCODING_ERROR` 400。`EMPTY_FILE` 200。行级仅使用 `MISSING_FIELD / INVALID_DATE / INVALID_VALUE / DUPLICATE`。

## 6. UI

- 零新页面；在既有聊天洞察信息区追加「导入周期 CSV」按钮。
- Web 选择文件后即时展示 toast 摘要：成功、跳过、失败；失败非静默。
- 客户端不自行修数、不展示脏值；错误摘要直接消费服务端结构化码。

## 7. 停车场

journal 随笔最小版、洞察证据锚点可解释性、技术债专项轮均不入本轮。
