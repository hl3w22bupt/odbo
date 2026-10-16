# v0.13 代码审查说明

## 范围裁决

- P0 只做两入口导入/导出触达与 v0.12 未知周期开放点；不扩通用 ETL、Excel/PDF、进度条或新会话选择页。
- 导出必须是可反向导入的 v0.9 conversation CSV；`/periods/:id/report.csv` 仅同步获得 additive RFC5987 头，不改变 14 列导出契约。
- `period_ids` 是跨周期洞察 additive 显式序列参数，仅用于表达混合/纯未知用例；未传时已知目标既有派生序列零漂移。

## 代码审查结论（按平台标准六项）

```json
{
  "verdict": "pass",
  "summary": "v0.13 两入口与未知周期容错按冻结契约落地，既有数据契约零破坏且门禁证据齐全。",
  "blockingIssues": [],
  "suggestions": [
    { "description": "后续可把 server/mobile 的 RFC5987 与周期纯函数下沉 monorepo shared lib，消除双端字面量重复。" }
  ],
  "securityChecklist": {
    "authorization": true,
    "authentication": true,
    "sqlParameterized": true,
    "noSecretLeak": true,
    "inputValidation": true,
    "resourceOwnership": true
  },
  "changeSummary": "新增可复用周期数据卡片并挂载 Home/Chat 两个既有页面；导出直连 v0.9 CSV 并以 Blob/RFC5987 下载；导入明细封顶转义渲染；未知周期在洞察与导入反馈中以 additive 提示位 200 容错。",
  "foundButNotTouched": [
    "仓库级 lint 会扫描 apps/mobile/dist-web 产物，建议后续为 Expo 产物补 ignore。"
  ],
  "rejectTo": "code-change"
}
```

## 边界复核

- Prisma schema diff：0（`evidence/node4-boundary-audit.txt`）。
- 路由表 diff：0；Screen 文件集合无新增。
- 卡片挂载数：2（Home + Chat）。
- 既有导入结果七字段：逐项精确回归通过。
- 死测试：0。
