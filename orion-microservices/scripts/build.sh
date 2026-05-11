#!/usr/bin/env bash
# ==========================================
# Orion Microservices - 构建脚本
# ==========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

TAG="${1:-latest}"

echo "=== Orion Microservices - Building Images ==="
echo "Tag: $TAG"
echo ""

# 定义服务列表和构建上下文
declare -A SERVICES=(
    ["orion-platform-core"]="../orion-platform-core"
    ["orion-gateway"]="../orion-api-gateway"
    ["orion-pipeline-svc"]="../orion-pipeline-svc"
    ["orion-deploy-svc"]="../orion-deploy-svc"
    ["orion-ticket-svc"]="../orion-ticket-svc"
    ["orion-monitor-svc"]="../orion-monitor-svc"
    ["orion-intelligence-svc"]="../orion-intelligence-svc"
    ["orion-agent-svc"]="../orion-agent-svc"
    ["orion-knowledge-svc"]="../orion-knowledge-svc"
)

FAILED=()
SUCCESS=()

for SERVICE in "${!SERVICES[@]}"; do
    CONTEXT="${SERVICES[$SERVICE]}"
    IMAGE_NAME="orion/${SERVICE#orion-}:${TAG}"

    echo "Building $SERVICE ($IMAGE_NAME)..."

    if [ -d "$CONTEXT" ]; then
        if docker build -t "$IMAGE_NAME" "$CONTEXT" -f "$CONTEXT/Dockerfile" 2>/dev/null; then
            SUCCESS+=("$SERVICE")
            echo "  [OK] $SERVICE built successfully"
        else
            FAILED+=("$SERVICE")
            echo "  [FAIL] $SERVICE build failed"
        fi
    else
        FAILED+=("$SERVICE")
        echo "  [SKIP] Directory $CONTEXT not found"
    fi
done

echo ""
echo "=== Build Summary ==="
echo "Success: ${#SUCCESS[@]}"
for s in "${SUCCESS[@]}"; do echo "  [OK] $s"; done
echo "Failed: ${#FAILED[@]}"
for f in "${FAILED[@]}"; do echo "  [FAIL] $f"; done

if [ ${#FAILED[@]} -gt 0 ]; then
    exit 1
fi
