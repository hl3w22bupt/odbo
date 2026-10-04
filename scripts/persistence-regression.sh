#!/usr/bin/env bash
# 心伴 v0.3 · P0/P1 新增数据持久性硬门槛
# 必含：写 → kill → 重启 → 读回一致 + 写失败降级断言。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${XINBAN_PERSIST_PORT:-13889}"
BASE="http://127.0.0.1:${PORT}"
PHONE="138$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
MEMORY_CONTENT='女儿下周生日，今天很开心'
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xinban-persist.XXXXXX")"
DB_PATH="${RUN_DIR}/persistence.db"
LOG_PATH="${RUN_DIR}/server.log"
PID_FILE="${RUN_DIR}/server.pid"
BODY="${RUN_DIR}/body.json"
PASS=0

green() { printf '\033[32m✅ %s\033[0m\n' "$1"; PASS=$((PASS + 1)); }
red()   { printf '\033[31m❌ %s\033[0m\n' "$1"; exit 1; }
json_get() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const value=JSON.parse(s).data;const out=process.argv[1].split(".").reduce((item,key)=>item?.[key],value);process.stdout.write(String(out ?? ""))})' "$1"
}
json_contains() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.exit(s.includes(process.argv[1])?0:1))' "$1"
}
json_eq() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const value=JSON.parse(s).data;const out=process.argv[1].split(".").reduce((item,key)=>item?.[key],value);process.exit(String(out)===process.argv[2]?0:1)})' "$1" "$2"
}
assert_contains() { if printf '%s' "$2" | grep -q "$3"; then green "$1"; else red "$1（missing=$3 body=$2）"; fi; }

cleanup() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      children="$(pgrep -P "$pid" 2>/dev/null || true)"
      kill "$pid" 2>/dev/null || true
      for child in $children; do kill "$child" 2>/dev/null || true; done
    fi
  fi
  if [ "${KEEP_PERSIST_DIR:-0}" != "1" ]; then rm -rf "$RUN_DIR"; else echo "persistence artifacts: $RUN_DIR"; fi
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

wait_ready() {
  local ready=0
  for _ in $(seq 1 60); do
    if curl -s -m 1 "$BASE/health" | grep -q '"status":"up"'; then ready=1; break; fi
    if [ -f "$PID_FILE" ] && ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then break; fi
    sleep 0.25
  done
  [ "$ready" = 1 ] || { tail -100 "$LOG_PATH"; red '❌ 持久性服务启动失败'; }
}

start_server() {
  cd "$ROOT/apps/server"
  DATABASE_URL="file:$DB_PATH" \
  HTTP_PORT="$PORT" \
  SMS_PROVIDER=dev \
  PAY_PROVIDER=mock \
  LLM_PROVIDER=mock \
  CONTENT_FILTER_ENABLED=true \
  ANTI_ADDICTION_LATE_NIGHT=false \
  CHAT_REPLY_DELAY_MIN_MS=100 \
  CHAT_REPLY_DELAY_MAX_MS=300 \
  npm run dev:standalone >>"$LOG_PATH" 2>&1 &
  server_pid=$!
  echo "$server_pid" > "$PID_FILE"
  wait_ready
}

stop_server() {
  local pid children
  [ -f "$PID_FILE" ] || return 0
  pid="$(cat "$PID_FILE")"; children="$(pgrep -P "$pid" 2>/dev/null || true)"
  kill "$pid" 2>/dev/null || true
  for child in $children; do kill "$child" 2>/dev/null || true; done
  for _ in $(seq 1 40); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
  rm -f "$PID_FILE"
}

cd "$ROOT/apps/server"
[ -d node_modules ] || npm ci --no-audit --no-fund
npx prisma generate >/dev/null
DATABASE_URL="file:$DB_PATH" npx prisma db push >/dev/null
DATABASE_URL="file:$DB_PATH" npm run prisma:seed >/dev/null
start_server

sms="$(http POST /api/v1/auth/sms-code '' "{\"phone\":\"$PHONE\",\"purpose\":\"LOGIN\"}")"
assert_contains 'P01 写前服务就绪并发码' "$sms" '"devCode":"123456"'
login="$(http POST /api/v1/auth/login '' "{\"phone\":\"$PHONE\",\"code\":\"123456\"}")"
TOKEN="$(printf '%s' "$login" | json_get accessToken)"
[ -n "$TOKEN" ] || red '❌ 登录失败'
characters="$(http GET /api/v1/characters "$TOKEN")"
CHARACTER_ID="$(printf '%s' "$characters" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data[0]?.id ?? ""))')"
[ -n "$CHARACTER_ID" ] || red '❌ 找不到角色'

sent="$(http POST /api/v1/chat/send "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"content\":\"$MEMORY_CONTENT\"}")"
CONVERSATION_ID="$(printf '%s' "$sent" | json_get conversationId)"
[ -n "$CONVERSATION_ID" ] || { tail -100 "$LOG_PATH"; red '❌ 发送失败'; }
green 'P02 写入用户消息/P0 记忆/P1 情绪快照'

memory_before="$(http GET "/api/v1/conversations/$CONVERSATION_ID/memory" "$TOKEN")"
if json_eq 'items.0.content' "$MEMORY_CONTENT" <<<"$memory_before"; then green 'P03 P0 写回读取一致'; else red '❌ P0 写后读不一致'; fi
mood_before="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-timeline" "$TOKEN")"
assert_contains 'P04 P1 情绪快照写回' "$mood_before" '"mood":"POSITIVE"'
MEMORY_ID="$(printf '%s' "$memory_before" | json_get items.0.id)"
MOOD_MEMORY_ID="$(printf '%s' "$mood_before" | json_get points.0.memoryId)"
[ -n "$MEMORY_ID" ] && [ "$MEMORY_ID" = "$MOOD_MEMORY_ID" ] || red '❌ P1 未基于 P0 记忆派生'

stop_server
green 'P05 kill 服务'
start_server
green 'P06 同一 SQLite 重启服务'

memory_after="$(http GET "/api/v1/conversations/$CONVERSATION_ID/memory" "$TOKEN")"
if json_eq 'items.0.content' "$MEMORY_CONTENT" <<<"$memory_after" && json_eq 'items.0.id' "$MEMORY_ID" <<<"$memory_after"; then
  green 'P07 重启后 P0 记忆读回一致'
else
  red "❌ 重启后 P0 记忆不一致（before=$memory_before after=$memory_after）"
fi
mood_after="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-timeline" "$TOKEN")"
if json_eq 'points.0.memoryId' "$MEMORY_ID" <<<"$mood_after" && json_contains '"mood":"POSITIVE"' <<<"$mood_after"; then
  green 'P08 重启后 P1 情绪快照读回一致'
else
  red "❌ 重启后 P1 情绪快照不一致（body=$mood_after）"
fi

# 硬门槛：写失败必须命中降级契约，读回空列表，不得携带脏数据。
(cd "$ROOT/apps/server" && npx vitest run -t 'maps a memory write failure to the degraded read contract' src/lib/conversationInsights.test.ts >/dev/null)
green 'P09 写失败降级断言（空列表，无脏数据）'

green "心伴 v0.3 持久性硬门槛通过：$PASS 项，exit=0"
