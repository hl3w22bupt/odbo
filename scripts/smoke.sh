#!/usr/bin/env bash
# 心伴 v0.12 · 一条命令全链路冒烟（01-54 冻结基线 + 55-58 CSV 导入闭环）
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
assert_contains_quiet() { if printf '%s' "$2" | grep -qF -- "$3"; then return 0; else red "断言失败（missing=$3 body=$2）"; fi; }

kill_tree() {
  local pid="$1"
  [ -n "$pid" ] || return 0
  local batch="$pid" next
  while [ -n "$batch" ]; do
    next=''
    for pid in $batch; do
      for child in $(pgrep -P "$pid" 2>/dev/null || true); do next="$next $child"; done
      kill -9 "$pid" 2>/dev/null || true
    done
    batch="$next"
  done
}

cleanup() {
  if [ -f "$PID_FILE" ]; then
    kill_tree "$(cat "$PID_FILE" 2>/dev/null || true)"
  fi
  if [ "${KEEP_SMOKE_DIR:-0}" != "1" ]; then rm -rf "$RUN_DIR"; else echo "smoke artifacts: $RUN_DIR"; fi
}
trap cleanup EXIT INT TERM

http_csv() {
  local path="$1" token="$2" file="$3"
  curl -sS -m 20 -w '\n%{http_code}' -o "$BODY" -X POST "$BASE$path" \
    -H 'content-type: text/csv' -H "Authorization: Bearer $token" --data-binary @"$file" >/dev/null
  cat "$BODY"
}

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

# ---------- v0.4 增量段：既有记忆 + 轨迹之上的读侧洞察 ----------
insight="$(http GET "/api/v1/conversations/$CONVERSATION_ID/insight-summary" "$TOKEN")"
assert_contains '20 情绪洞察就绪摘要' "$insight" '"headline":"整体情绪比较平稳"'
assert_contains '21 情绪洞察样本与观察口径' "$insight" '"sampleSize":1'

fresh_insight="$(http GET "/api/v1/conversations/$FRESH_CONVERSATION_ID/insight-summary" "$TOKEN")"
assert_contains '22 新会话情绪洞察空态契约' "$fresh_insight" '"available":true,"degraded":false,"summary":null'

# ---------- v0.5 增量段：编辑/标注写侧闭环 + JSON 导出 ----------
timeline_for_edit="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-timeline" "$TOKEN")"
MOOD_ID="$(printf '%s' "$timeline_for_edit" | json_get points.0.id)"
[ -n "$MOOD_ID" ] || red '❌ 未找到可修正情绪点'

correction="$(http POST "/api/v1/conversations/$CONVERSATION_ID/mood-points/$MOOD_ID/correction" "$TOKEN" '{"mood":"NEUTRAL","tags":["状态变化"],"reason":"当时记错了，其实是平静","clientMutationId":"v05-smoke-correction-1"}')"
assert_contains '23 情绪修正追加成功' "$correction" '"persisted":true'
assert_contains_quiet '23 情绪修正读回新值' "$correction" '"mood":"NEUTRAL"'
assert_contains_quiet '23 情绪修正标注同交互' "$correction" '"reason":"当时记错了，其实是平静"'

# 复用 v0.2 重启机制：kill 后同一 SQLite 文件重启。
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
[ "$ready" = 1 ] || { tail -100 "$LOG_PATH"; red '❌ 修正后服务重启失败'; }
green '24 修正记录跨重启保留（服务重启成功）'

second_correction="$(http POST "/api/v1/conversations/$CONVERSATION_ID/mood-points/$MOOD_ID/correction" "$TOKEN" '{"mood":"NEGATIVE","tags":["状态变化","原因补充"],"reason":"第二天更低落","clientMutationId":"v05-smoke-correction-2"}')"
TIMELINE_AFTER=""
timeline_json="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-timeline" "$TOKEN")"
TIMELINE_AFTER="$timeline_json"
if printf '%s' "$TIMELINE_AFTER" | jq -e --arg id "$MOOD_ID" '.data.points[] | select(.id == $id) | .mood == "NEGATIVE" and .score == -1 and .originalMood == "NEUTRAL" and .originalScore == 0' >/dev/null; then
  green '25 读侧 latest-wins 解析与原始值保留'
