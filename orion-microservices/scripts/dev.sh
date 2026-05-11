#!/usr/bin/env bash
# ==========================================
# Orion Microservices - 开发模式启动
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

echo "=== Orion Microservices (Development Mode) ==="
echo "Starting infrastructure services..."

# 先只启动基础设施
docker compose up -d postgres redis nats

echo ""
echo "Waiting for infrastructure to be healthy..."
sleep 5

echo ""
echo "Starting application services in development mode..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
