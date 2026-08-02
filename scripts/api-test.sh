#!/usr/bin/env bash
# ============================================================
# 心伴AI · 后端 API 全链路测试
# 用法:
#   ./scripts/api-test.sh                    # 默认连 http://localhost:3888
#   API_BASE=http://localhost:3888 ./scripts/api-test.sh
#   TEST_PHONE=13900001111 ./scripts/api-test.sh   # 换手机号避开验证码防刷
#
# 覆盖: 健康检查 / 验证码 / 登录 / 鉴权拦截 / 核心数据端点 / token 刷新
# 退出码: 0=全部通过, 1=有失败
# ============================================================
set -uo pipefail

BASE="${API_BASE:-http://localhost:3888}"
PHONE="${TEST_PHONE:-13800138000}"
CODE="${TEST_CODE:-123456}"        # 开发期固定验证码
TOKEN_FILE="/tmp/xinban_api_test_token.txt"
PASS=0
FAIL=0

# ---- 工具函数 --------------------------------------------------
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }

# 发送 HTTP 请求并返回完整响应体
# req METHOD PATH [DATA] [TOKEN]
req() {
  local m="$1" p="$2" d="${3:-}" t="${4:-}"
  local -a args=(-s -m 20 -X "$m" "$BASE$p" -H "content-type: application/json")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$d" ] && args+=(-d "$d")
  curl "${args[@]}"
}

# 断言响应含期望子串
check() {
  local desc="$1" actual="$2" expect="$3"
  if echo "$actual" | grep -q "$expect"; then
    green "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    red "  ❌ $desc → $(echo "$actual" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo "════════════════════════════════════════════"
echo " 心伴AI 后端 API 测试   BASE=$BASE"
echo "════════════════════════════════════════════"

echo ""
echo "── 0. 健康检查 ──"
health=$(req GET /health)
check "/health 返回 OK" "$health" '"code":"OK"'

echo ""
echo "── 1. 发送验证码 ──"
sms=$(req POST /api/v1/auth/sms-code "{\"phone\":\"$PHONE\",\"purpose\":\"LOGIN\"}")
check "POST /auth/sms-code" "$sms" '"code":"OK"'

echo ""
echo "── 2. 登录 ──"
login=$(req POST /api/v1/auth/login "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")
check "POST /auth/login 成功" "$login" '"code":"OK"'

# 提取 token（用 python 解析更稳）
TOKEN=$(echo "$login" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || true)
REFRESH=$(echo "$login" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  red "  无法获取 accessToken，后续鉴权测试跳过"
  FAIL=$((FAIL + 1))
  echo ""
  echo "结果: $PASS 通过, $FAIL 失败"
  exit 1
fi
echo "$TOKEN" > "$TOKEN_FILE"
echo "  （accessToken 长度 ${#TOKEN}）"

echo ""
echo "── 3. 鉴权拦截（无 token 应拒绝） ──"
noauth=$(req GET /api/v1/characters)
check "无 token 访问 /characters" "$noauth" '"code":"UNAUTHORIZED"'

echo ""
echo "── 4. 核心数据端点（带 token） ──"
AUTH="Authorization: Bearer $TOKEN"
for ep in /api/v1/characters /api/v1/conversations /api/v1/gifts /api/v1/membership/plans /api/v1/products /api/v1/compliance/status; do
  r=$(req GET "$ep" "" "$TOKEN")
  check "GET $ep" "$r" '"code":"OK"'
done

echo ""
echo "── 5. token 刷新 ──"
refresh=$(req POST /api/v1/auth/refresh "{\"refreshToken\":\"$REFRESH\"}")
check "POST /auth/refresh" "$refresh" '"code":"OK"'

echo ""
echo "── 6. 登录后建会话（验证写入链路） ──"
char_id=$(req GET /api/v1/characters "" "$TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null || true)
if [ -n "$char_id" ]; then
  conv=$(req POST /api/v1/conversations "{\"characterId\":\"$char_id\"}" "$TOKEN")
  check "POST /conversations 建会话" "$conv" '"code":"OK"'
else
  red "  无法获取角色 id，跳过建会话测试"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  green " 全部通过: $PASS 项测试 ✅"
  exit 0
else
  red " 结果: $PASS 通过, $FAIL 失败 ❌"
  exit 1
fi
echo "════════════════════════════════════════════"