else
  red "❌ latest-wins 解析失败（body=${TIMELINE_AFTER}）"
fi
assert_contains_quiet '25 修正标注展示契约' "$TIMELINE_AFTER" '"tags":["状态变化","原因补充"]'
assert_contains_quiet '25 修正原因展示契约' "$TIMELINE_AFTER" '"reason":"第二天更低落"'

missing_status="$(curl -sS -m 20 -o "$BODY" -w '%{http_code}' -X POST "$BASE/api/v1/conversations/$CONVERSATION_ID/mood-points/mood_missing/correction" -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"mood":"NEUTRAL"}')"
assert_eq '26 不存在修正明确 404' '404' "$missing_status"
assert_contains_quiet '26 不存在修正错误码' "$(cat "$BODY")" '"code":"NOT_FOUND"'
if printf '%s' "$(cat "$BODY")" | grep -q '"code":"INTERNAL_ERROR"'; then red '❌ 不存在修正禁止 500'; fi

# 27 UI 最小入口是构建内可 grep 的列表项回调；保存后的即时 state 更新由 mobile 具名测试锁定。
grep -q 'onCorrect={openCorrection}' "$ROOT/apps/mobile/src/screens/ChatScreen.tsx"
grep -q 'accessibilityLabel={`修正情绪记录' "$ROOT/apps/mobile/src/components/MoodTimelinePanel.tsx"
(cd "$ROOT/apps/mobile" && npx vitest run -t 'applies a correction result immediately or preserves the old point' src/utils/moodCorrections.test.ts >/dev/null)
green '27 列表修正入口与即时更新契约'

(cd "$ROOT/apps/server" && npx vitest run -t 'test_correction_write_failure_preserves_old_value' src/routes/chat.routes.test.ts >/dev/null)
green '28 写失败降级并保留旧值'

EXPORT_HEADERS="$RUN_DIR/export-headers.txt"
EXPORT_BODY="$RUN_DIR/export-body.json"
export_status="$(curl -sS -m 20 -D "$EXPORT_HEADERS" -o "$EXPORT_BODY" -w '%{http_code}' "$BASE/api/v1/export" -H "Authorization: Bearer $TOKEN")"
assert_eq '29 导出端点 200' '200' "$export_status"
grep -qi '^content-type: application/json; charset=utf-8' "$EXPORT_HEADERS"
assert_contains_quiet '29 导出 Content-Type JSON only' "$(cat "$EXPORT_HEADERS")" 'content-type: application/json; charset=utf-8'
if jq -e '.data.schemaVersion == 1 and .data.format == "xinban-json" and (.data.conversations | length > 0)' "$EXPORT_BODY" >/dev/null \
  && jq -e --arg id "$CONVERSATION_ID" '.data.conversations[] | select(.id == $id) | (.messages | length > 0) and (.memories | length > 0) and (.moodSnapshots[0].corrections | length == 2)' "$EXPORT_BODY" >/dev/null; then
  green '30 导出冻结 schema 字段断言'
else
  red "❌ 导出 schema 断言失败（body=$(cat "$EXPORT_BODY")）"
fi

EMPTY_PHONE="139$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
empty_sms="$(http POST /api/v1/auth/sms-code '' "{\"phone\":\"$EMPTY_PHONE\",\"purpose\":\"LOGIN\"}")"
assert_contains_quiet '31 空库用户验证码' "$empty_sms" '"devCode":"123456"'
empty_login="$(http POST /api/v1/auth/login '' "{\"phone\":\"$EMPTY_PHONE\",\"code\":\"123456\"}")"
EMPTY_TOKEN="$(printf '%s' "$empty_login" | json_get accessToken)"
[ -n "$EMPTY_TOKEN" ] || red '❌ 空库用户登录失败'
empty_export="$(http GET /api/v1/export "$EMPTY_TOKEN")"
if printf '%s' "$empty_export" | jq -e '.data.schemaVersion == 1 and .data.format == "xinban-json" and .data.conversations == []' >/dev/null; then
  green '31 空库导出返回合法空结构'
else
  red "❌ 空库导出非法（body=$empty_export）"
fi

