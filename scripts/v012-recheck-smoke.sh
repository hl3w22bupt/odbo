#!/usr/bin/env bash
# v0.12 独立复核冒烟：最小样本导入 → 周期聚合 → 洞察 → 干跑反向喂解析器 → live 往返等价。
# 证据四要素：命令 / 退出码 / 输出摘要 / 时间戳。端口 13889，自管服务进程。
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${XINBAN_RECHECK_PORT:-13889}"
BASE="http://127.0.0.1:${PORT}"
RUN_DIR="$(mktemp -d /tmp/v012-recheck.XXXXXX)"
BODY="$RUN_DIR/body.txt"
LOG_TS() { date '+%Y-%m-%dT%H:%M:%S%z'; }
PASS=0
FAIL=0
green() { echo "✅ $1"; PASS=$((PASS + 1)); }
red() { echo "❌ $1"; FAIL=$((FAIL + 1)); }
http() {
  local method="$1" path="$2" token="$3" data="${4:-}"
  if [ -n "$data" ]; then
    curl -sS -m 20 -o "$BODY" -X "$method" "$BASE$path" \
      -H 'content-type: application/json' ${token:+-H "Authorization: Bearer $token"} -d "$data"
  else
    curl -sS -m 20 -o "$BODY" -X "$method" "$BASE$path" ${token:+-H "Authorization: Bearer $token"}
  fi
  cat "$BODY"
}
http_status() {
  local method="$1" path="$2" token="$3"
  curl -sS -m 20 -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" ${token:+-H "Authorization: Bearer $token"}
}
json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.slice(s.indexOf("{"),s.lastIndexOf("}")+1));const p=process.argv[1].split(".");let v=j;for(const k of p){v=v?.[k]}process.stdout.write(String(v??""))})' "$1"; }

echo "[recheck] run_dir=$RUN_DIR started=$(LOG_TS)"

# ---------- 启动服务（临时 SQLite） ----------
DB_PATH="$RUN_DIR/recheck.db"
(cd "$ROOT/apps/server" \
  && DATABASE_URL="file:$DB_PATH" npx prisma db push >/dev/null 2>&1 \
  && DATABASE_URL="file:$DB_PATH" npm run prisma:seed >/dev/null 2>&1) || { red '临时库初始化'; echo "RECHECK_EXIT=1"; exit 1; }
green "D0 临时库初始化（db push + seed）"

DATABASE_URL="file:$DB_PATH" HTTP_PORT="$PORT" node "$ROOT/apps/server/dist/localServer.js" \
  >"$RUN_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null' EXIT
ready=0
for _ in $(seq 1 40); do
  if curl -s -m 1 "$BASE/health" | grep -q '"status":"up"'; then ready=1; break; fi
  sleep 0.5
done
[ "$ready" = 1 ] && green 'D1 服务健康 /health status=up' || { red '服务未就绪'; tail -5 "$RUN_DIR/server.log"; echo "RECHECK_EXIT=1"; exit 1; }

# ---------- 鉴权与会话 ----------
PHONE="139$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
http POST /api/v1/auth/sms-code '' "{\"phone\":\"$PHONE\",\"purpose\":\"LOGIN\"}" >/dev/null
login="$(http POST /api/v1/auth/login '' "{\"phone\":\"$PHONE\",\"code\":\"123456\"}")"
TOKEN="$(printf '%s' "$login" | json_get data.accessToken)"
[ -n "$TOKEN" ] && green 'D2 短信登录取得 accessToken' || { red '登录失败'; echo "RECHECK_EXIT=1"; exit 1; }

characters="$(http GET /api/v1/characters "$TOKEN")"
CHARACTER_ID="$(printf '%s' "$characters" | json_get data.0.id)"
conversation="$(http POST /api/v1/conversations "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"mode\":\"SINGLE\"}")"
CONVERSATION_ID="$(printf '%s' "$conversation" | json_get data.id)"
[ -n "$CONVERSATION_ID" ] && green "D3 会话就绪 id=$CONVERSATION_ID" || { red '会话创建失败'; echo "RECHECK_EXIT=1"; exit 1; }

# ---------- D4 最小样本导入（全新周期 2026-09-28） ----------
IMPORT_PERIOD='2026-09-28'
IMPORT_FILE="$RUN_DIR/period-import.csv"
{
  printf '\xef\xbb\xbfperiod_id,date,dimension,value\r\n'
  printf '2026-09-28,2026-09-28,count,2\r\n'
  printf '2026-09-28,2026-09-28,positive,1\r\n'
  printf '2026-09-28,2026-09-28,neutral,0\r\n'
  printf '2026-09-28,2026-09-28,negative,1\r\n'
  printf '2026-09-28,2026-09-28,averageScore,0\r\n'
} > "$IMPORT_FILE"
import_status="$(curl -sS -m 20 -o "$BODY" -w '%{http_code}' -X POST \
  "$BASE/api/v1/conversations/$CONVERSATION_ID/mood-period-comparison/import.csv" \
  -H 'content-type: text/csv' -H "Authorization: Bearer $TOKEN" --data-binary @"$IMPORT_FILE")"
