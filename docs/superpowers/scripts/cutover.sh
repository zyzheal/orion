#!/bin/bash
# cutover.sh — Phase 2 切流执行脚本
# 用法: ./cutover.sh [migrate|rollback|status]
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GATEWAY_CONFIG="$PROJECT_ROOT/orion-api-gateway/src/config/index.ts"
GO_SVC_DIR="$PROJECT_ROOT/orion-platform-svc-go"
TS_SVC_DIR="$PROJECT_ROOT/orion-platform-service"

TS_PORT="${TS_PORT:-3001}"
GO_PORT="${GO_PORT:-8080}"

cmd_status() {
    echo "=== 切流状态 ==="
    echo -n "TS 服务 (:$TS_PORT): "
    curl -sf "http://localhost:${TS_PORT}/healthz" >/dev/null 2>&1 && echo "RUNNING" || echo "STOPPED"
    echo -n "Go 服务 (:$GO_PORT): "
    curl -sf "http://localhost:${GO_PORT}/healthz" >/dev/null 2>&1 && echo "RUNNING" || echo "STOPPED"
    echo -n "Gateway 当前路由: "
    grep -o "localhost:[0-9]*" "$GATEWAY_CONFIG" 2>/dev/null | head -3 || echo "UNKNOWN"
}

cmd_migrate() {
    echo "=== 执行切流: TS → Go ==="
    
    echo "[1/5] 验证 Go 服务..."
    if ! curl -sf "http://localhost:${GO_PORT}/healthz" >/dev/null 2>&1; then
        echo "ERROR: Go 服务未运行在 :${GO_PORT}"
        echo "请先启动: cd $GO_SVC_DIR && go run ./cmd/server"
        exit 1
    fi
    echo "  Go 服务健康检查通过"
    
    echo "[2/5] 验证 Go 核心端点..."
    for ep in /api/v1/chaos/experiments /api/v1/inception/records /api/v1/monitoring/alerts; do
        code=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:${GO_PORT}${ep}" 2>/dev/null || echo "000")
        if [ "$code" != "200" ]; then
            echo "  WARNING: $ep returned $code"
        fi
    done
    
    echo "[3/5] 切换 Gateway 路由..."
    cp "$GATEWAY_CONFIG" "${GATEWAY_CONFIG}.bak.$(date +%s)"
    sed -i '' "s/localhost:${TS_PORT}/localhost:${GO_PORT}/g" "$GATEWAY_CONFIG"
    echo "  Gateway 配置已更新 (备份: ${GATEWAY_CONFIG}.bak.*)"
    
    echo "[4/5] 请手动重启 Gateway (npm run start)"
    
    echo "[5/5] TS 服务 (:$TS_PORT) 将在确认后停止"
    echo "  执行: pkill -f \"orion-platform-service\""
    
    echo "=== 切流完成 ==="
}

cmd_rollback() {
    echo "=== 执行回滚: Go → TS ==="
    
    echo "[1/4] 切换 Gateway 路由回 TS..."
    cp "$GATEWAY_CONFIG" "${GATEWAY_CONFIG}.bak.$(date +%s)"
    sed -i '' "s/localhost:${GO_PORT}/localhost:${TS_PORT}/g" "$GATEWAY_CONFIG"
    echo "  Gateway 配置已回滚"
    
    echo "[2/4] 请手动重启 Gateway"
    echo "[3/4] 请手动启动 TS 服务: cd $TS_SVC_DIR && npm run start"
    echo "[4/4] 请手动停止 Go 服务: pkill -f orion-platform-svc"
    
    echo "=== 回滚完成 ==="
}

case "${1:-status}" in
    status)   cmd_status   ;;
    migrate)  cmd_migrate  ;;
    rollback) cmd_rollback ;;
    *)
        echo "用法: $0 [status|migrate|rollback]"
        exit 1
        ;;
esac