# ---------- v0.6 增量段：JSON 备份导入写侧闭环 ----------
IMPORT_BODY="$RUN_DIR/import-body.json"
IMPORT_RESPONSE="$RUN_DIR/import-response.json"
IMPORTED_EXPORT="$RUN_DIR/imported-export.json"
REENPORT_AFTER_REPEAT="$RUN_DIR/reexport-after-repeat.json"
post_import() {
  local payload_file="$1" token="$2"
  curl -sS -m 20 -o "$IMPORT_RESPONSE" -w '%{http_code}' -X POST "$BASE/api/v1/import" \
    -H 'content-type: application/json' -H "Authorization: Bearer $token" --data-binary @"$payload_file"
}

IMPORT_PHONE="139$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
import_sms="$(http POST /api/v1/auth/sms-code '' "{\"phone\":\"$IMPORT_PHONE\",\"purpose\":\"LOGIN\"}")"
assert_contains '32 导入目标用户验证码' "$import_sms" '"devCode":"123456"'
import_login="$(http POST /api/v1/auth/login '' "{\"phone\":\"$IMPORT_PHONE\",\"code\":\"123456\"}")"
IMPORT_TOKEN="$(printf '%s' "$import_login" | json_get accessToken)"
[ -n "$IMPORT_TOKEN" ] || red '❌ 导入目标用户登录失败'

IMPORT_SOURCE="$RUN_DIR/import-source.json"
RUN_ID="$(basename "$RUN_DIR")"
node -e '
const fs = require("node:fs")
const [input, output, nonce] = process.argv.slice(1)
const source = JSON.parse(fs.readFileSync(input, "utf8")).data
source.conversations = source.conversations.map((conversation, conversationIndex) => {
  const messageIdMap = new Map()
  const memoryIdMap = new Map()
  const moodIdMap = new Map()
  const next = { ...conversation, id: `conv_${nonce}_${conversationIndex}` }
  next.messages = conversation.messages.map((message, index) => {
    const id = `msg_${nonce}_${conversationIndex}_${index}`
    messageIdMap.set(message.id, id)
    return { ...message, id }
  })
  next.memories = conversation.memories.map((memory, index) => {
    const id = `memory_${nonce}_${conversationIndex}_${index}`
    memoryIdMap.set(memory.id, id)
    return { ...memory, id, sourceMessageId: memory.sourceMessageId ? messageIdMap.get(memory.sourceMessageId) ?? null : null }
  })
  next.moodSnapshots = conversation.moodSnapshots.map((mood, index) => {
    const id = `mood_${nonce}_${conversationIndex}_${index}`
    moodIdMap.set(mood.id, id)
    return {
      ...mood,
      id,
      sourceMessageId: mood.sourceMessageId ? messageIdMap.get(mood.sourceMessageId) ?? null : null,
      memoryId: mood.memoryId ? memoryIdMap.get(mood.memoryId) ?? null : null,
      corrections: mood.corrections.map((correction, correctionIndex) => ({
        ...correction,
        id: 1_000_000 + Number(BigInt(nonce.replace(/\D/g, "") || "0") % 900000n) + conversationIndex * 1000 + correctionIndex,
        clientMutationId: `import_${nonce}_${conversationIndex}_${correctionIndex}`,
      })),
    }
  })
  return next
})
fs.writeFileSync(output, JSON.stringify(source))
' "$EXPORT_BODY" "$IMPORT_SOURCE" "$RUN_ID"

import_status="$(post_import "$IMPORT_SOURCE" "$IMPORT_TOKEN")"
if [ "$import_status" = 200 ] \
  && jq -e '.code == "OK" and .data.schemaVersion == 1 and .data.format == "xinban-json" and .data.received > 0 and .data.imported == .data.received and .data.skipped == 0 and (.data.results | all(.status == "imported"))' "$IMPORT_RESPONSE" >/dev/null; then
  green '33 JSON 导入恢复会话与关联实体'
else
  red "❌ 导入失败（status=$import_status body=$(cat "$IMPORT_RESPONSE")）"
fi

