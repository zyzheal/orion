#!/bin/bash
# 一键验证单个模块的 9 层调用链
# 用法: bash scripts/verify-9-layer.sh 模块名 后端端口
# 示例: bash scripts/verify-9-layer.sh pipelines 3001

MODULE_NAME="${1:?模块名}"
BACKEND_PORT="${2:-3001}"
TOKEN="${ORION_TOKEN:-$(cat .token 2>/dev/null)}"

echo "=== 9 层调用链验证: $MODULE_NAME ==="

# L1-L3: 前端路由 + 页面 + API Client
echo "[L1-L3] 前端路由与 API Client..."
if grep -q "path:.*$MODULE_NAME" orion-frontend/src/router/routes.tsx 2>/dev/null; then
  echo "  ✅ 前端路由已注册"
else
  echo "  ❌ 前端路由未注册"
fi

if grep -rl "$MODULE_NAME" orion-frontend/src/api/ 2>/dev/null | head -1; then
  echo "  ✅ API Client 已定义"
else
  echo "  ❌ API Client 未定义"
fi

# L4: Gateway 代理
echo "[L4] Gateway 代理..."
if grep -q "$MODULE_NAME" orion-api-gateway/src/routes.ts 2>/dev/null; then
  echo "  ✅ Gateway 代理已配置"
else
  echo "  ⚠️ Gateway 代理未找到（可能走直连）"
fi

# L5-L6: 后端路由 + Controller
echo "[L5-L6] 后端路由与 Controller..."
if grep -q "${MODULE_NAME}-routes" orion-platform-service/src/api/routes.ts 2>/dev/null; then
  echo "  ✅ 后端路由已注册"
else
  echo "  ❌ 后端路由未注册"
fi

# L8: 直接调后端 API 验证
echo "[L8] 后端 API 响应..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "http://localhost:${BACKEND_PORT}/api/v1/${MODULE_NAME}" 2>/dev/null)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
  echo "  ✅ 后端返回 $RESPONSE（401 说明路由通了，缺 Token）"
else
  echo "  ❌ 后端返回 $RESPONSE"
fi

echo "=== 验证完成 ==="