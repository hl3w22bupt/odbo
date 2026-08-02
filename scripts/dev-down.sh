#!/usr/bin/env bash
# ============================================================
# 心伴AI · 一键停止（服务端 + 客户端）
#
#   ./scripts/dev-down.sh    # 停止心伴的服务端与 Expo 客户端
#
# 安全说明:
#   - 只清理心伴进程：本项目的 tsx worker、iii -c config.yaml 引擎、Expo
#   - 不会动其他 app 的 iii 引擎（例如 `iii --use-default-config`）
#   - 通过 PID 文件优先，失败时按进程特征兜底
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$ROOT/logs"
SERVER_PID="$LOGDIR/server.pid"
CLIENT_PID="$LOGDIR/client.pid"

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }

kill_tree() {
  local pid="$1"
  # 递归杀子进程（dev.mjs 会 spawn 引擎与 worker）
  local children
  children=$(pgrep -P "$pid" 2>/dev/null) || true
  for c in $children; do kill_tree "$c"; done
  kill "$pid" 2>/dev/null || true
}

stopped=0

# 1. 按 PID 文件停服务端（npm run dev 主进程 → 递归杀其子进程）
if [ -f "$SERVER_PID" ]; then
  pid=$(cat "$SERVER_PID")
  if kill -0 "$pid" 2>/dev/null; then
    echo "停止服务端 (PID $pid)..."
    kill_tree "$pid"
    stopped=1
  fi
  rm -f "$SERVER_PID"
fi

# 2. 兜底：杀本项目残留的 tsx worker 与其引擎（仅限 cwd 在 apps/server 的）
#    精确匹配，避免误杀其他项目
pkill -f "apps/server/node_modules/.bin/tsx watch src/index.ts" 2>/dev/null && { echo "清理残留 tsx worker"; stopped=1; }
pkill -f "apps/server.*tsx watch" 2>/dev/null || true

# 3. 停心伴引擎（iii -c config.yaml，即 3888/49144 的监听者）
#    不碰 `iii --use-default-config`（其他 app 的引擎）
for port in 3888 49144; do
  for pid in $(lsof -tnP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
    case "$cmd" in
      *"config.yaml"*) echo "停止心伴引擎 (PID $pid, 端口 $port)"; kill "$pid" 2>/dev/null; stopped=1 ;;
      *) echo "跳过: 端口 $port 的进程不是心伴引擎 ($cmd)" ;;
    esac
  done
done

# 4. 停 Expo 客户端
if [ -f "$CLIENT_PID" ]; then
  pid=$(cat "$CLIENT_PID")
  if kill -0 "$pid" 2>/dev/null; then
    echo "停止客户端 Expo (PID $pid)..."
    kill_tree "$pid"
    stopped=1
  fi
  rm -f "$CLIENT_PID"
fi
pkill -f "apps/mobile/node_modules/.bin/expo start" 2>/dev/null && { echo "清理 Expo"; stopped=1; } || true

echo ""
if [ "$stopped" -eq 1 ]; then
  green "✔ 已停止。可用 ./scripts/dev-up.sh 重新启动"
else
  echo "没有发现运行中的心伴进程（或 PID 文件已失效）"
fi
