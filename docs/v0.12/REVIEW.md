# v0.12 代码审查说明

## 范围裁决

- P0 冻结为 v0.9 4 列 CSV 导入，不扩展 PDF、journal、通用 ETL、批量修复。
- `ImportedPeriodMetric` 仅是幂等台账，不作为聚合读源；聚合继续从 ACTIVE P0 与 MoodSnapshot 派生。
- v0.9 聚合值必须可无损还原：`mood sum === count` 且 `averageScore === (positive-negative)/count`。该约束来自导出值到 P0/P1 样本的反向映射事实，不是新增展示口径。

## 评审三查

1. **契约复用**：parser 表头直接 import `CSV_HEADER`；dimension 直接 import v0.9 `COMPARISON_DIMENSIONS`；无平行字面量。
2. **失败收敛**：UTF-8、表头、超限为文件级 4xx/413；行级错误 200 + 明细封顶 20；唯一键冲突不会静默覆盖；事务 hook 覆盖中途失败回滚。
3. **消费真实性**：roundtrip 测试证明既有 v0.9 导出消费导入 P0/P1；brand-new period 测试证明既有 report 和 insight 值级消费。

## 冻结边界

- `git diff` 冻结文件集：export route、period route、chat route、periodCsv writer、v0.10/11 insight lib、mobile components 均为 0 bytes。
- Schema additive diff：16 insertions / 0 deletions。
- 死测试扫描 0。

## 留证

见 `QA-ACCEPTANCE.md`、`evidence/`。所有判定以仓库内命令日志为准，不采信会话描述。