import_result="$(cat "$BODY")"
if [ "$import_status" = 200 ] && printf '%s' "$import_result" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const d=JSON.parse(s).data;
  process.exit(d.received===5&&d.imported===5&&d.skipped===0&&d.failed===0&&d.failures_total===0&&d.result_code==="OK"&&d.imported+d.skipped+d.failed===d.received?0:1);
})'; then
  green 'D4 最小样本导入 received=5/imported=5/计数不变量成立'
else
  red "D4 导入失败（${import_result}）"
fi

# ---------- D5 幂等：同文件重导全跳过 ----------
repeat_result="$(curl -sS -m 20 -X POST \
  "$BASE/api/v1/conversations/$CONVERSATION_ID/mood-period-comparison/import.csv" \
  -H 'content-type: text/csv' -H "Authorization: Bearer $TOKEN" --data-binary @"$IMPORT_FILE")"
if printf '%s' "$repeat_result" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const d=JSON.parse(s).data;
  process.exit(d.imported===0&&d.skipped===5&&d.failed===0?0:1);
})'; then
  green 'D5 同文件重导 imported=0/skipped=5（幂等零重复）'
else
  red "D5 幂等失败（${repeat_result}）"
fi

# ---------- D6 周期聚合值级消费 ----------
aggregate_csv="$(curl -sS -m 20 "$BASE/api/v1/periods/$IMPORT_PERIOD/report.csv" -H "Authorization: Bearer $TOKEN")"
if printf '%s' "$aggregate_csv" | grep -q "^$IMPORT_PERIOD,$IMPORT_PERIOD,true,false,.*,1,0,1,2,0,1,7,PARTIAL"; then
  green 'D6 report.csv 值级行 pos=1/neu=0/neg=1/size=2/avg=0/PARTIAL'
else
  red "D6 聚合失败（${aggregate_csv}）"
fi

# ---------- D7 洞察值级消费 ----------
imported_insight="$(http GET "/api/v1/periods/$IMPORT_PERIOD/insight" "$TOKEN" '')"
if printf '%s' "$imported_insight" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const d=JSON.parse(s).data;
  const dom=d.insights.find(i=>i.type==="DOMINANT_MOOD");
  const trend=d.insights.find(i=>i.type==="PERIOD_TREND");
  process.exit(d.available===true&&d.degraded===false&&dom?.value?.mood==="NEGATIVE"&&dom?.value?.count===1&&dom?.value?.share===0.5&&trend?.value?.sampleSize===2&&trend?.value?.averageScore===0?0:1);
})'; then
  green 'D7 洞察 DOMINANT_MOOD=NEGATIVE count=1 share=0.5；PERIOD_TREND size=2 avg=0'
else
  red "D7 洞察失败（${imported_insight}）"
fi

# ---------- D8 干跑：真实 v0.9 导出字节反向喂导入解析器 ----------
EXPORT_A="$RUN_DIR/export-a.csv"
curl -sS -m 20 -o "$EXPORT_A" "$BASE/api/v1/conversations/$CONVERSATION_ID/mood-period-comparison/export.csv?periods=3" -H "Authorization: Bearer $TOKEN"
dryrun="$(node "$ROOT/scripts/v012-recheck-dryrun.mjs" "$EXPORT_A" "$ROOT/apps/server/dist/lib/periodCsvImport.js")"
case "$dryrun" in
  *'"kind":"ok"'*'"received":5'*'"samples":2'*)
    green "D8 干跑：v0.9 导出文件反向喂解析器 ok（${dryrun}）" ;;
  *)
    red "D8 干跑失败（${dryrun}）" ;;
esac

# ---------- D9 live 往返等价：导出 → 干净会话导入 → 再导出 diff 为空 ----------
conv_b_body="$(http POST /api/v1/conversations "$TOKEN" "{\"characterId\":\"$CHARACTER_ID\",\"mode\":\"SINGLE\"}")"
CONV_B="$(printf '%s' "$conv_b_body" | json_get data.id)"
[ -n "$CONV_B" ] || { red 'D9 会话 B 创建失败'; }
rb_result="$(curl -sS -m 20 -X POST \
  "$BASE/api/v1/conversations/$CONV_B/mood-period-comparison/import.csv" \
  -H 'content-type: text/csv' -H "Authorization: Bearer $TOKEN" --data-binary @"$EXPORT_A")"
printf '%s' "$rb_result" | grep -q '"imported":5' || red "D9 会话 B 导入失败（${rb_result}）"
EXPORT_B="$RUN_DIR/export-b.csv"
curl -sS -m 20 -o "$EXPORT_B" "$BASE/api/v1/conversations/$CONV_B/mood-period-comparison/export.csv?periods=3" -H "Authorization: Bearer $TOKEN"
if cmp -s "$EXPORT_A" "$EXPORT_B"; then
  green "D9 往返等价：export→import→export 字节级一致（$(wc -c < "$EXPORT_A" | tr -d ' ') bytes）"
else
  red 'D9 往返 diff 非空'
  diff "$EXPORT_A" "$EXPORT_B" | head -5
fi

echo "-----------------------------"
echo "[recheck] pass=$PASS fail=$FAIL finished=$(LOG_TS)"
if [ "$FAIL" -eq 0 ]; then echo "RECHECK_EXIT=0"; exit 0; else echo "RECHECK_EXIT=1"; exit 1; fi
