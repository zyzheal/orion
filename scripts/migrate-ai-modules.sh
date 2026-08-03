#!/bin/bash
# =============================================================================
# AI 模块命名统一迁移脚本
#
# 将 internal/ai-xxx/ 迁移到 internal/ai/xxx/
# 将 internal/ai/ai{xxx}/ 合并到 internal/ai/{xxx}/
#
# 运行：bash scripts/migrate-ai-modules.sh
# =============================================================================

set -euo pipefail

echo "🔍 AI 模块命名统一迁移"
echo "======================"
echo ""

BASE="/Users/heal/orion-design/orion-platform-svc-go/internal"

# Step 1: 迁移 internal/ai-xxx/ → internal/ai/xxx/
echo "Step 1: 迁移 internal/ai-xxx/ → internal/ai/xxx/"
echo "----------------------------------------------"

AI_MODULES=(
  "ai-agents:agents"
  "ai-cost:cost"
  "ai-decisions:decisions"
  "ai-degradation:degradation"
  "ai-gateway:gateway"
  "ai-inference:inference"
  "ai-models:models"
  "ai-review:review"
  "ai-security:security"
)

for pair in "${AI_MODULES[@]}"; do
  OLD_NAME="${pair%%:*}"
  NEW_NAME="${pair##*:}"
  OLD_PATH="$BASE/$OLD_NAME"
  NEW_PATH="$BASE/ai/$NEW_NAME"

  if [ -d "$OLD_PATH" ]; then
    echo "  📦 $OLD_NAME → ai/$NEW_NAME"
    
    # 如果目标目录已存在，合并内容
    if [ -d "$NEW_PATH" ]; then
      echo "    ⚠️  目标目录已存在，合并中..."
      cp -r "$OLD_PATH"/* "$NEW_PATH/"
      rm -rf "$OLD_PATH"
    else
      git mv "$OLD_PATH" "$NEW_PATH" 2>/dev/null || mv "$OLD_PATH" "$NEW_PATH"
    fi
    
    # 更新包名（如果目录名不等于包名）
    PKG_NAME="${NEW_NAME//-/_}"
    for gofile in $(find "$NEW_PATH" -name "*.go"); do
      sed -i '' "s/^package ${OLD_NAME//-/_}/package $PKG_NAME/" "$gofile" 2>/dev/null || true
    done
  else
    echo "  ⏭️  $OLD_NAME — 不存在，跳过"
  fi
done

# Step 2: 合并 internal/ai/ai{xxx}/ → internal/ai/{xxx}/
echo ""
echo "Step 2: 合并 internal/ai/ai{xxx}/ → internal/ai/{xxx}/"
echo "----------------------------------------------------"

AI_DUPS=(
  "aiagent:agents"
  "aicost:cost"
  "aigateway:gateway"
  "aireview:review"
  "aisecurity:security"
)

for pair in "${AI_DUPS[@]}"; do
  OLD_NAME="${pair%%:*}"
  NEW_NAME="${pair##*:}"
  OLD_PATH="$BASE/ai/$OLD_NAME"
  NEW_PATH="$BASE/ai/$NEW_NAME"

  if [ -d "$OLD_PATH" ]; then
    echo "  📦 ai/$OLD_NAME → ai/$NEW_NAME"
    if [ -d "$NEW_PATH" ]; then
      echo "    ⚠️  目标目录已存在，合并中..."
      cp -rn "$OLD_PATH"/* "$NEW_PATH/" 2>/dev/null || true
      rm -rf "$OLD_PATH"
    else
      git mv "$OLD_PATH" "$NEW_PATH" 2>/dev/null || mv "$OLD_PATH" "$NEW_PATH"
    fi
  else
    echo "  ⏭️  ai/$OLD_NAME — 不存在，跳过"
  fi
done

# Step 3: 更新所有 import 路径
echo ""
echo "Step 3: 更新 Go import 路径"
echo "--------------------------"

for pair in "${AI_MODULES[@]}"; do
  OLD_NAME="${pair%%:*}"
  NEW_NAME="${pair##*:}"
  OLD_IMPORT="orion/platform-svc-go/internal/$OLD_NAME"
  NEW_IMPORT="orion/platform-svc-go/internal/ai/$NEW_NAME"
  
  echo "  🔄 $OLD_IMPORT → $NEW_IMPORT"
  find "$BASE" -name "*.go" -exec sed -i '' "s|$OLD_IMPORT|$NEW_IMPORT|g" {} \; 2>/dev/null || true
done

# Step 4: 更新 wiring.go 和 router.go
echo ""
echo "Step 4: 更新 wiring.go 和 router.go"
echo "---------------------------------"

# 找到所有 wiring 文件
for wiring_file in "$BASE/../cmd/server"/*wiring*.go "$BASE/../cmd/server/router.go"; do
  if [ -f "$wiring_file" ]; then
    echo "  📝 更新 $wiring_file"
    # 替换 handler 变量名
    # aiAgentsH → ai_agentsH
    # aiCostH → ai_costH
    # 等
    for pair in "${AI_MODULES[@]}"; do
      OLD_NAME="${pair%%:*}"
      NEW_NAME="${pair##*:}"
      # CamelCase 变量名: ai-agents → aiAgentsH → ai_agentsH
      OLD_VAR="$(echo "$OLD_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1' | sed 's/ //g')H"
      NEW_VAR="ai_${NEW_NAME//-/_}H"
      sed -i '' "s/\b$OLD_VAR\b/$NEW_VAR/g" "$wiring_file" 2>/dev/null || true
    done
  fi
done

# Step 5: 清理重复的路由注册
echo ""
echo "Step 5: 清理重复路由注册"
echo "-----------------------"

ROUTER_FILE="$BASE/../cmd/server/router.go"
if [ -f "$ROUTER_FILE" ]; then
  echo "  🧹 清理 $ROUTER_FILE 中的重复路由注册..."
  # 删除 ai_aiagentH 等重复注册（它们在 ai/ 内部）
  for dup in aiagent aicost aigateway aireview aisecurity; do
    sed -i '' "/if ai_${dup}H != nil/,/^[[:space:]]*}/d" "$ROUTER_FILE" 2>/dev/null || true
  done
fi

echo ""
echo "✅ AI 模块命名统一迁移完成"
echo ""
echo "⚠️  后续步骤："
echo "  1. 运行 'go build ./...' 验证编译"
echo "  2. 运行 'go test ./internal/ai/...' 验证测试"
echo "  3. 检查 wiring.go 中的变量命名是否一致"
echo "  4. 更新前端 API 路径（/ai-agents → /ai/agents）"
