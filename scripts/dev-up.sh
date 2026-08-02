#!/usr/bin/env bash
# ============================================================
# 心伴AI · 一键启动（服务端 + 可选客户端）
#
#   ./scripts/dev-up.sh            # 只启动服务端
#   ./scripts/dev-up.sh --client   # 服务端 + Expo 客户端（iOS 模拟器）
#   ./scripts/dev-up.sh --mock     # 客户端用离线 mock 模式（不连后端）
#
# 端口: HTTP 3888 · WS 49144 · Metro 8081
# 日志: logs/server.log · logs/client.log
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$ROOT/logs"
SERVER_PID="$LOGDIR/server.pid"
CLIENT_PID="$LOGDIR/client.pid"
API_URL="${API_URL:-http://localhost:3888}"
WANT_CLIENT=0
MOCK=0

for arg in "$@"; do
  case "$arg" in
    --client) WANT_CLIENT=1 ;;
    --mock)   MOCK=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg（支持 --client / --mock）"; exit 1 ;;
  esac
done

mkdir -p "$LOGDIR"
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }

port_busy() { lsof -tnP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ---- 服务端 --------------------------------------------------
if [ -f "$SERVER_PID" ] && kill -0 "$(cat "$SERVER_PID")" 2>/dev/null; then
  green "服务端已在运行 (PID $(cat "$SERVER_PID"))，跳过启动"
elif port_busy 3888; then
  red "端口 3888 已被占用！"
  red "  可能是残留进程，先执行 ./scripts/dev-down.sh 清理"
  exit 1
else
  echo "启动服务端（npm run dev → logs/server.log）..."
  # 在子 shell 中后台运行，记录主进程 PID（dev.mjs 会再 spawn 引擎与 worker）
  (cd "$ROOT/apps/server" && exec npm run dev) > "$LOGDIR/server.log" 2>&1 &
  echo $! > "$SERVER_PID"
fi

# 等待 HTTP 就绪
echo -n "等待服务端就绪 "
for _ in $(seq 1 45); do
  if curl -s -m 2 "$API_URL/health" 2>/dev/null | grep -q '"code":"OK"'; then
    green "✓ 就绪 ($API_URL)"
    break
  fi
  echo -n "."; sleep 2
  if ! kill -0 "$(cat "$SERVER_PID" 2>/dev/null)" 2>/dev/null; then
    red "\n服务端进程已退出，查看 logs/server.log"
    tail -20 "$LOGDIR/server.log"
    exit 1
  fi
done

# ---- 客户端（可选） ------------------------------------------
if [ "$WANT_CLIENT" -eq 1 ] || [ "$MOCK" -eq 1 ]; then
  if [ -f "$CLIENT_PID" ] && kill -0 "$(cat "$CLIENT_PID")" 2>/dev/null; then
    green "客户端已在运行 (PID $(cat "$CLIENT_PID"))，跳过启动"
  else
    echo "启动 Expo 客户端..."
    cd "$ROOT/apps/mobile"
    if [ "$MOCK" -eq 1 ]; then
      (exec npx expo start --ios) > "$LOGDIR/client.log" 2>&1 &
    else
      (EXPO_PUBLIC_API_URL="$API_URL" exec npx expo start --ios) > "$LOGDIR/client.log" 2>&1 &
    fi
    echo $! > "$CLIENT_PID"
    cd "$ROOT"
  fi
fi

echo ""
green "✔ 完成。运行状态："
echo "  服务端日志: tail -f $LOGDIR/server.log"
echo "  客户端日志: tail -f $LOGDIR/client.log"
echo "  API 测试:   ./scripts/api-test.sh"
