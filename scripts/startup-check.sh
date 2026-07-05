#!/usr/bin/env bash
# ============================================================
# Orion 微前端启动环境检查脚本
# 验证所有必要服务是否运行，配置是否正确
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check_port() {
  local port=$1 name=$2
  if lsof -i :"$port" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} $name (:$port)"
    return 0
  else
    echo -e "  ${RED}❌${NC} $name (:$port) — 未运行"
    return 1
  fi
}

check_http() {
  local url=$1 name=$2 expected_status=${3:-200}
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected_status" ] || [ "$status" = "302" ] || [ "$status" = "301" ]; then
    echo -e "  ${GREEN}✅${NC} $name ($url → $status)"
    return 0
  else
    echo -e "  ${RED}❌${NC} $name ($url → $status, 期望 $expected_status)"
    return 1
  fi
}

check_mf_remote() {
  local url=$1 name=$2
  local body
  body=$(curl -s --connect-timeout 3 "$url" 2>/dev/null || echo "")
  if echo "$body" | grep -q "module\|get\|init"; then
    echo -e "  ${GREEN}✅${NC} $name remoteEntry.js 有效 (包含 get/init)"
    return 0
  else
    echo -e "  ${YELLOW}⚠️  ${NC} $name remoteEntry.js 可能无效"
    return 1
  fi
}

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Orion 微前端启动环境检查${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ─── 1. 端口检查 ───
echo -e "${BLUE}[1/5] 服务端口检查${NC}"

check_port 3000  "主应用前端 (Vite)"
check_port 3001  "平台后端"
check_port 5173  "KB 子应用前端 (serve dist-mf)"
check_port 8090  "KB API 后端 (Docker)"
gateway_port=9000
if check_port $gateway_port "API Gateway"; then
  GATEWAY_RUNNING=true
else
  GATEWAY_RUNNING=false
fi

echo ""

# ─── 2. HTTP 健康检查 ───
echo -e "${BLUE}[2/5] HTTP 健康检查${NC}"

check_http "http://localhost:3000" "主应用前端" && ((PASS++)) || ((FAIL++))
check_http "http://localhost:3001/healthz" "平台后端" && ((PASS++)) || ((FAIL++))
check_http "http://localhost:$gateway_port/healthz" "API Gateway" && ((PASS++)) || ((FAIL++))
check_http "http://localhost:8090/api/v1/health" "KB API" && ((PASS++)) || ((FAIL++))

echo ""

# ─── 3. MF remoteEntry 检查 ───
echo -e "${BLUE}[3/5] 子应用 remoteEntry 检查${NC}"

check_mf_remote "http://localhost:5173/remoteEntry.js" "KB 子应用" && ((PASS++)) || ((WARN++))

echo ""

# ─── 4. Vite 代理配置检查 ───
echo -e "${BLUE}[4/5] 代理配置检查${NC}"

VITE_CONFIG="/Users/heal/orion-design/orion-frontend/vite.config.ts"
if grep -q "PANDAWIKI_API.*9000" "$VITE_CONFIG" 2>/dev/null; then
  echo -e "  ${GREEN}✅${NC} Vite 代理目标指向 Gateway (:9000)"
  ((PASS++))
else
  echo -e "  ${RED}❌${NC} Vite 代理目标不是 Gateway (:9000) — KB API 将返回 401"
  ((FAIL++))
fi

echo ""

# ─── 5. 子应用 Store 配置 ───
echo -e "${BLUE}[5/5] 子应用配置获取${NC}"

CONFIG_URL="http://localhost:3000/api/v1/subapps"
CONFIG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$CONFIG_URL" 2>/dev/null || echo "000")
if [ "$CONFIG_STATUS" != "000" ]; then
  echo -e "  ${GREEN}✅${NC} 子应用配置 API 可达 ($CONFIG_URL → $CONFIG_STATUS)"
  ((PASS++))
else
  echo -e "  ${YELLOW}⚠️  ${NC} 子应用配置 API 不可达（平台后端或 Gateway 未运行）"
  ((WARN++))
fi

echo ""

# ─── 汇总 ───
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  检查结果${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "  ${GREEN}通过${NC}: $PASS  ${RED}失败${NC}: $FAIL  ${YELLOW}警告${NC}: $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ 环境存在问题，请先修复后再启动。${NC}"
  echo "   参考: docs/runbook/micro-frontend-startup.md"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  环境基本就绪，有 $WARN 项需注意。${NC}"
else
  echo -e "${GREEN}✅ 环境就绪，可以启动。${NC}"
fi
echo ""
