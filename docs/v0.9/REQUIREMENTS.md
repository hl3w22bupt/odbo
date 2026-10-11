# 心伴 v0.9 P0 · 周期报告多周期对比 + CSV 导出

状态：FROZEN-SIGNED（2026-10-12 产品/架构/实现/QA 联合裁决；执行期不接受扩需求）。

## 1. 范围

1. 新增会话维度「最近自然周期对比」读端点。
2. 新增同一报告的 CSV 导出端点。
3. 仅新增测试基建点：多周期报告故障注入钩子；不新增通用测试框架。
4. 不做客户端 UI；不做 PDF；不动轨迹增强 P1。

## 2. 对比端点契约

- 路由：`GET /api/v1/conversations/:id/mood-period-comparison`。
- 鉴权与归属：Bearer 鉴权；非本人/不存在沿用 404 `NOT_FOUND`；未登录 401。
- 请求：`periods` 为正整数，缺省 `3`；允许 1、2、3；`>3` 或非法值返回 400、错误码 `PERIOD_COUNT_REJECTED`，detail 携带 `maxPeriods=3`。N=3 为上限冻结值。
- 时间口径：对齐粒度 `NATURAL_WEEK`；周一为起点（ISO 8601）；固定 UTC+8；窗口左闭右开；周期 id 为东八区周一 `YYYY-MM-DD`。
- 返回按周期 id 升序，包含请求的最近 N 个自然周；请求 3 而源数据只覆盖 1/2 周时，缺失周期用合法空周期补齐，不缩数组。
- 启用维度固定 5 个且顺序冻结：`count`、`positive`、`neutral`、`negative`、`averageScore`。前三者与负/中性/正计数一致；`averageScore` 为有效 score 算术均值。周期无有效点时五个值均为 `null`。
- 每周期披露 `empty`、`aggregateValues`、`completeness.expectedPoints/actualPoints/ratio/status`。
- 完整度：`expectedPoints=1×5=5`；`actualPoints` 为非空维度值数；`ratio=actual/expected`；`ratio=1` 为 `COMPLETE`，`(0,1)` 为 `PARTIAL`，`0` 为 `EMPTY`。整体完整度按 `N×5` 与全部非空值数计算。
- 趋势：相邻周期逐维度计算 `rate=(后-前)/前`；`rate>=0.05` 为 `UP`，`rate<=-0.05` 为 `DOWN`，其余为 `STABLE`。任一周期整体空、该维度空、或分母为 0 导致不可复算时，该对 `direction=null / rate=null / empty=true`，不参与整体趋势。
- 整体趋势逐维度基于首个与最后一个可复算端点；任一端点空或不可复算则 `null`。趋势枚举仅 `UP/STABLE/DOWN/null`。
- 失败：全部读失败/聚合失败返回 200 信封，`available=false / degraded=true / periods=[]`，并记录非静默日志；部分周期源失败返回 200，`available=true / degraded=true`，可用周期照常输出，失败周期 id 进入 `failedPeriodIds` 并补空周期。

## 3. CSV 导出端点契约

- 路由：`GET /api/v1/conversations/:id/mood-period-comparison/export.csv`；`periods` 参数与对比端点一致。
- 编码与类型：仅 UTF-8 CSV；成功响应 `Content-Type=text/csv; charset=utf-8`，带 BOM 便于表格识别。
- 固定列：`period_id,date,dimension,value`；每行是一个周期的一个维度值；空值不落数据行。
- 元信息以 HTTP 头机判：`X-Report-Row-Count` 只统计数据行、不含表头；`X-Report-Generated-At` 为 ISO-8601；`X-Report-Empty`、`X-Report-Available`、`X-Report-Degraded`、`X-Report-Partial` 均为小写布尔。
- 空源数据：不产文件，返回 204，且 `X-Report-Empty=true / X-Report-Available=true / X-Report-Degraded=false`。
- 全量失败：重试 1 次后仍失败不产文件，返回 200 JSON 信封；`code=OK`、`data.available=false / data.degraded=true / data.attempts=2`，并置 `X-Report-Available=false / X-Report-Degraded=true / X-Report-Partial=false`。
- 部分失败：可用周期照常生成 CSV；`X-Report-Partial=true / X-Report-Degraded=true / X-Report-Available=true`；行数只含成功源产物。
- 超大数据：源有效样本超 1000 返回 413、错误码 `CSV_EXPORT_TOO_LARGE`，message 明确 `limit=1000`。
- CSV 写入必须按 RFC 4180 转义逗号、双引号、换行；导出产物必须可被标准 CSV 解析。

## 4. 冻结边界

- 不新增/修改 Prisma schema、不改既有 API 契约、不新增写端点、不新增独立持久化。
- 只消费成功落库的 ACTIVE 记忆与 MoodSnapshot 派生；修正沿用 latest-wins；脏点静默剔除。
- v0.8 单周期报告路由、v0.7 周报路由和响应结构不改。

## 5. 停车场

- 轨迹增强 P1：驻留；闸门=交互断言基建补齐 + 不触 v0.7 冻结口径。
- PDF 导出：驻留。
- 捞回候选：按「闸门可机判、不触冻结口径、有独立验收路径、不阻塞本轮 P0」复核；当前均不入主线。
