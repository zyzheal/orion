#!/bin/bash
# check-cross-module-imports.sh — CI 依赖检测 (Phase 0.9)
# 禁止跨上下文 import，确保所有 internal/ 模块零耦合
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIOLATIONS=0

echo "=== 跨模块 import 检测 ==="
for d in "$REPO_ROOT"/internal/*/; do
    mod=$(basename "$d")
    imports=$(grep -rh "orion/platform-svc-go/internal/" "$d" --include="*.go" 2>/dev/null \
        | grep -v "internal/$mod/" \
        | grep -v "_test.go" || true)
    if [ -n "$imports" ]; then
        count=$(echo "$imports" | wc -l)
        echo "  ❌ $mod → $count cross-module imports"
        echo "$imports" | head -5
        echo ""
        VIOLATIONS=$((VIOLATIONS + count))
    fi
done

echo "=== 完成 ==="
if [ "$VIOLATIONS" -eq 0 ]; then
    echo "✅ 所有 internal/ 模块零跨模块 import"
    exit 0
else
    echo "❌ 发现 $VIOLATIONS 处跨模块 import，请修复"
    exit 1
fi