import_export_status="$(curl -sS -m 20 -o "$IMPORTED_EXPORT" -w '%{http_code}' "$BASE/api/v1/export" -H "Authorization: Bearer $IMPORT_TOKEN")"
if [ "$import_export_status" = 200 ] \
  && jq -e --slurpfile source "$IMPORT_SOURCE" '.data.conversations == $source[0].conversations' "$IMPORTED_EXPORT" >/dev/null; then
  green '34 导入后再导出 conversations 往返一致'
else
  red "❌ 导入往返不一致（status=$import_export_status body=$(cat "$IMPORTED_EXPORT")）"
fi

repeat_status="$(post_import "$IMPORT_SOURCE" "$IMPORT_TOKEN")"
curl -sS -m 20 -o "$REENPORT_AFTER_REPEAT" "$BASE/api/v1/export" -H "Authorization: Bearer $IMPORT_TOKEN"
if [ "$repeat_status" = 200 ] \
  && jq -e '.data.received > 0 and .data.imported == 0 and .data.skipped == .data.received and (.data.results | all(.status == "skipped" and .reason == "CONVERSATION_EXISTS"))' "$IMPORT_RESPONSE" >/dev/null \
  && jq -e --slurpfile before "$IMPORTED_EXPORT" '.data.conversations == $before[0].data.conversations' "$REENPORT_AFTER_REPEAT" >/dev/null; then
  green '35 重复导入幂等且数据不变'
else
  red "❌ 幂等导入失败（status=$repeat_status body=$(cat "$IMPORT_RESPONSE")）"
fi

jq 'del(.schemaVersion)' "$IMPORT_SOURCE" > "$IMPORT_BODY"
missing_version_status="$(post_import "$IMPORT_BODY" "$IMPORT_TOKEN")"
if [ "$missing_version_status" = 422 ] && jq -e '.code == "IMPORT_VERSION_MISSING"' "$IMPORT_RESPONSE" >/dev/null; then
  green '36 schemaVersion 缺失整批拒收'
else
  red "❌ 缺版本未被拒收（status=$missing_version_status body=$(cat "$IMPORT_RESPONSE")）"
fi

jq '.schemaVersion = 2' "$IMPORT_SOURCE" > "$IMPORT_BODY"
high_version_status="$(post_import "$IMPORT_BODY" "$IMPORT_TOKEN")"
if [ "$high_version_status" = 422 ] && jq -e '.code == "IMPORT_VERSION_UNSUPPORTED"' "$IMPORT_RESPONSE" >/dev/null; then
  green '37 schemaVersion 高版本整批拒收'
else
  red "❌ 高版本未被拒收（status=$high_version_status body=$(cat "$IMPORT_RESPONSE")）"
fi

jq 'del(.conversations[0].id)' "$IMPORT_SOURCE" > "$IMPORT_BODY"
schema_status="$(post_import "$IMPORT_BODY" "$IMPORT_TOKEN")"
if [ "$schema_status" = 422 ] && jq -e '.code == "IMPORT_SCHEMA_REJECTED"' "$IMPORT_RESPONSE" >/dev/null; then
  green '38 schema 非法整批拒收'
else
  red "❌ schema 非法未被拒收（status=$schema_status body=$(cat "$IMPORT_RESPONSE")）"
fi

# ---------- v0.7 增量段：近7日情绪周报最小版 ----------
second_sent="$(http POST /api/v1/chat/send "$TOKEN" "{\"conversationId\":\"$CONVERSATION_ID\",\"characterId\":\"$CHARACTER_ID\",\"content\":\"冒烟测试：今天有点难过\"}")"
if printf '%s' "$second_sent" | jq -e '.data.moodTimeline.points | length == 1' >/dev/null; then
  : # chat/send 只返回本次点位；周报接口负责读全量。
else
  red "❌ 周报第二样本写入失败（body=$second_sent）"
fi

weekly="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-weekly-report" "$TOKEN")"
if jq -e '.data.available == true and .data.degraded == false and .data.report != null and .data.report.sampleSize == 2 and .data.report.counts == {"positive":0,"neutral":0,"negative":2} and .data.report.trend == "STABLE"' "$BODY" >/dev/null   && printf '%s' "$weekly" | jq -e '.data.report.reason | contains("近7日样本2条")' >/dev/null; then
  green '39 周报7日窗口读取修正后样本'
