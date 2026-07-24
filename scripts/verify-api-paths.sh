#!/bin/bash
# 验证前端 API 路径与后端路由一致性
# 对比前端 API 调用路径与后端注册的路由前缀

cd /Users/heal/orion-design

echo "=== API 路径一致性验证 ==="
echo ""

# ========================================
# 提取前端使用的路径（含 /v1/ 前缀的）
# ========================================
echo "--- 前端 API 路径 ---"
FRONTEND_PATHS=$(grep -rohE "/v1/[a-zA-Z0-9_-]+" orion-frontend/src/api/*.ts 2>/dev/null | \
  sed 's|^/v1/||' | \
  sort -u)

echo "$FRONTEND_PATHS"

# 检查前端是否有不使用 /v1/ 前缀的路径（潜在问题）
echo ""
echo "--- 警告: 前端未使用 /v1/ 前缀的路径 ---"
# Extract full API paths and filter those not starting with /v1/
NO_V1_PATHS=$(grep -ohE "api\.(get|post|put|delete|patch)\(['\`]/[a-zA-Z0-9_/.{}:-]+" orion-frontend/src/api/*.ts 2>/dev/null | \
  sed -E "s/api\.[a-z]+\(['\`]//" | \
  sed -E "s|/[:{].*||" | \
  sed 's|/$||' | \
  grep -v "^/v1/" | \
  sed 's|^/||' | \
  grep -v "^v1$" | \
  sort -u)

if [ -z "$NO_V1_PATHS" ]; then
  echo "(无)"
else
  echo "$NO_V1_PATHS"
fi

# ========================================
# 提取后端路由前缀
# ========================================
echo ""
echo "--- 后端路由前缀 ---"

# 1. prefix: '/v1/xxx' -> xxx
PREFIX_PARAMS=$(grep -oE "prefix: '/v1/[a-zA-Z0-9/_-]+" orion-platform-service/src/api/routes.ts | \
  sed "s|prefix: '/v1/||")

# 2. registerWithRoleGuard(app, xxx, '/v1/yyy') -> yyy
ROLE_PREFIXES=$(grep -oE "registerWithRoleGuard\(app, [a-zA-Z]+, '/v1/[a-zA-Z0-9/_-]+" orion-platform-service/src/api/routes.ts | \
  sed "s|.*'/v1/||")

# 3. 硬编码的 app.get/post/put/delete('/v1/resource...') -> resource
#    Match the full path including params like :id, then extract just the first resource segment
HARDCODED_PREFIXES=$(grep -oE "app\.(get|post|put|delete|patch)\('/v1/[a-zA-Z0-9_/:{}-]+" orion-platform-service/src/api/routes.ts | \
  sed "s|app\.[a-z]*('/v1/||" | \
  cut -d'/' -f1 | \
  sort -u)

# 合并去重
BACKEND_PREFIXES=$(printf "%s\n%s\n%s" "$PREFIX_PARAMS" "$ROLE_PREFIXES" "$HARDCODED_PREFIXES" | \
  sort -u | sed '/^$/d')

echo "$BACKEND_PREFIXES"

# ========================================
# 对比
# ========================================
echo ""
echo "--- 前端有但后端没有的路径 (可能导致 404) ---"
FRONT_ONLY=$(comm -23 <(echo "$FRONTEND_PATHS") <(echo "$BACKEND_PREFIXES"))
if [ -z "$FRONT_ONLY" ]; then
  echo "(无)"
else
  echo "$FRONT_ONLY"
fi

echo ""
echo "--- 后端有但前端没有的路径 (可能未使用) ---"
BACK_ONLY=$(comm -13 <(echo "$FRONTEND_PATHS") <(echo "$BACKEND_PREFIXES"))
if [ -z "$BACK_ONLY" ]; then
  echo "(无)"
else
  echo "$BACK_ONLY"
fi

echo ""

# 统计
FRONT_COUNT=$(echo "$FRONTEND_PATHS" | sed '/^$/d' | wc -l | tr -d ' ')
BACK_COUNT=$(echo "$BACKEND_PREFIXES" | sed '/^$/d' | wc -l | tr -d ' ')
FRONT_ONLY_COUNT=$(echo "$FRONT_ONLY" | sed '/^$/d' | wc -l | tr -d ' ')
BACK_ONLY_COUNT=$(echo "$BACK_ONLY" | sed '/^$/d' | wc -l | tr -d ' ')
NO_V1_COUNT=$(echo "$NO_V1_PATHS" | sed '/^$/d' | wc -l | tr -d ' ')

echo "=== 统计 ==="
echo "前端路径数 (含 /v1/): $FRONT_COUNT"
echo "后端路径数: $BACK_COUNT"
echo "仅前端 (可能 404): $FRONT_ONLY_COUNT"
echo "仅后端 (可能未使用): $BACK_ONLY_COUNT"
echo "前端缺失 /v1/: $NO_V1_COUNT"

if [ "$FRONT_ONLY_COUNT" -eq 0 ] && [ "$BACK_ONLY_COUNT" -eq 0 ] && [ "$NO_V1_COUNT" -eq 0 ]; then
  echo ""
  echo "=== 验证通过：所有路径一致 ==="
  exit 0
else
  echo ""
  echo "=== 验证完成：存在不一致 ==="
  exit 1
fi
