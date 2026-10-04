# 心伴 v0.2 审查报告（冒烟基线固化 + 持久化增量）

- 审查角色：代码审查者（独立复核，不信任上游留档，全部命令在本工作区重跑）
- 审查时间：2026-10-03（Asia/Shanghai）
- 审查范围：`62b909b..f0cd9c5`（3 个提交：01fdc57 功能、bcdcf55 平台自动、f0cd9c5 deploy 修复）
- **结论：NEEDS_WORK（修改后再合并）— 75/100；阻塞项 1，非阻塞项 2，记债 2；无数据丢失类缺陷**

---

## 1. 结论速览

| DoD | 判定 | 分值 | 依据 |
|---|---|---:|---|
| 1 冒烟基线 | pass | 1.0 | 文件存在非空、三段式齐备、死测试单列计数栏在；四命令独立重跑全部复现 |
| 2 重启持久性 | pass | 1.0 | `persistence:v02` 实测退出码 0、18/18；`kill -9`（严于需求的 `kill`）；含坏数据与写失败两条扩展路径 |
| 3 新增量覆盖 | **fail** | 0.0 | 直接反证：变异测试存活（见 §3.1）；覆盖矩阵锚点 #05 失真 |
| 4 部署复验 | pass | 1.0 | `deploy:v02` 实测退出码 0；部署后全量重跑 build=0/start=0/test=0（cwd 修复确认有效） |

评分：`(1+1+0+1)/4 = 75`。无显式 core 标记、分数 ≥ 40、无造假实锤 → 非 REJECTED；存在 fail 项 → **NEEDS_WORK**。按本轮审查门槛「测试缺失 = DoD 不通过 = 不合并」，DoD#3 修复并复验前不合并。

## 2. 独立复现证据

| 命令 | 退出码 | 实测 |
|---|---:|---|
| `npm run build` | 0 | server tsc + mobile typecheck + Expo Web 导出 |
| `npm test` | 0 | server 6 files/26 tests + mobile 2 files/21 tests = 47 过 / 0 挂 / 0 死（Vitest 输出无 skipped/todo） |
| `npm run persistence:v02` | 0 | 18/18 断言过（#12-#14 重启一致、#15 坏数据丢弃、#16-#18 缺表写失败降级） |
| `npm run deploy:v02` | 0 | deploy build → dist 启动 /health=0 → 部署后重跑 build=0 / start=0 / test=0（47 过，确认含 mobile 段） |

静态核查：

- 路由唯一注册 48 条（`src/routes` 47 define + `localServer.ts` 1 条 health），与基线文档一致。
- 死测试扫描：测试源码 `.skip/.only/.todo/.fails` 零命中；与留档「死 = 0」一致。
- git 卫生：无 tracked DB 文件；`apps/server/data/` 已 ignore；工作区干净。
- 安全面：4 条新增 emotion 路由全部经 `authenticate` + `requireOwnedConversation`（userId 归属校验），无 IDOR；emotion 白名单、score 有限数字、version 正整数、payload 对象校验完备；零新增依赖。
- 范围冻结：既有对外接口零改动（纯新增路由 + chatSend 内部钩子）；砍掉项（注册加固/交互增强/展示优化）均未实现；mobile 业务代码零改动；既有测试文件零改动。
- 停车场映射：对照 v0.1 报告 §2.2 原清单 10 项，DEVELOPMENT.md §3 逐项给出三判据归属，无遗漏；唯一满足三判据的持久化款项（会话/情绪持久化与兼容降级）确已入 IN-2。
- 规范符合度：interface 定义对象类型、无 any（unknown + 收窄）、`EMOTION_STATES as const` 联合类型代替枚举、命名规范、commit message（feat/fix + scope）均符合项目 CLAUDE.md。

## 3. 发现清单

### 3.1 🔴 阻塞：聊天主链路 → 情绪伴生写入集成点无正向断言（DoD#3 fail）

**红队变异测试（可复现）**：将 `apps/server/src/routes/chat.ts` 中

```ts
await safeUpsertEmotionFromContent(conversation.id, safeContent)
```

注释后重跑：`npm test` 47/47 过（退出码 0）；`npm run persistence:v02` 18/18 过（退出码 0）。**变异体存活 = 全部测试无一条能侦破该钩子被删。**

失效机理：脚本 #05 仅断言 chat/send HTTP 200（既有消息写入路径即可满足）；#06 的 PATCH 随后覆盖情绪行，使 #08/#14 对「#05 时钩子是否写入」不敏感；单测层 emotion.test.ts 全部 mock prisma，不经过 chatSend。

