# 心伴 v0.5 评审记录

## 范围控制

- 冻结实现：P0-1 修正、P0-2 同交互标注 + 最小 UI、P1-1 JSON 导出。
- 已砍：CSV、独立标注项、批量修正、外部通知/定时器、新存储引擎。
- 未接受执行轮内口头加需求。

## 架构复核

- `MoodSnapshot` 原始事实不改写，`MoodCorrection` 只追加。
- 派生层 `conversationInsights.ts` 只消费路由传入 rows/corrections；`moodInsight.ts` 仍不访问 Prisma。
- 路由层负责鉴权、白名单、幂等、404 与写失败降级。
- 导出路由与修正路由互不调用；共用存储层与冻结序列化库。
- 图谱终版：1,721 nodes、142 communities；global tag=`xinban-v05`；证据 `graphify-final-*.log`。

## 红队复核

1. **跨用户越权**：修正先校验 conversation owner，再校验 `point.userId` 与 `conversationId`；导出全部查询带 `userId`。
2. **空库/降级误判**：空导出 200；timeline 降级返回显式空 points；不存在修正 404。
3. **静默覆盖**：原始 snapshot 无 UPDATE/DELETE 路径；readable timeline 记录 originalMood/originalScore/correctionId。
4. **幂等碰撞**：同 clientMutationId 同目标重放返回首次结果；跨目标返回 409。
5. **坏数据扩散**：导出 metadata/payload 解析失败置空对象；mood/score 归一化；不导出认证表。

## 结论

范围冻结、契约四件套、红绿证据、三元组、兼容链和死测试清账均满足；可进入工作流 deploy。
