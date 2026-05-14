#!/bin/bash

# F206 子应用联调测试脚本
# 用于自动化测试主应用与子应用的集成

set -e

echo "========================================"
echo "F206 子应用联调测试"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "测试 $TOTAL_TESTS: $test_name ... "

    if eval "$test_command" > /tmp/test_result_$TOTAL_TESTS.txt 2>&1; then
        if [ "$expected_result" = "success" ]; then
            echo -e "${GREEN}通过${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}失败${NC} (预期失败但通过了)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        if [ "$expected_result" = "failure" ]; then
            echo -e "${GREEN}通过${NC} (预期失败)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}失败${NC}"
            cat /tmp/test_result_$TOTAL_TESTS.txt
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
}

# 检查 Node.js 版本
echo "1. 环境检查"
echo "----------------------------------------"
NODE_VERSION=$(node -v 2>&1)
echo "Node.js 版本：$NODE_VERSION"

NPM_VERSION=$(npm -v 2>&1)
echo "npm 版本：$NPM_VERSION"

# 检查端口占用
echo ""
echo "2. 端口检查"
echo "----------------------------------------"
check_port() {
    local port=$1
    local name=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "端口 $port ($name) - 已被占用"
        return 0
    else
        echo "端口 $port ($name) - 可用"
        return 1
    fi
}

check_port 5173 "orion-frontend"
check_port 3001 "orion-dba"
check_port 3002 "orion-knowledge"
check_port 3003 "orion-visor"

# 检查依赖安装
echo ""
echo "3. 依赖检查"
echo "----------------------------------------"

# 主应用
if [ -d "orion-frontend/node_modules" ]; then
    echo -e "${GREEN}orion-frontend 依赖已安装${NC}"
else
    echo -e "${YELLOW}orion-frontend 依赖未安装${NC}"
fi

# orion-dba
if [ -d "orion-dba/frontend/node_modules" ]; then
    echo -e "${GREEN}orion-dba 依赖已安装${NC}"
else
    echo -e "${YELLOW}orion-dba 依赖未安装${NC}"
fi

# 服务启动测试
echo ""
echo "4. 服务启动测试"
echo "----------------------------------------"

# 测试主应用构建
echo "测试主应用构建..."
cd orion-frontend
if npm run build > /tmp/frontend_build.log 2>&1; then
    echo -e "${GREEN}主应用构建成功${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}主应用构建失败${NC}"
    cat /tmp/frontend_build.log
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 测试 orion-dba 微前端构建
echo "测试 orion-dba 微前端构建..."
cd ../orion-dba/frontend
if npm run build:mf > /tmp/dba_build.log 2>&1; then
    echo -e "${GREEN}orion-dba 微前端构建成功${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}orion-dba 微前端构建失败${NC}"
    cat /tmp/dba_build.log
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

cd ../..

# 总结
echo ""
echo "========================================"
echo "测试总结"
echo "========================================"
echo "总测试数：$TOTAL_TESTS"
echo -e "通过：${GREEN}$PASSED_TESTS${NC}"
echo -e "失败：${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}所有测试通过!${NC}"
    exit 0
else
    echo -e "${RED}部分测试失败，请检查日志${NC}"
    exit 1
fi