else
  red "❌ 周报契约失败（body=$weekly）"
fi

fresh_weekly="$(http GET "/api/v1/conversations/$FRESH_CONVERSATION_ID/mood-weekly-report" "$TOKEN")"
if jq -e '.data.available == true and .data.degraded == false and .data.report == null' "$BODY" >/dev/null; then
  green '40 周报不足样本固定空态'
else
  red "❌ 周报空态失败（body=$fresh_weekly）"
fi

grep -q '<MoodWeeklyReportPanel value={moodWeeklyReport} />' "$ROOT/apps/mobile/src/screens/ChatScreen.tsx"
grep -q '近7日还没有足够的情绪记录' "$ROOT/apps/mobile/src/components/MoodWeeklyReportPanel.tsx"
grep -q '近7日情绪报告暂不可用' "$ROOT/apps/mobile/src/components/MoodWeeklyReportPanel.tsx"
(cd "$ROOT/apps/mobile" && npx vitest run -t 'maps ready empty and degraded weekly report states' src/utils/weeklyReport.test.ts >/dev/null)
green '41 周报用户可见状态契约'

(cd "$ROOT/apps/server" && npx vitest run -t 'degrades the weekly report when persistence or aggregation fails' src/routes/chat.routes.test.ts >/dev/null)
green '42 周报聚合失败安全降级'

# ---------- v0.8 增量段：自然周周期情绪报告最小版 ----------
period_report="$(http GET "/api/v1/conversations/$CONVERSATION_ID/mood-period-report" "$TOKEN")"
if printf '%s' "$period_report" | jq -e '.data.available == true and .data.degraded == false and .data.totalDays == 7 and .data.period != null and .data.period.id != null and .data.coverageDays >= 1 and (.data.moods | length) == .data.coverageDays and ([.data.moods[].count] | add) == 2 and .data.summary.sampleSize == 2 and .data.summary.counts == {"positive":0,"neutral":0,"negative":2} and .data.summary.trend == "STABLE"' >/dev/null; then
  green '43 自然周周期报告读取修正后样本并披露覆盖率'
else
  red "❌ 周期报告契约失败（body=$period_report）"
fi

fresh_period="$(http GET "/api/v1/conversations/$FRESH_CONVERSATION_ID/mood-period-report" "$TOKEN")"
if printf '%s' "$fresh_period" | jq -e '.data.available == true and .data.degraded == false and .data.period != null and .data.coverageDays == 0 and .data.totalDays == 7 and .data.moods == [] and .data.summary == null' >/dev/null; then
  green '44 空周期返回合法空结构'
else
  red "❌ 周期报告空态失败（body=$fresh_period）"
fi

(cd "$ROOT/apps/server" && npx vitest run src/lib/moodPeriodReport.test.ts >/dev/null)
(cd "$ROOT/apps/server" && npx vitest run -t 'degrades the period report and logs loudly when persistence or aggregation fails' src/routes/chat.routes.test.ts >/dev/null)
green '45 周期报告纯函数口径与降级契约'

# ---------- v0.9 增量段：周期对比 CSV 导出产物探针 ----------
CSV_BODY="${RUN_DIR}/comparison.csv"
CSV_HEADERS="${RUN_DIR}/comparison.headers"
csv_status="$(curl -sS -m 20 -o "$CSV_BODY" -D "$CSV_HEADERS" -w '%{http_code}' "$BASE/api/v1/conversations/$CONVERSATION_ID/mood-period-comparison/export.csv?periods=2" -H "Authorization: Bearer $TOKEN")"
csv_row_count="$(awk 'BEGIN{IGNORECASE=1} /^x-report-row-count:/{gsub("\r",""); print $2; exit}' "$CSV_HEADERS")"
csv_generated="$(awk 'BEGIN{IGNORECASE=1} /^x-report-generated-at:/{gsub("\r",""); print $2; exit}' "$CSV_HEADERS")"
csv_content_type="$(sed -n 's/^[Cc]ontent-[Tt]ype:[[:space:]]*//p' "$CSV_HEADERS" | head -1 | tr -d '\r')"
csv_ok="$(CSV_BODY="$CSV_BODY" node - <<'NODE'
const fs = require('fs')
const raw = fs.readFileSync(process.env.CSV_BODY, 'utf8')
const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
const lines = text.trim().split(/\r?\n/)
const rows = lines.slice(1).map(line => line.split(','))
const expected = [
  ['period_id', 'date', 'dimension', 'value'],
  ['count', 'positive', 'neutral', 'negative', 'averageScore'],
]
process.stdout.write(String(
  raw.charCodeAt(0) === 0xfeff &&
  lines[0] === expected[0].join(',') &&
  rows.length === 5 &&
  rows.every(row => row.length === 4) &&
  rows.map(row => row[2]).every((dimension, index) => dimension === expected[1][index])
))
NODE
)"
if [ "$csv_status" = 200 ] && [ "$csv_row_count" = 5 ] && [ "$csv_ok" = true ]   && printf '%s' "$csv_generated" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'   && [ "$csv_content_type" = 'text/csv; charset=utf-8' ]; then
  green '46 周期对比 CSV 导出产物探针'
