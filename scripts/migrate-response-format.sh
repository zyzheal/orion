#!/bin/bash
# =============================================================================
# 后端响应格式统一迁移脚本
#
# 将 handler 中直接使用 gin.H{...} 的响应替换为统一的 RespondSuccess 等
# 运行：bash scripts/migrate-response-format.sh
#
# 注意：此脚本会自动化大部分替换，但每个文件仍需人工审核
# =============================================================================

set -euo pipefail

echo "🔍 后端响应格式统一迁移"
echo "========================"
echo ""

BASE="/Users/heal/orion-design/orion-platform-svc-go/internal"

# 统计当前状态
echo "当前使用统计:"
USING_RESPOND=$(grep -rl "RespondSuccess\|RespondError\|RespondPaginated\|RespondBadRequest\|RespondNotFound\|RespondInternalError" "$BASE"/*/handler/handler.go 2>/dev/null | wc -l)
USING_GIN_H=$(grep -rl "gin.H{" "$BASE"/*/handler/handler.go 2>/dev/null | wc -l)
echo "  使用 RespondSuccess 的 handler: $USING_RESPOND"
echo "  使用 gin.H 的 handler: $USING_GIN_H"
echo ""

# 对每个文件执行替换
echo "开始替换..."
echo ""

TOTAL_FILES=0
TOTAL_REPLACEMENTS=0

for handler_file in "$BASE"/*/handler/handler.go; do
  if [ ! -f "$handler_file" ]; then continue; fi
  
  MODULE=$(echo "$handler_file" | sed 's|.*/internal/||' | sed 's|/.*||')
  ORIGINAL=$(cat "$handler_file")
  CONTENT="$ORIGINAL"
  REPLACEMENTS=0
  
  # 替换模式1: c.JSON(500, gin.H{"error": err.Error()}) → RespondInternalError
  NEW=$(echo "$CONTENT" | perl -0777 -pe '
    # c.JSON(4xx, gin.H{...}) → RespondXxx
    s/c\.JSON\((\d+),\s*gin\.H\s*\{[^}]*"error"\s*:\s*([^}]+)\}\s*\)/middleware.RespondError(c, "", $2, $1)/g;
  ' 2>/dev/null || echo "$CONTENT")
  if [ "$NEW" != "$CONTENT" ]; then
    REPLACEMENTS=$((REPLACEMENTS + 1))
    CONTENT="$NEW"
  fi
  
  # 替换模式2: c.JSON(404, gin.H{...}) → RespondNotFound
  NEW=$(echo "$CONTENT" | sed 's/c\.JSON(404,\s*gin\.H{[^}]*"message"[^}]*})/middleware\.RespondNotFound(c, "资源不存在")/g' 2>/dev/null || echo "$CONTENT")
  if [ "$NEW" != "$CONTENT" ]; then
    REPLACEMENTS=$((REPLACEMENTS + 1))
    CONTENT="$NEW"
  fi
  
  # 替换模式3: c.JSON(200, gin.H{"data": items, "total": total}) → RespondPaginated
  NEW=$(echo "$CONTENT" | perl -0777 -pe '
    s/c\.JSON\(200,\s*gin\.H\s*\{[^}]*"data"\s*:\s*(\w+)[^}]*"total"\s*:\s*(\w+)[^}]*\}\s*\)/middleware.RespondPaginated(c, $1, 0, 20, $2)/g;
  ' 2>/dev/null || echo "$CONTENT")
  if [ "$NEW" != "$CONTENT" ]; then
    REPLACEMENTS=$((REPLACEMENTS + 1))
    CONTENT="$NEW"
  fi
  
  # 替换模式4: c.JSON(200, gin.H{"data": items}) → RespondSuccess
  NEW=$(echo "$CONTENT" | perl -0777 -pe '
    s/c\.JSON\(200,\s*gin\.H\s*\{[^}]*"data"\s*:\s*(\w+)[^}]*\}\s*\)/middleware.RespondSuccess(c, $1)/g;
  ' 2>/dev/null || echo "$CONTENT")
  if [ "$NEW" != "$CONTENT" ]; then
    REPLACEMENTS=$((REPLACEMENTS + 1))
    CONTENT="$NEW"
  fi
  
  # 替换模式5: c.JSON(200, gin.H{"message": "xxx"}) → RespondSuccess
  NEW=$(echo "$CONTENT" | sed 's/c\.JSON(200,\s*gin\.H{\s*"message"\s*:\s*\([^}]*\)}\s*)/middleware\.RespondSuccess(c, gin.H{"message": \1})/g' 2>/dev/null || echo "$CONTENT")
  if [ "$NEW" != "$CONTENT" ]; then
    REPLACEMENTS=$((REPLACEMENTS + 1))
    CONTENT="$NEW"
  fi
  
  # 替换模式6: c.JSON(200, gin.H{...}) → RespondSuccess (通用兜底)
  NEW=$(echo "$CONTENT" | sed 's/c\.JSON(200,[[:space:]]*gin\.H{/middleware\.RespondSuccess(c, gin.H{/g' 2>/dev/null || echo "$CONTENT")
  if [ "$NEW" != "$CONTENT" ]; then
    REPLACEMENTS=$((REPLACEMENTS + 1))
    CONTENT="$NEW"
  fi
  
  # 如果有替换，写回文件
  if [ "$REPLACEMENTS" -gt 0 ]; then
    echo "$CONTENT" > "$handler_file"
    TOTAL_FILES=$((TOTAL_FILES + 1))
    TOTAL_REPLACEMENTS=$((TOTAL_REPLACEMENTS + REPLACEMENTS))
    echo "  ✅ $MODULE: $REPLACEMENTS 处替换"
  fi
done

echo ""
echo "📊 迁移统计:"
echo "  修改文件: $TOTAL_FILES"
echo "  总替换数: $TOTAL_REPLACEMENTS"
echo ""

# 验证
echo "验证:"
REMAINING_GIN_H=$(grep -rl "gin.H{" "$BASE"/*/handler/handler.go 2>/dev/null | wc -l)
echo "  剩余使用 gin.H 的 handler: $REMAINING_GIN_H（需人工处理）"
echo ""
echo "⚠️  注意："
echo "  1. 自动化替换可能不完美，请逐个文件审核"
echo "  2. 运行 'go build ./...' 验证编译"
echo "  3. 运行 'go test ./...' 验证测试"
echo "  4. 剩余的 gin.H{ 需要人工检查上下文后手动替换"
