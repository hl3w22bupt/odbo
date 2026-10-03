#!/usr/bin/env bash
# 心伴 v0.2 · 会话/情绪持久化增量验收
# 判定：写入 -> kill -9 -> 重启 -> 读回一致；且情绪写失败时消息主链路继续可用。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${XINBAN_PERSISTENCE_PORT:-14888}"
BASE="http://127.0.0.1:${PORT}"
PHONE="137$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xinban-persistence-v02.XXXXXX")"
DB_PATH="$RUN_DIR/xinban-persistence.db"
SERVER_LOG="$RUN_DIR/server.log"
PID_FILE="$RUN_DIR/server.pid"
BODY_FILE="$RUN_DIR/body.json"
PASS=0
SERVER_PID=''

green() { printf '\033[32m✅ %s\033[0m\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf '\033[31m❌ %s\033[0m\n' "$1" >&2; exit 1; }
assert_eq() { if [ "$2" = "$3" ]; then green "$1"; else fail "$1（expected=$2 actual=$3）"; fi; }
assert_contains() { if printf '%s' "$2" | grep -q "$3"; then green "$1"; else fail "$1（missing=$3 body=$2）"; fi; }

descendants() {
  local pid child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do
    descendants "$child"
    echo "$child"
  done
}

kill_test_server() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    local pids="$SERVER_PID $(descendants "$SERVER_PID")"
    for pid in $pids; do kill -9 "$pid" 2>/dev/null || true; done
  fi
  local port_pids
  port_pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$port_pids" ]; then
    for pid in $port_pids; do kill -9 "$pid" 2>/dev/null || true; done
  fi
  SERVER_PID=''
}

cleanup() {
  kill_test_server
  if [ "${KEEP_PERSISTENCE_DIR:-0}" != "1" ]; then rm -rf "$RUN_DIR"; else echo "artifacts: $RUN_DIR"; fi
}
trap cleanup EXIT INT TERM

json_get() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const root=JSON.parse(s);const value=process.argv[1].split(".").reduce((a,k)=>a?.[k],root.data);process.stdout.write(String(value ?? ""))})' "$1"
}

http() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}" status
  local -a args=(-sS -m 20 -w '\n%{http_code}' -o "$BODY_FILE" -X "$method" "$BASE$path" -H 'content-type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-d "$data")
  status="$(curl "${args[@]}" | tail -1)"
  printf '%s' "$status"
}

body() { cat "$BODY_FILE"; }

hard_kill() {
  kill_test_server
  wait "$SERVER_PID" 2>/dev/null || true
  for _ in $(seq 1 40); do
    if ! curl -s -m 1 "$BASE/health" >/dev/null 2>&1; then return 0; fi
    sleep 0.1
  done
  fail 'kill -9 后端口未释放'
}

start_server() {
  cd "$ROOT/apps/server"
  DATABASE_URL="file:$DB_PATH" HTTP_PORT="$PORT" SMS_PROVIDER=dev PAY_PROVIDER=mock LLM_PROVIDER=mock \
    ANTI_ADDICTION_LATE_NIGHT=false CHAT_REPLY_DELAY_MIN_MS=50 CHAT_REPLY_DELAY_MAX_MS=100 \
    npm run dev:standalone >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" >"$PID_FILE"
  local ready=0
  for _ in $(seq 1 60); do
    if curl -s -m 1 "$BASE/health" | grep -q '"status":"up"'; then ready=1; break; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
    sleep 0.25
  done
  [ "$ready" = 1 ] || { tail -100 "$SERVER_LOG" >&2; fail '持久化验收服务启动失败'; }
}

[ -d "$ROOT/apps/server/node_modules" ] || { echo 'missing node_modules; run npm run setup' >&2; exit 1; }
cd "$ROOT/apps/server"
npx prisma generate >/dev/null
DATABASE_URL="file:$DB_PATH" npx prisma db push >/dev/null
DATABASE_URL="file:$DB_PATH" npm run prisma:seed >/dev/null
start_server

sms_status="$(http POST /api/v1/auth/sms-code '' "{\"phone\":\"$PHONE\",\"purpose\":\"LOGIN\"}")"
assert_eq '01 发送开发验证码' '200' "$sms_status"
login_status="$(http POST /api/v1/auth/login '' "{\"phone\":\"$PHONE\",\"code\":\"123456\"}")"
assert_eq '02 注册登录' '200' "$login_status"
TOKEN="$(body | json_get accessToken)"
[ -n "$TOKEN" ] || fail 'accessToken 为空'

