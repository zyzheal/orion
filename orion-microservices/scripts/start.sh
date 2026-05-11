#!/usr/bin/env bash
# ==========================================
# Orion Microservices - 启动脚本
# ==========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "[WARN] .env file not found, copying from .env.example"
    cp .env.example .env
fi

echo "=== Orion Microservices ==="
echo "Starting all services..."

# 启动基础设施 + 应用服务
docker compose up -d

echo ""
echo "Waiting for services to become healthy..."
sleep 5

# 等待健康检查
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    UNHEALTHY=$(docker compose ps --format json 2>/dev/null | grep -c '"unhealthy"' || true)
    if [ "$UNHEALTHY" -eq 0 ]; then
        echo ""
        echo "=== All services are running ==="
        docker compose ps
        exit 0
    fi
    RETRY=$((RETRY + 1))
    echo -n "."
    sleep 2
done

echo ""
echo "=== Warning: Some services may still be starting ==="
docker compose ps