else
  red "❌ CSV 导出探针失败（status=$csv_status rows=$csv_row_count ok=$csv_ok type=$csv_content_type generated=${csv_generated-}）"
fi

# ---------- v0.9 增量段：多周期对比与周期 CSV ----------
period_id="$(printf '%s' "$period_report" | jq -r '.data.period.id')"
comparison="$(http GET "/api/v1/periods/$period_id/comparison" "$TOKEN")"
if jq -e '.data.available == true and .data.degraded == false and .data.periodId == $pid and .data.previousPeriodId != $pid and .data.current.sampleSize == 2 and .data.current.coverageDays == 1 and .data.current.completeness == "PARTIAL" and .data.previous.sampleSize == 0 and .data.previous.coverageDays == 0 and .data.previous.completeness == "EMPTY" and ([.data.trend.currentAverage,.data.trend.previousAverage,.data.trend.deltaScore] | all(type == "number")) and .data.completeness.overall == "PARTIAL"' --arg pid "$period_id" "$BODY" >/dev/null; then
  green '47 多周期对比输出趋势三值与完整度'
else
  red "❌ 多周期对比契约失败（period=$period_id body=${comparison}）"
fi

csv_file="$RUN_DIR/period.csv"
csv_status="$(curl -sS -m 20 -o "$csv_file" -w '%{http_code}' "$BASE/api/v1/periods/$period_id/report.csv" -H "Authorization: Bearer $TOKEN")"
csv_header='period_id,date,available,degraded,from,to,positive,neutral,negative,sample_size,average_score,coverage_days,total_days,completeness'
csv_rows="$(tr -d '\r' < "$csv_file" | wc -l | tr -d ' ')"
if [ "$csv_status" = 200 ]   && [ "$(head -1 "$csv_file" | tr -d '\r')" = "$csv_header" ]   && [ "$csv_rows" = 2 ]   && ! grep -qiE 'row.?_?count' "$csv_file"; then
  green '48 周期 CSV 固定列序且不含行数元信息'
else
  red "❌ 周期 CSV 契约失败（status=$csv_status rows=$csv_rows header=$(head -1 "$csv_file")）"
fi

previous_id="$(printf '%s' "$comparison" | jq -r '.data.previousPeriodId')"
empty_csv_status="$(curl -sS -m 20 -o "$csv_file" -w '%{http_code}' "$BASE/api/v1/periods/$previous_id/report.csv" -H "Authorization: Bearer $TOKEN")"
empty_csv_rows="$(tr -d '\r' < "$csv_file" | wc -l | tr -d ' ')"
if [ "$empty_csv_status" = 200 ]   && [ "$(head -1 "$csv_file" | tr -d '\r')" = "$csv_header" ]   && [ "$empty_csv_rows" = 1 ]   && ! grep -qiE 'row.?_?count' "$csv_file"; then
  green '49 空周期 CSV 仅表头且无行数元信息'
else
  red "❌ 空周期 CSV 失败（status=$empty_csv_status rows=$empty_csv_rows）"
fi

# ---------- v0.10 增量段：单周期情绪洞察（三类封顶） ----------
empty_insight="$(http GET "/api/v1/periods/$previous_id/insight" "$TOKEN")"
if printf '%s' "$empty_insight" | jq -e '.data.available == true and .data.degraded == false and .data.periodId == $pid and .data.insights == []' --arg pid "$previous_id" >/dev/null; then
  green '50 空周期洞察返回合法空结构'
