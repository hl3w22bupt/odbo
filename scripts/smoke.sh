#!/usr/bin/env bash
# 心伴 v0.3 · 一条命令全链路冒烟（01-13 v0.2 基线段 + 14-19 增量段）
# 用法：npm run smoke
# 可用环境变量：XINBAN_SMOKE_PORT（默认 13888）、KEEP_SMOKE_DIR=1（保留临时目录）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${XINBAN_SMOKE_PORT:-13888}"
BASE="http://127.0.0.1:${PORT}"
PHONE="139$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xinban-smoke.XXXXXX")"
DB_PATH="${RUN_DIR}/xinban-smoke.db"
LOG_PATH="${RUN_DIR}/server.log"
PID_FILE="${RUN_DIR}/server.pid"
BODY="${RUN_DIR}/body.json"
PASS=0

green() { printf '\033[32m✅ %s\033[0m\n' "$1"; PASS=$((PASS + 1)); }
red()   { printf '\033[31m❌ %s\033[0m\n' "$1"; exit 1; }
json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s).data;const k=process.argv[1];const out=k.split(".").reduce((a,key)=>a?.[key],v);process.stdout.write(String(out ?? ""))})' "$1"; }
assert_eq() { if [ "$2" = "$3" ]; then green "$1"; else red "$1（expected=$2 actual=$3）"; fi; }
assert_contains() { if printf '%s' "$2" | grep -qF -- "$3"; then green "$1"; else red "$1（missing=$3 body=$2）"; fi; }

cleanup() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      children="$(pgrep -P "$pid" 2>/dev/null || true)"
      kill "$pid" 2>/dev/null || true
      for child in $children; do kill "$child" 2>/dev/null || true; done
    fi
  fi
  if [ "${KEEP_SMOKE_DIR:-0}" != "1" ]; then rm -rf "$RUN_DIR"; else echo "smoke artifacts: $RUN_DIR"; fi
}
trap cleanup EXIT INT TERM

http() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local -a args=(-sS -m 20 -w '\n%{http_code}' -o "$BODY" -X "$method" "$BASE$path" -H 'content-type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-d "$data")
  curl "${args[@]}" >/dev/null
  cat "$BODY"
}

cd "$ROOT/apps/server"
[ -d node_modules ] || npm ci --no-audit --no-fund
npx prisma generate
DATABASE_URL="file:$DB_PATH" npx prisma db push
DATABASE_URL="file:$DB_PATH" npm run prisma:seed

DATABASE_URL="file:$DB_PATH" \
HTTP_PORT="$PORT" \
SMS_PROVIDER=dev \
PAY_PROVIDER=mock \
LLM_PROVIDER=mock \
CONTENT_FILTER_ENABLED=true \
ANTI_ADDICTION_LATE_NIGHT=false \
CHAT_REPLY_DELAY_MIN_MS=100 \
CHAT_REPLY_DELAY_MAX_MS=300 \
npm run dev:standalone >"$LOG_PATH" 2>&1 &
server_pid=$!
echo "$server_pid" > "$PID_FILE"

ready=0
for _ in $(seq 1 60); do
  if curl -s -m 1 "$BASE/health" | grep -q '"status":"up"'; then ready=1; break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 0.25
done
[ "$ready" = 1 ] || { tail -100 "$LOG_PATH"; red '❌ 服务启动失败'; }

health="$(curl -sS "$BASE/health")"
assert_contains '01 健康检查' "$health" '"status":"up"'

sms="$(http POST /api/v1/auth/sms-code '' "{\"phone\":\"$PHONE\",\"purpose\":\"LOGIN\"}")"
assert_contains '02 发送验证码' "$sms" '"devCode":"123456"'

login="$(http POST /api/v1/auth/login '' "{\"phone\":\"$PHONE\",\"code\":\"123456\"}")"
assert_contains '03 注册并登录' "$login" '"accessToken"'
TOKEN="$(printf '%s' "$login" | json_get accessToken)"
[ -n "$TOKEN" ] || red '❌ accessToken 为空'

unauth_status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/v1/characters")"
assert_eq '04 未登录访问被拦截' '401' "$unauth_status"

characters="$(http GET /api/v1/characters "$TOKEN")"
assert_contains '05 角色列表可读' "$characters" '"name":"林晚晴"'
CHARACTER_ID="$(printf '%s' "$characters" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data[0]?.id ?? ""))')"
[ -n "$CHARACTER_ID" ] || red '❌ 未找到可用角色'

profile="$(http GET /api/v1/users/me "$TOKEN")"
assert_contains '06 登录态资料' "$profile" "$PHONE"