影响：未来重构误删该行时，情绪伴生数据将静默停止写入（功能缺失、非数据丢失），而全部验收仍绿灯。DELIVERY_REPORT 覆盖矩阵将「主链路降级 happy path」锚定为 #05 `主链路消息写入`，该锚点实际不断言伴生更新，属**验收锚点失真**——与上游对 deploy cwd 缺陷自定的「验收对象偷换 = 阻塞级」同一口径，按本轮门槛「测试缺失 = DoD 不通过 = 不合并」处理。

**修复要求（≈10 行）**：

1. `scripts/persistence-v02.sh` 在 #05 与 #06 之间插入（后续编号顺延或保持 #05b）：

   ```bash
   emotion_after_send="$(http GET "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
   assert_eq '05b 伴生情绪随消息写入' '200' "$emotion_after_send"
   assert_contains '05c 伴生情绪分类为 POSITIVE' "$(body)" '"emotion":"POSITIVE"'
   assert_contains '05d 伴生情绪分值为 0.8' "$(body)" '"score":0.8'
   ```

   （消息内容「我今天很开心」命中 `classifyEmotion` 的 POSITIVE/0.8 分支，upsert 应覆盖 #04 显式创建的 CALM——该断言同时锁住「聊天触发覆盖写」语义。）
2. 同步订正 `docs/smoke/v0.2-base.md` 增量段（新增断言行 + 计数）与 `docs/v02/DELIVERY_REPORT.md` 覆盖矩阵锚点（主链路降级 happy path → #05b-#05d）。
3. 重跑 `npm run persistence:v02`（预期 21/21 或 19/19，视编号方案）并回填 deploy 段计数；可附做一次反向变异复跑确认新断言能拦截（预期退出码非 0）。

### 3.2 🟡 非阻塞：基线文档增量段计数不自洽

`docs/smoke/v0.2-base.md` L35「6 个 Vitest + **12** 个脚本断言过」：脚本共 18 条断言，#01-#03 为 v0.1 既有能力（登录/建会话），新增量断言为 **15** 条（#04-#18）；按增量表列口径（#12-#18）为 7 条，按 #04-#15 口径为 12 条，但表内行明确含 #16-#18。三种口径互斥，棘轮基线的计数必须唯一可复核。随 3.1 一并订正。

### 3.3 🟡 非阻塞：文档格式小疵

`docs/v02/DEVELOPMENT.md` §4 标题后双空行、空行不齐；顺手修。

### 3.4 📋 记债（不拦合并，v0.3 议）

- **deploy 探针深度不足**：`start_dist` 默认 `file:./data/xinban-deploy-v02.db`，文件不存在时 Prisma 建空库且 `/health` 不查库照样 up——deploy 节点未覆盖「部署库迁移就绪」。v0.1 同口径，建议 v0.3 在 deploy 探针中加入最小 DB 探测。
- **热路径串行写**：chatSend 在响应前 `await` 伴生 upsert，多一次 DB 往返。当前取「写入完成才返回」的保守语义，可接受；若 v0.3 后台化，需保住降级与跨进程持久语义（现有 #17 类断言即为此设计）。

## 4. 红队对抗记录

| 攻击类 | 动作 | 结果 |
|---|---|---|
| 反证 | 变异测试：删除 chatSend 情绪钩子后全量重跑 | **变异体存活 → 升级为 3.1 阻塞项** |
| 范围 | `git diff 62b909b..HEAD` 全量核对 | 既有测试/接口零改动；无删测试、无放宽断言、无绕校验 |
| 证据抽查 | 四命令全部独立重跑 + 路由数/死测试/测试计数静态复核 | 留档与实测一致（3.2 计数措辞除外） |

说明：红队以机械化、可复现的变异测试在审查上下文内执行，结论为客观事实而非裁量；本轮结论为 NEEDS_WORK（非 CERTIFIED），不触发红队独立性封顶问题。

## 5. 复验指引（修复方）

1. 按 §3.1 打补丁（脚本 + 两份文档）。
2. `npm run persistence:v02` 退出码 0 且新断言过；反向变异一次确认拦截。
3. `npm run deploy:v02` 退出码 0，回填 deploy 段。
4. `git status` 干净后提交，通知审查方复核 DoD#3 单项（其余三项维持 pass，无需重审）。