else
  red "❌ 空周期洞察失败（period=$previous_id body=${empty_insight}）"
fi

period_insight="$(http GET "/api/v1/periods/$period_id/insight" "$TOKEN")"
if printf '%s' "$period_insight" | jq -e '
  .data.available == true and .data.degraded == false and .data.periodId == $pid and
  ([.data.insights[].type] | sort) == ["ANNOTATION_CORRELATION","DOMINANT_MOOD","PERIOD_TREND"] and
  (.data.insights[] | select(.type == "DOMINANT_MOOD") | .value == {"mood":"NEGATIVE","count":2,"share":1}) and
  (.data.insights[] | select(.type == "DOMINANT_MOOD") | .evidence.sampleSize == 2 and .evidence.source == "moodPeriodReport.summary.counts" and (.evidence.periodId == $pid)) and
  (.data.insights[] | select(.type == "PERIOD_TREND") | .value == {"trend":"STABLE","sampleSize":2,"averageScore":-1,"coverageDays":1}) and
  (.data.insights[] | select(.type == "PERIOD_TREND") | .message | contains("趋势平稳")) and
  (.data.insights[] | select(.type == "ANNOTATION_CORRELATION") | .value == {"correctedSamples":1,"sampleSize":2}) and
  ([.data.insights[].message] | all(length > 0))
' --arg pid "$period_id" >/dev/null; then
  green '51 当前周期洞察输出与规则重算一致的值级结论'
else
  red "❌ 周期洞察契约失败（period=$period_id body=${period_insight}）"
fi

(cd "$ROOT/apps/server" && npx vitest run -t 'degrades to an empty safe structure and logs loudly on aggregation failure' src/routes/period.routes.test.ts >/dev/null)
(cd "$ROOT/apps/server" && npx vitest run src/lib/moodPeriodInsight.test.ts >/dev/null)
grep -q '情绪洞察暂不可用' "$ROOT/apps/mobile/src/components/MoodPeriodInsightPanel.tsx"
grep -q '本周期还没有足够的情绪记录' "$ROOT/apps/mobile/src/components/MoodPeriodInsightPanel.tsx"
(cd "$ROOT/apps/mobile" && npx vitest run -t '第 4 类判红' src/utils/moodPeriodInsight.test.ts >/dev/null)
green '52 洞察降级契约与用户可见状态（第 4 类判红）'

# ---------- v0.11 增量段：跨周期情绪洞察 ----------
comparison_periods=3
cross_period_a="$(node -e "const d=new Date(Date.parse('${period_id}T00:00:00.000Z')-14*864e5);console.log(d.toISOString().slice(0,10))")"
cross_period_b="$(node -e "const d=new Date(Date.parse('${period_id}T00:00:00.000Z')-7*864e5);console.log(d.toISOString().slice(0,10))")"
cross_insight="$(http GET "/api/v1/periods/$period_id/insight/comparison" "$TOKEN")"
if printf '%s' "$cross_insight" | jq -e '
  .data.available == true and .data.degraded == false and .data.degradedReason == null and
  .data.targetPeriodId == $pid and .data.requestedPeriods == 3 and
  .data.periodIds == [$a,$b,$pid] and
  [.data.periods[].empty] == [true,true,false] and
  (.data.insights | length == 3) and
  ([.data.insights[].type] | sort) == ["ANNOTATION_CORRELATION","DOMINANT_MOOD","PERIOD_TREND"] and
  ([.data.insights[].status] | all(. == "EMPTY")) and
  ([.data.insights[].reason] | all(. == "PERIOD_EMPTY")) and
  ([.data.insights[].value] | all(. == null)) and
  ([.data.insights[].evidence.fromPeriodId] | all(. == $a)) and
  ([.data.insights[].evidence.toPeriodId] | all(. == $pid)) and
  ([.data.insights[].evidence.fromSampleSize] | all(. == 0)) and
  ([.data.insights[].evidence.toSampleSize] | all(. == 2))
