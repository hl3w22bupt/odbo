#!/usr/bin/env node
/**
 * lark —— Lark/飞书 薄命令行（std-skills/lark，零依赖，Node 18+）。
 *
 * 两条认证通道，按调用自动选择：
 *   1. 自定义机器人 webhook：仅需 LARK_WEBHOOK_URL（可选 LARK_WEBHOOK_SECRET 签名），
 *      不带 --to 的 send 走此通道 —— 群通知的最轻路径。
 *   2. Open API（自建应用）：LARK_APP_ID + LARK_APP_SECRET，每次调用现取
 *      tenant_access_token（不落盘缓存，令牌有效期 2h，通知频度下无缓存必要）。
 *
 * 刻意不缓存令牌、不引入任何依赖：本 CLI 的定位是「低频通知 + 少量查询」，
 * 不是通用 SDK；重操作请走 Lark 官方 Open API 文档。
 */

const API_BASE = (process.env.LARK_API_BASE || "https://open.feishu.cn").replace(/\/+$/, "")

const USAGE = `用法: node lark.mjs <命令> [参数]

命令:
  send   发消息。不带 --to 走机器人 webhook（需 LARK_WEBHOOK_URL），
         带 --to 走 Open API 发到指定会话/用户（需 LARK_APP_ID/SECRET）。
           --text "消息"          纯文本（或直接用位置参数）
           --card '<json|@文件|-> ' 交互卡片（@读文件，- 读 stdin）
           --to <id>              接收者 ID（chat_id / open_id / user_id / email）
           --to-type <type>       ID 类型，默认 chat_id
           --json                 原样输出响应 JSON
  chats  列出机器人所在群（Open API），用于解析 chat_id
           --query 关键词          按群名过滤
           --json                 原样输出响应 JSON

环境变量:
  LARK_WEBHOOK_URL    自定义机器人 webhook 地址（send 不带 --to 时必需）
  LARK_WEBHOOK_SECRET 机器人开启签名校验时填写
  LARK_APP_ID         自建应用 App ID（send 带 --to / chats 时必需）
  LARK_APP_SECRET     自建应用 App Secret
  LARK_API_BASE       API 域名覆盖，国际版填 https://open.larksuite.com

退出码: 0 成功 / 1 调用失败 / 2 用法错误`

function die(msg, code = 2) {
  console.error(`lark: ${msg}`)
  process.exit(code)
}

/** 解析 --card 值：'-' 读 stdin，'@路径' 读文件，其余按内联 JSON */
async function resolveCard(raw) {
  let body = raw
  if (raw === "-") body = await readStdin()
  else if (raw.startsWith("@")) body = (await fsRead(raw.slice(1))).toString("utf8")
  try {
    return JSON.parse(body)
  } catch (e) {
    die(`卡片不是合法 JSON: ${e.message}`)
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (c) => (buf += c))
    process.stdin.on("end", () => resolve(buf))
    process.stdin.on("error", reject)
  })
}

async function fsRead(p) {
  const { readFile } = await import("node:fs/promises")
  try {
    return await readFile(p)
  } catch (e) {
    die(`读取文件失败 ${p}: ${e.message}`)
  }
}

/** 解析参数数组为 {flags, positional}，--flag value 与 --flag=value 两种写法都收 */
function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const eq = a.indexOf("=")
      if (eq > -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith("--")) {
          flags[a.slice(2)] = next
          i++
        } else flags[a.slice(2)] = true
      }
    } else positional.push(a)
  }
  return { flags, positional }
}

async function postJson(url, body, headers = {}) {
  let res
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  } catch (e) {
    die(`网络请求失败 ${url}: ${e.message}`, 1)
  }
  return res
}

