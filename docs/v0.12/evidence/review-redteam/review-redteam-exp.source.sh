#!/usr/bin/env bash
set -uo pipefail
ROOT=/Users/leo/.myrd/workspaces/cms1g8itk000am9fyr4l0vp35/run-cmv8q061l000ym95fwayuvswe
PORT=13890
BASE="http://127.0.0.1:${PORT}"
RUN_DIR=/tmp/v012-redteam/run
rm -rf "$RUN_DIR"; mkdir -p "$RUN_DIR"
DB_PATH="$RUN_DIR/redteam.db"
LOG_PATH="$RUN_DIR/server.log"
PID_FILE="$RUN_DIR/server.pid"
BODY="$RUN_DIR/body.json"
cd "$ROOT/apps/server"
DATABASE_URL="file:$DB_PATH" npx prisma db push >/dev/null 2>&1
DATABASE_URL="file:$DB_PATH" npm run prisma:seed >/dev/null 2>&1
DATABASE_URL="file:$DB_PATH" HTTP_PORT="$PORT" SMS_PROVIDER=dev PAY_PROVIDER=mock LLM_PROVIDER=mock \
  CONTENT_FILTER_ENABLED=true ANTI_ADDICTION_LATE_NIGHT=false npm run dev:standalone >"$LOG_PATH" 2>&1 &
server_pid=$!
echo "$server_pid" > "$PID_FILE"
ready=0
for _ in $(seq 1 60); do
  if curl -s -m 1 "$BASE/health" | grep -q '"status":"up"'; then ready=1; break; fi
  sleep 0.5
done
if [ "$ready" != 1 ]; then echo "SERVER FAILED TO START"; tail -30 "$LOG_PATH"; exit 1; fi
echo "[ok] server up"

http() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local -a args=(-sS -m 20 -w '\n%{http_code}' -o "$BODY" -X "$method" "$BASE$path" -H 'content-type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-d "$data")
  curl "${args[@]}" >/dev/null
  cat "$BODY"
}
http_csv() {
  local path="$1" token="$2" file="$3"
  curl -sS -m 20 -w '\n%{http_code}' -o "$BODY" -X POST "$BASE$path" \
    -H 'content-type: text/csv' -H "Authorization: Bearer $token" --data-binary @"$file" >/dev/null
  cat "$BODY"
}

PHONE="137$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
http POST /api/v1/auth/sms-code '' "{\"phone\":\"$PHONE\",\"purpose\":\"LOGIN\"}" >/dev/null
login="$(http POST /api/v1/auth/login '' "{\"phone\":\"$PHONE\",\"code\":\"123456\"}")"
TOKEN="$(printf '%s' "$login" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data.accessToken||""))')"
characters="$(http GET /api/v1/characters "$TOKEN")"
CHARACTER_ID="$(printf '%s' "$characters" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data[0]?.id ?? ""))')"
conversation="$(http POST /api/v1/conversations "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"mode\":\"SINGLE\"}")"
CONV_ID="$(printf '%s' "$conversation" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).data.id||""))')"
echo "[ok] logged in, conv=$CONV_ID"

# 实验 A：单行合法但组级不完整（只有 count 维度）
printf '\xef\xbb\xbfperiod_id,date,dimension,value\r\n2026-10-12,2026-10-12,count,1\r\n' > "$RUN_DIR/incomplete.csv"
echo "=== EXP A: incomplete group (1 valid row, 4 dims missing) ==="
http_csv "/api/v1/conversations/$CONV_ID/mood-period-comparison/import.csv" "$TOKEN" "$RUN_DIR/incomplete.csv"

# 实验 B：混合文件 = 完整新周期组(2026-09-28) + 不完整组(2026-10-05 仅 count)
{
  printf '\xef\xbb\xbfperiod_id,date,dimension,value\r\n'
  printf '2026-09-28,2026-09-28,count,2\r\n'
  printf '2026-09-28,2026-09-28,positive,1\r\n'
  printf '2026-09-28,2026-09-28,neutral,0\r\n'
  printf '2026-09-28,2026-09-28,negative,1\r\n'
  printf '2026-09-28,2026-09-28,averageScore,0\r\n'
  printf '2026-10-05,2026-10-05,count,1\r\n'
} > "$RUN_DIR/mixed.csv"
echo "=== EXP B: mixed file (complete group + incomplete group) ==="
http_csv "/api/v1/conversations/$CONV_ID/mood-period-comparison/import.csv" "$TOKEN" "$RUN_DIR/mixed.csv"

# 实验 C：数值组无损约束违反（complete dims but lossless violation）
{
  printf '\xef\xbb\xbfperiod_id,date,dimension,value\r\n'
  printf '2026-08-31,2026-08-31,count,2\r\n'
  printf '2026-08-31,2026-08-31,positive,1\r\n'
  printf '2026-08-31,2026-08-31,neutral,1\r\n'
  printf '2026-08-31,2026-08-31,negative,0\r\n'
  printf '2026-08-31,2026-08-31,averageScore,0.25\r\n'
} > "$RUN_DIR/lossless.csv"
echo "=== EXP C: lossless-violation group (5 dims, avg mismatch) ==="
http_csv "/api/v1/conversations/$CONV_ID/mood-period-comparison/import.csv" "$TOKEN" "$RUN_DIR/lossless.csv"

# 残留检查：B 中新周期是否写入
echo "=== residue check: report for 2026-09-28 (from mixed file exp B) ==="
curl -sS -m 10 "$BASE/api/v1/periods/2026-09-28/report.csv" -H "Authorization: Bearer $TOKEN" | head -3

kill -9 "$server_pid" 2>/dev/null
sleep 1
pkill -9 -f "dev:standalone" 2>/dev/null
pkill -9 -f "tsx.*localServer" 2>/dev/null
echo "[done] redteam experiment finished"
