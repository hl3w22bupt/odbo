---
name: lark
description: "Lark/飞书消息技能：通过零依赖薄 CLI（scripts/lark.mjs）发送群通知/文本消息/交互卡片、解析群 chat_id。当需要给飞书群发通知、汇报进度/结果到 Lark、发送卡片消息、或查找机器人所在群 ID 时使用。"
---

# Lark 消息技能（lark）

> 目标：让 agent 用一条命令把消息发进飞书群或发给指定人，无需平台写任何集成代码。
> CLI 是零依赖 Node 脚本，两条认证通道自动选择：机器人 webhook（最轻）与自建应用 Open API。

## 0. 何时用本技能

**触发**：需要给 Lark/飞书群或成员发消息（进度通知、结果汇报、告警、卡片）；需要查机器人所在群的 chat_id。

**不适用**：读/写飞书文档、审批、日历、多维表格 —— 本 v1 只覆盖消息通道；这些需求先上报，不要现场造轮子。

## 1. CLI 位置与调用方式

脚本随本技能目录注入。按以下顺序找到它，找到即用 `node` 执行：

1. 当前工作区：`.myrd-platform/.claude/skills/lark/scripts/lark.mjs`
2. repo 内：`std-skills/lark/scripts/lark.mjs`

```bash
node .myrd-platform/.claude/skills/lark/scripts/lark.mjs <命令> [参数]
```

## 2. 认证通道（自动选择，无需指定）

| 通道 | 需要的环境变量 | 触发条件 | 适合 |
|---|---|---|---|
| 机器人 webhook | `LARK_WEBHOOK_URL`（可选 `LARK_WEBHOOK_SECRET`） | `send` 不带 `--to` | 往固定群发通知，零应用配置 |
| Open API 自建应用 | `LARK_APP_ID` + `LARK_APP_SECRET` | `send` 带 `--to` 或 `chats` | 发给指定会话/成员、列群 |

环境变量由平台注入 agent 进程（worker `.env` 配置）。都没配时命令会报错——此时向用户说明缺少配置，不要猜测凭据。

## 3. 命令速查

```bash
LARK=node .myrd-platform/.claude/skills/lark/scripts/lark.mjs   # 下文用 $LARK 指代

# 发文本到 webhook 绑定的群
$LARK send "Goal G-42 checkpoint 1/3 完成：需求已拆解"

# 发交互卡片（内联 JSON；或 --card @card.json / --card - 读 stdin）
$LARK send --card '{"config":{"wide_screen_mode":true},"elements":[{"tag":"div","text":{"tag":"lark_md","content":"**构建通过** ✅"}}]}'

# 发给指定群（Open API；--to-type 可选 open_id/user_id/email，默认 chat_id）
$LARK send --to oc_xxx "部署完成" --to-type chat_id

# 查机器人所在群，解析 chat_id（可 --query 按群名过滤）
$LARK chats --query 前端

# 要原始响应加 --json
$LARK send "hi" --json
```

响应解读：成功一行 `已发送`；失败一行 `lark: <原因> (code=xxxx)`，退出码非 0。

## 4. 排错

| 现象 | 原因与处置 |
|---|---|
| `缺少 LARK_APP_ID / LARK_APP_SECRET` | 用了 `--to` 但没配应用凭据；改走 webhook（去掉 `--to`）或补配置 |
| `未配置 LARK_WEBHOOK_URL` | 两条通道都没配，上报用户 |
| `webhook 发送失败 (code=19021)` | 签名校验失败：群机器人开启了签名但 `LARK_WEBHOOK_SECRET` 未配/不对 |
| `发送失败 (code=99991663/99991661)` | tenant token 无效：`LARK_APP_ID/SECRET` 错误 |
| `发送失败 (code=230001)` | `--to` 的 ID 不存在或类型不匹配，先 `$LARK chats` 核对 chat_id |
| 网络请求失败 | 沙箱出网受限或域名不通；国际版租户需 `LARK_API_BASE=https://open.larksuite.com` |

## 5. 安全与纪律

- 消息内容不得包含密钥、token、用户隐私；发错误堆栈前先截断到关键行。
- 群通知是**对外可见**动作：内容发送前确认符合任务目标，不要在自主循环里高频刷屏（同类通知合并为一条）。
- 卡片 JSON 直接拼字符串容易引号转义出错，复杂卡片写入临时文件后 `--card @文件` 发送。
