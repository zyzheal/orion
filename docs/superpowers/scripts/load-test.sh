#!/bin/bash
# load-test.sh — Go 平台服务全量压测脚本
# 用法: ./load-test.sh [--duration SECONDS] [--concurrency N] [--target URL]
set -euo pipefail

# 默认配置
DURATION="${DURATION:-30}"
CONCURRENCY="${CONCURRENCY:-100}"
TARGET="${TARGET:-http://localhost:8080}"
REPORT_DIR="${REPORT_DIR:-/tmp/orion-load-test-$(date +%Y%m%d-%H%M%S)}"
RESULTS_FILE="$REPORT_DIR/results.json"

echo "============================================"
echo "  Orion Go 平台 — 全量压测"
echo "============================================"
echo ""
echo "  目标:      $TARGET"
echo "  持续时间:  ${DURATION}s"
echo "  并发数:    $CONCURRENCY"
echo "  报告目录:  $REPORT_DIR"
echo ""

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 检查服务健康状态
echo "[1/4] 健康检查..."
HEALTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$TARGET/healthz" 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" != "200" ]; then
    echo "  ❌ 服务未就绪 (healthz 返回 $HEALTH_CODE)"
    echo "  请先启动 Go 平台服务:"
    echo "    cd orion-platform-svc-go && go run ./cmd/server"
    exit 1
fi
echo "  ✅ 服务就绪 (healthz: $HEALTH_CODE)"
echo ""

# 检查依赖
echo "[2/4] 依赖检查..."
HEALTH_DEP=$(curl -sf "$TARGET/health" 2>/dev/null || echo "")
if [ -z "$HEALTH_DEP" ]; then
    echo "  ⚠️  /health 端点不可用，跳过依赖检查"
else
    echo "  健康检查响应:"
    echo "$HEALTH_DEP" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'    {k}: {v}') for k,v in d.items()]"
fi
echo ""

# 定义压测端点 (核心模块端点)
echo "[3/4] 执行压测..."
echo ""

# 核心端点列表
ENDPOINTS=(
    "GET /healthz"
    "GET /api/v1/chaos/experiments"
    "GET /api/v1/monitoring/alerts"
    "GET /api/v1/inception/records"
    "GET /api/v1/config"
    "GET /api/v1/tenant/quotas"
)

# 使用 ab 进行压测
for ep in "${ENDPOINTS[@]}"; do
    method="${ep%% *}"
    path="${ep#* }"
    url="$TARGET$path"
    request_count=$((CONCURRENCY * DURATION / 2))

    echo "  压测: $url"

    # 使用 ab 进行压测
    if ab -n "$request_count" -c "$CONCURRENCY" -q "$url" > "$REPORT_DIR/ab-$(echo $path | tr '/' '-').txt" 2>/dev/null; then
        # 解析 ab 结果
        result=$(ab -n "$request_count" -c "$CONCURRENCY" -q "$url" 2>/dev/null)
        p50=$(echo "$result" | grep "50%" | awk '{print $1}' | tr -d ',' | awk '{printf "%.3f", $1}')
        p95=$(echo "$result" | grep "95%" | awk '{print $1}' | tr -d ',' | awk '{printf "%.3f", $1}')
        p99=$(echo "$result" | grep "99%" | awk '{print $1}' | tr -d ',' | awk '{printf "%.3f", $1}')
        rps=$(echo "$result" | grep "Requests per second" | awk '{print $4}')

        echo "    RPS: $rps"
        echo "    P50: ${p50}s | P95: ${p95}s | P99: ${p99}s"
        echo ""
    else
        echo "    ⚠️  ab 压测失败"
        echo ""
    fi
done

# 生成报告
echo "[4/4] 生成报告..."

cat > "$RESULTS_FILE" << REPORT
{
  "target": "$TARGET",
  "duration_s": $DURATION,
  "concurrency": $CONCURRENCY,
  "timestamp": "$(date -Iseconds)",
  "endpoints": [
REPORT

for ep in "${ENDPOINTS[@]}"; do
    path="${ep#* }"
    filename="ab-$(echo $path | tr '/' '-').txt"

    if [ -f "$REPORT_DIR/$filename" ]; then
        p50=$(grep "50%" "$REPORT_DIR/$filename" | awk '{print $1}' | tr -d ',')
        p95=$(grep "95%" "$REPORT_DIR/$filename" | awk '{print $1}' | tr -d ',')
        p99=$(grep "99%" "$REPORT_DIR/$filename" | awk '{print $1}' | tr -d ',')
        rps=$(grep "Requests per second" "$REPORT_DIR/$filename" | awk '{print $4}')

        cat >> "$RESULTS_FILE" << EP
    {
      "path": "$path",
      "requests_per_second": $rps,
      "latency_p50": $p50,
      "latency_p95": $p95,
      "latency_p99": $p99
    },
EP
    fi
done

# 修复 JSON
sed -i '' '$ s/,$//' "$RESULTS_FILE"
echo "  ]" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

echo ""
echo "============================================"
echo "  压测完成"
echo "============================================"
echo ""
echo "  报告文件: $RESULTS_FILE"
echo "  详细日志: $REPORT_DIR/"
echo ""
echo "  TS 性能基线对比:"
echo "  /healthz:     TS P95=0.00433s"
echo "  /chaos:       TS P95=0.00262s"
echo "  /inception:   TS P95=0.00153s"
echo "  /monitoring:  TS P95=0.00150s"
echo ""
echo "  Go 服务 P95 应 < TS P95 × 2"
echo ""