characters="$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/characters")"
CHARACTER_ID="$(printf '%s' "$characters" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data[0]?.id ?? ""))')"
[ -n "$CHARACTER_ID" ] || fail '未找到角色'
conversation_status="$(http POST /api/v1/conversations "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"mode\":\"SINGLE\",\"title\":\"persistence-v02\"}")"
assert_eq '03 创建会话' '201' "$conversation_status"
CONVERSATION_ID="$(body | json_get id)"
[ -n "$CONVERSATION_ID" ] || fail '会话 id 为空'

create_status="$(http POST "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN" '{"emotion":"CALM","score":0.3,"version":2,"payload":{"source":"script","marker":"before-restart"}}')"
assert_eq '04 情绪 create' '201' "$create_status"
send_status="$(http POST /api/v1/chat/send "$TOKEN" "{\"conversationId\":\"$CONVERSATION_ID\",\"characterId\":\"$CHARACTER_ID\",\"content\":\"重启前会话消息：我今天很开心\"}")"
assert_eq '05 主链路消息写入' '200' "$send_status"
patch_status="$(http PATCH "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN" '{"emotion":"ANXIOUS","score":-0.5,"version":7,"payload":{"source":"script","marker":"expected-after-restart"}}')"
assert_eq '06 情绪 update' '200' "$patch_status"
get_status="$(http GET "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
assert_eq '07 情绪 read' '200' "$get_status"
assert_contains '08 更新值已写入' "$(body)" '"marker":"expected-after-restart"'
delete_status="$(http DELETE "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
assert_eq '09 情绪 delete' '200' "$delete_status"
after_delete="$(http GET "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
assert_contains '10 删除后读回默认' "$(body)" '"emotion":"NEUTRAL"'
create_status="$(http POST "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN" '{"emotion":"ANXIOUS","score":-0.5,"version":7,"payload":{"source":"script","marker":"expected-after-restart"}}')"
assert_eq '11 重建重启前值' '201' "$create_status"

hard_kill
start_server
messages="$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/conversations/$CONVERSATION_ID/messages")"
assert_contains '12 kill 后会话消息读回一致' "$messages" '重启前会话消息：我今天很开心'
emotion="$(http GET "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
assert_eq '13 kill 后情绪读回' '200' "$emotion"
assert_contains '14 kill 后情绪内容一致' "$(body)" '"marker":"expected-after-restart"'

# 旧/坏数据兼容路径：明确按“丢弃”处理，读回默认，不阻塞会话。
hard_kill
cd "$ROOT/apps/server"
XINBAN_CONVERSATION_ID="$CONVERSATION_ID" node - "$DB_PATH" <<'NODE'
const Database = require('better-sqlite3')
const db = new Database(process.argv[2])
db.prepare("UPDATE ConversationEmotion SET emotion = 'BOGUS', score = 999, payload = '{broken' WHERE conversationId = ?").run(process.env.XINBAN_CONVERSATION_ID)
db.close()
NODE
start_server
corrupt_read="$(http GET "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
assert_contains '15 坏情绪数据丢弃回退默认' "$(body)" '"emotion":"NEUTRAL"'

# 真实写失败：删除伴生态表；消息表不受影响，HTTP 主链路必须 200。
hard_kill
cd "$ROOT/apps/server"
node - "$DB_PATH" <<'NODE'
const Database = require('better-sqlite3')
const db = new Database(process.argv[2])
db.exec('DROP TABLE ConversationEmotion')
db.close()
NODE
start_server
failure_send="$(http POST /api/v1/chat/send "$TOKEN" "{\"conversationId\":\"$CONVERSATION_ID\",\"characterId\":\"$CHARACTER_ID\",\"content\":\"写失败降级消息：情绪表不存在\"}")"
assert_eq '16 情绪写失败时主链路仍成功' '200' "$failure_send"
hard_kill
cd "$ROOT/apps/server"
DATABASE_URL="file:$DB_PATH" npx prisma db push >/dev/null
start_server
messages="$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/conversations/$CONVERSATION_ID/messages")"
assert_contains '17 降级消息跨进程仍在' "$messages" '写失败降级消息：情绪表不存在'
emotion="$(http GET "/api/v1/conversations/$CONVERSATION_ID/emotion" "$TOKEN")"
assert_contains '18 失败伴生态保持默认且不丢主链路' "$(body)" '"emotion":"NEUTRAL"'

printf '\n心伴 v0.2 持久化增量通过：%s 项 / 18 项\n' "$PASS"