' --arg pid "$period_id" --arg a "$cross_period_a" --arg b "$cross_period_b" >/dev/null; then
  green '53 跨周期洞察空对比输出封闭空标记与周期 A vs C'
else
  red "❌ 跨周期洞察契约失败（period=$period_id body=${cross_insight}）"
fi

rejected_status="$(curl -sS -m 20 -w '%{http_code}' -o "$BODY" "$BASE/api/v1/periods/$period_id/insight/comparison?periods=4" -H "Authorization: Bearer $TOKEN")"
rejected_body="$(cat "$BODY")"
if [ "$rejected_status" = 400 ] && printf '%s' "$rejected_body" | jq -e '.code == "PERIOD_INSIGHT_COUNT_REJECTED"' >/dev/null; then
  green '54 跨周期洞察超限参数专用拒绝'
else
  red "❌ 跨周期洞察参数拒绝失败（status=$rejected_status body=${rejected_body}）"
fi

# ---------- v0.12 增量段：CSV 导入 → 聚合 → 洞察 ----------
import_period='2026-09-28'
import_file="$RUN_DIR/period-import.csv"
{
  printf '\xef\xbb\xbfperiod_id,date,dimension,value\r\n'
  printf '2026-09-28,2026-09-28,count,2\r\n'
  printf '2026-09-28,2026-09-28,positive,1\r\n'
  printf '2026-09-28,2026-09-28,neutral,0\r\n'
  printf '2026-09-28,2026-09-28,negative,1\r\n'
  printf '2026-09-28,2026-09-28,averageScore,0\r\n'
} > "$import_file"

import_result="$(http_csv "/api/v1/conversations/$CONVERSATION_ID/mood-period-comparison/import.csv" "$TOKEN" "$import_file")"
if printf '%s' "$import_result" | jq -e '
  .data.received == 5 and .data.imported == 5 and .data.skipped == 0 and
  .data.failed == 0 and .data.failures_total == 0 and .data.result_code == "OK" and
  (.data.imported + .data.skipped + .data.failed == .data.received)
' >/dev/null; then
  green '55 最小样本导入成功且计数不变量成立'
else
  red "❌ CSV 导入失败（body=${import_result}）"
fi

repeat_result="$(http_csv "/api/v1/conversations/$CONVERSATION_ID/mood-period-comparison/import.csv" "$TOKEN" "$import_file")"
if printf '%s' "$repeat_result" | jq -e '
  .data.received == 5 and .data.imported == 0 and .data.skipped == 5 and
  .data.failed == 0 and .data.result_code == "OK"
' >/dev/null; then
  green '56 同文件重导全跳过且零重复'
else
  red "❌ CSV 幂等失败（body=${repeat_result}）"
fi

aggregate_status="$(curl -sS -m 20 -w '%{http_code}' -o /dev/null "$BASE/api/v1/periods/$import_period/report.csv" -H "Authorization: Bearer $TOKEN")"
aggregate_csv="$(curl -sS -m 20 "$BASE/api/v1/periods/$import_period/report.csv" -H "Authorization: Bearer $TOKEN")"
if [ "$aggregate_status" = 200 ] && printf '%s' "$aggregate_csv" | grep -q "^$import_period,$import_period,true,false,.*,1,0,1,2,0,1,7,PARTIAL"; then
  green '57 导入值被既有周期聚合真实消费'
else
  red "❌ 周期聚合失败（status=${aggregate_status} csv=${aggregate_csv}）"
fi

imported_insight="$(http GET "/api/v1/periods/$import_period/insight" "$TOKEN")"
if printf '%s' "$imported_insight" | jq -e '
  .data.available == true and .data.degraded == false and .data.periodId == $pid and
  (.data.insights[] | select(.type == "DOMINANT_MOOD") | .value.mood == "NEGATIVE" and .value.count == 1 and .value.share == 0.5) and
  (.data.insights[] | select(.type == "PERIOD_TREND") | .value.sampleSize == 2 and .value.averageScore == 0)
' --arg pid "$import_period" >/dev/null; then
  green '58 导入值被既有洞察真实消费'
else
  red "❌ 导入洞察失败（body=${imported_insight}）"
fi

green "心伴 v0.12 冒烟通过：$PASS 项 / 58 项"
