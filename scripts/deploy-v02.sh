#!/usr/bin/env bash
# 心伴 v0.2 · 本仓 deploy 节点复验
# deploy 定义：production build 产物 dist/localServer.js 可启动且 /health up。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${XINBAN_DEPLOY_PORT:-15888}"
BASE="http://127.0.0.1:${PORT}"
LOG="$(mktemp "${TMPDIR:-/tmp}/xinban-deploy-v02.XXXXXX")"
PID=''

cleanup() {
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    descendants "$PID" | while read -r child; do kill -9 "$child" 2>/dev/null || true; done
    kill -9 "$PID" 2>/dev/null || true
  fi
  port_pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  [ -z "$port_pids" ] || kill -9 $port_pids 2>/dev/null || true
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

descendants() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do
    descendants "$child"
    echo "$child"
  done
}

start_dist() {
  cd "$ROOT/apps/server"
  DATABASE_URL="${XINBAN_DEPLOY_DATABASE_URL:-file:./data/xinban-deploy-v02.db}" HTTP_PORT="$PORT" \
    SMS_PROVIDER=dev PAY_PROVIDER=mock LLM_PROVIDER=mock ANTI_ADDICTION_LATE_NIGHT=false \
    npm run start:standalone >"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 60); do
    if curl -fsS "$BASE/health" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$PID" 2>/dev/null; then return 1; fi
    sleep 0.25
  done
  return 1
}

[ -d "$ROOT/apps/server/node_modules" ] || { echo 'missing node_modules; run npm run setup' >&2; exit 1; }

echo '== deploy build =='
cd "$ROOT"
npm run build || exit $?

echo '== deploy start =='
if start_dist; then echo 'deploy /health: 0'; else tail -100 "$LOG" >&2; exit 1; fi
descendants "$PID" | while read -r child; do kill -9 "$child" 2>/dev/null || true; done
kill -9 "$PID" 2>/dev/null || true
PID=''
sleep 0.2

echo '== post-deploy rerun: build =='
npm run build
build_rc=$?
echo "build exit: $build_rc"

echo '== post-deploy rerun: start =='
if start_dist; then start_rc=0; echo 'start /health: 0'; else start_rc=1; tail -100 "$LOG" >&2; fi
descendants "$PID" | while read -r child; do kill -9 "$child" 2>/dev/null || true; done
kill -9 "$PID" 2>/dev/null || true
PID=''
sleep 0.2
echo "start exit: $start_rc"

echo '== post-deploy rerun: test =='
npm test
test_rc=$?
echo "test exit: $test_rc"

printf '\n心伴 v0.2 deploy 复验：build=%s start=%s test=%s\n' "$build_rc" "$start_rc" "$test_rc"
if [ "$build_rc" -ne 0 ] || [ "$start_rc" -ne 0 ] || [ "$test_rc" -ne 0 ]; then exit 1; fi