conversation="$(http POST /api/v1/conversations "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"mode\":\"SINGLE\"}")"
CONVERSATION_ID="$(printf '%s' "$conversation" | json_get id)"
[ -n "$CONVERSATION_ID" ] || red '❌ 会话创建失败'
green '07 创建持久化会话'

sent="$(http POST /api/v1/chat/send "$TOKEN" "{\"conversationId\":\"$CONVERSATION_ID\",\"characterId\":\"$CHARACTER_ID\",\"content\":\"冒烟测试：今天想听你说说话\"}")"
USER_MESSAGE_ID="$(printf '%s' "$sent" | json_get userMessage.id)"
[ -n "$USER_MESSAGE_ID" ] || red '❌ 消息发送失败'
green '08 核心消息写入'

reply_completed=0
for _ in $(seq 1 40); do
  messages="$(http GET "/api/v1/conversations/$CONVERSATION_ID/messages" "$TOKEN")"
  if printf '%s' "$messages" | grep -q '"status":"COMPLETED"' && printf '%s' "$messages" | grep -q '"role":"ASSISTANT"'; then
    reply_completed=1
    break
  fi
  sleep 0.25
done
[ "$reply_completed" = 1 ] || { tail -100 "$LOG_PATH"; red '❌ AI 回复未完成'; }
green '09 AI 回复完成并落库'

# 重启同一 SQLite 文件，验证主链路数据不丢失。
pid="$(cat "$PID_FILE")"; children="$(pgrep -P "$pid" 2>/dev/null || true)"
kill "$pid" 2>/dev/null || true
for child in $children; do kill "$child" 2>/dev/null || true; done
for _ in $(seq 1 40); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done

DATABASE_URL="file:$DB_PATH" \
HTTP_PORT="$PORT" \
SMS_PROVIDER=dev \
PAY_PROVIDER=mock \
LLM_PROVIDER=mock \
CONTENT_FILTER_ENABLED=true \
ANTI_ADDICTION_LATE_NIGHT=false \
npm run dev:standalone >>"$LOG_PATH" 2>&1 &
server_pid=$!
echo "$server_pid" > "$PID_FILE"
ready=0
for _ in $(seq 1 60); do
  if curl -s -m 1 "$BASE/health" | grep -q '"status":"up"'; then ready=1; break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 0.25
done
[ "$ready" = 1 ] || { tail -100 "$LOG_PATH"; red '❌ 服务重启失败'; }

messages="$(http GET "/api/v1/conversations/$CONVERSATION_ID/messages" "$TOKEN")"
assert_contains '10 用户消息重启后保留' "$messages" '冒烟测试：今天想听你说说话'
assert_contains '11 助手消息重启后保留' "$messages" '"role":"ASSISTANT"'
assert_contains '12 消息状态一致' "$messages" '"status":"COMPLETED"'

refresh="$(http POST /api/v1/auth/refresh '' "{\"refreshToken\":\"$(printf '%s' "$login" | json_get refreshToken)\"}")"
assert_contains '13 令牌刷新' "$refresh" '"accessToken"'

# ---------- v0.3 增量段：核心交互价值闭环 ----------
memory="$(http GET "/api/v1/conversations/$CONVERSATION_ID/memory" "$TOKEN")"
assert_contains '14 会话记忆重启后可读' "$memory" '冒烟测试：今天想听你说说话'
assert_contains '15 会话记忆契约无降级' "$memory" '"degraded":false'

mood="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-timeline" "$TOKEN")"
assert_contains '16 情绪轨迹结构化快照' "$mood" '"mood":"NEUTRAL"'
assert_contains '17 情绪轨迹内容非像素契约' "$mood" '"score":0'

# 空态契约：全新会话在没有任何记忆/快照时，读接口必须显式返回空列表而非降级。
fresh_conversation="$(http POST /api/v1/conversations "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"mode\":\"SINGLE\"}")"
FRESH_CONVERSATION_ID="$(printf '%s' "$fresh_conversation" | json_get id)"
[ -n "$FRESH_CONVERSATION_ID" ] || red '❌ 空态验证会话创建失败'
fresh_memory="$(http GET "/api/v1/conversations/$FRESH_CONVERSATION_ID/memory" "$TOKEN")"
assert_contains '18 新会话记忆空态契约' "$fresh_memory" '"available":true,"degraded":false,"items":[]'
fresh_mood="$(http GET "/api/v1/conversations/$FRESH_CONVERSATION_ID/mood-timeline" "$TOKEN")"
assert_contains '19 新会话情绪轨迹空态契约' "$fresh_mood" '"available":true,"degraded":false,"points":[]'

green "心伴 v0.3 冒烟通过：$PASS 项 / 19 项"
