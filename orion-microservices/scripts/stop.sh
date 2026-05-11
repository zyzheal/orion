#!/usr/bin/env bash
# ==========================================
# Orion Microservices - 停止脚本
# ==========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

CLEAN=false
if [ "$1" = "--clean" ]; then
    CLEAN=true
fi

echo "=== Orion Microservices ==="

if [ "$CLEAN" = true ]; then
    echo "Stopping all services and removing volumes..."
    docker compose down -v
    echo "All data has been removed."
else
    echo "Stopping all services..."
    docker compose down
    echo "Services stopped. Data volumes preserved."
fi