/** tenant_access_token 现取现用（不落盘）：失败即 die */
async function tenantToken() {
  const appId = process.env.LARK_APP_ID
  const appSecret = process.env.LARK_APP_SECRET
  if (!appId || !appSecret) die("缺少 LARK_APP_ID / LARK_APP_SECRET（或改用不带 --to 的 webhook 通道）", 1)
  const body = await (await postJson(`${API_BASE}/open-apis/auth/v3/tenant_access_token/internal`, { app_id: appId, app_secret: appSecret })).json()
  if (body.code !== 0 || !body.tenant_access_token) {
    die(`获取 tenant_access_token 失败 (code=${body.code}): ${body.msg}`, 1)
  }
  return body.tenant_access_token
}

/** 机器人 webhook 签名：key = "timestamp\nsecret"，消息体为空，输出 base64 */
async function webhookSign(secret) {
  const { createHmac } = await import("node:crypto")
  const timestamp = Math.floor(Date.now() / 1000).toString()
  return { timestamp, sign: createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64") }
}

async function sendViaWebhook(msgType, content) {
  const url = process.env.LARK_WEBHOOK_URL
  if (!url) die("未配置 LARK_WEBHOOK_URL：webhook 通道需要它，或用 --to 走 Open API", 1)
  const body = { msg_type: msgType, content }
  if (process.env.LARK_WEBHOOK_SECRET) Object.assign(body, await webhookSign(process.env.LARK_WEBHOOK_SECRET))
  const res = await postJson(url, body)
  const out = await res.json()
  if (out.code !== 0 && out.StatusCode !== 0) die(`webhook 发送失败 (code=${out.code ?? out.StatusCode}): ${out.msg}`, 1)
  return out
}

async function sendViaApi(flags, msgType, content) {
  const toType = flags["to-type"] || "chat_id"
  if (!flags.to) die("缺少 --to（或去掉 --to 改走 webhook 通道）")
  const token = await tenantToken()
  const res = await postJson(`${API_BASE}/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(toType)}`, { receive_id: flags.to, msg_type: msgType, content: JSON.stringify(content) }, { authorization: `Bearer ${token}` })
  const out = await res.json()
  if (out.code !== 0) die(`发送失败 (code=${out.code}): ${out.msg}`, 1)
  return out
}

async function listChats(flags) {
  const token = await tenantToken()
  const url = new URL(`${API_BASE}/open-apis/im/v1/chats`)
  url.searchParams.set("page_size", "50")
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  const out = await res.json()
  if (out.code !== 0) die(`列群失败 (code=${out.code}): ${out.msg}`, 1)
  const items = out.data?.items ?? []
  const kw = flags.query
  const filtered = kw ? items.filter((c) => (c.name || "").includes(kw)) : items
  if (!flags.json) {
    if (!filtered.length) return console.log(kw ? `没有名称包含「${kw}」的群` : "机器人尚未加入任何群")
    for (const c of filtered) console.log(`${c.chat_id}\t${c.name ?? "(未命名)"}\t${c.description ?? ""}`)
    return
  }
  console.log(JSON.stringify(filtered.length === items.length ? out : { ...out, data: { ...out.data, items: filtered } }, null, 2))
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") return console.log(USAGE)

  if (cmd === "send") {
    const { flags, positional } = parseArgs(rest)
    const text = flags.text ?? positional.join(" ")
    if (!text && !flags.card) die("需要 --text \"消息\" 或 --card '<json>'（详见 --help）")
    // 卡片优先：给了 --card 就按 interactive 发，文本参数忽略
    const viaWebhook = !flags.to
    if (flags.card) {
      const card = await resolveCard(String(flags.card))
      const out = viaWebhook
        ? await sendViaWebhook("interactive", { card })
        : await sendViaApi(flags, "interactive", card) // Open API 的 content 即卡片 JSON 本体
      return console.log(flags.json ? JSON.stringify(out, null, 2) : "已发送（卡片）")
    }
    const content = { text }
    const out = viaWebhook ? await sendViaWebhook("text", content) : await sendViaApi(flags, "text", content)
    return console.log(flags.json ? JSON.stringify(out, null, 2) : "已发送")
  }

  if (cmd === "chats") return listChats(parseArgs(rest).flags)

  die(`未知命令 "${cmd}"\n\n${USAGE}`)
}

main().catch((e) => die(e?.message ?? String(e), 1))
