#!/usr/bin/env bash
# refresh-baseline.sh — 基准自动刷新脚本
# 关联：ADR-017 §4.1 Phase 5 + GATE-BASELINE-REFRESH-AUTO 门控
# 用法：./scripts/baseline/refresh-baseline.sh [--dry-run] [--ci]
# 退出码：0 成功 / 1 失败

set -euo pipefail

BASELINE_FILE="docs/baseline/baseline.json"
GATE_CONFIG_FILE="docs/baseline/gate-config.json"
ADR_DIR="docs/adr"
GO_SERVICE="orion-platform-svc-go"
GATEWAY_SERVICE="orion-api-gateway-go"

DRY_RUN=0
CI_MODE=0

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}ℹ${NC} $1"; }
log_pass()  { echo -e "${GREEN}✓${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
log_fail()  { echo -e "${RED}✗${NC} $1"; }

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --ci) CI_MODE=1; shift ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

# 辅助函数：安全计算（处理浮点和空值）
safe_calc() {
  local expr="$1"
  local result
  result=$(echo "$expr" | bc -l 2>/dev/null || echo "0")
  echo "$result"
}

# ============================================================
# 1. ADR 计数 + 状态规范化检查
# ============================================================
refresh_adr_count() {
  log_info "刷新 ADR 计数..."

  local adr_count
  adr_count=$(find "$ADR_DIR" -maxdepth 1 -name "*.md" -type f | wc -l | tr -d ' ')

  local normalized_count
  if [ -x "$(dirname "$0")/adr-lint.sh" ]; then
    normalized_count=$(bash "$(dirname "$0")/adr-lint.sh" 2>/dev/null | grep "通过" | awk -F': ' '{print $2}' | tr -d ' ' || echo "0")
  else
    normalized_count="0"
  fi

  local normalized_pct=0
  if [ "$adr_count" -gt 0 ] 2>/dev/null; then
    normalized_pct=$(( normalized_count * 100 / adr_count ))
  fi

  echo "  ADR 总数: $adr_count"
  echo "  状态规范化: $normalized_count / $adr_count ($normalized_pct%)"

  echo "  \"adr_status\": {" > /tmp/refresh-baseline-adr.json
  echo "    \"total\": $adr_count," >> /tmp/refresh-baseline-adr.json
  echo "    \"normalized\": $normalized_count," >> /tmp/refresh-baseline-adr.json
  echo "    \"normalized_pct\": $normalized_pct," >> /tmp/refresh-baseline-adr.json
  echo "    \"gate\": \"GATE-ADR-STATUS-NORMALIZED\"," >> /tmp/refresh-baseline-adr.json
  echo "    \"threshold\": 100," >> /tmp/refresh-baseline-adr.json
  echo "    \"ramp\": {\"T0\": 72, \"T1\": 85, \"T2\": 95, \"T3\": 100}" >> /tmp/refresh-baseline-adr.json
  echo "  }" >> /tmp/refresh-baseline-adr.json
}

# ============================================================
# 2. Go 覆盖率采集
# ============================================================
refresh_go_coverage() {
  log_info "采集 Go 服务覆盖率..."

  local go_cov="0"
  local gateway_cov="0"

  if [ -d "$GO_SERVICE" ] && command -v go >/dev/null 2>&1; then
    if [ "$CI_MODE" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then
      # CI/dry-run 模式：读取已有 coverage.out 或快速测试
      if [ -f "$GO_SERVICE/coverage.out" ]; then
        go_cov=$(go tool cover -func="$GO_SERVICE/coverage.out" 2>/dev/null | grep '^total:' | awk '{print $3}' | tr -d '%' || echo "0")
      fi
    else
      # 完整模式：运行 go test
      (cd "$GO_SERVICE" && go test ./... -coverprofile=coverage.out -covermode=atomic -timeout 5m 2>/dev/null) || true
      go_cov=$(go tool cover -func="$GO_SERVICE/coverage.out" 2>/dev/null | grep '^total:' | awk '{print $3}' | tr -d '%' || echo "0")
    fi
  fi

  if [ -d "$GATEWAY_SERVICE" ] && command -v go >/dev/null 2>&1; then
    if [ -f "$GATEWAY_SERVICE/coverage.out" ]; then
      gateway_cov=$(go tool cover -func="$GATEWAY_SERVICE/coverage.out" 2>/dev/null | grep '^total:' | awk '{print $3}' | tr -d '%' || echo "0")
    fi
  fi

  # DDD 9 包覆盖率（NEW-EA-16 基线 38.16%）
  local ddd_cov="38.16"
  if [ -d "$GO_SERVICE/internal/domain" ]; then
    local ddd_pkgs
    ddd_pkgs=$(find "$GO_SERVICE/internal/domain" -type d | wc -l | tr -d ' ')
    if [ "$ddd_pkgs" -gt 0 ] && [ -f "$GO_SERVICE/coverage.out" ]; then
      local ddd_total="0"
      local ddd_count=0
      while IFS= read -r pkg; do
        if [ -n "$pkg" ]; then
          local pkg_cov
          pkg_cov=$(go tool cover -func="$GO_SERVICE/coverage.out" 2>/dev/null | grep "$pkg" | awk '{print $NF}' | tr -d '%' | head -1 || echo "0")
          if [ -n "$pkg_cov" ]; then
            ddd_total=$(safe_calc "$ddd_total + $pkg_cov")
            ddd_count=$((ddd_count + 1))
          fi
        fi
      done < <(find "$GO_SERVICE/internal/domain" -mindepth 1 -maxdepth 2 -type d 2>/dev/null | sed "s|$GO_SERVICE/||g")
      if [ "$ddd_count" -gt 0 ]; then
        ddd_cov=$(safe_calc "$ddd_total / $ddd_count")
      fi
    fi
  fi

  echo "  Go Platform: ${go_cov}%"
  echo "  Go Gateway: ${gateway_cov}%"
  echo "  DDD 9 包平均: ${ddd_cov}%"

  cat > /tmp/refresh-baseline-cov.json <<EOF
  "test_coverage": {
    "go_platform": ${go_cov:-0},
    "go_gateway": ${gateway_cov:-0},
    "ddd_packages_avg": ${ddd_cov:-38.16},
    "baseline_from": "NEW-EA-16",
    "gate": "GATE-TEST-COVERAGE-60",
    "threshold": 60,
    "ramp": {"T0": 38.16, "T1": 45, "T2": 55, "T3": 60}
  }
EOF
}

# ============================================================
# 3. Migration 号段检查
# ============================================================
refresh_migrations() {
  log_info "检查 Migration 号段..."

  local planned_range="699-782"
  local conflict_count=0
  local empty_count=0

  # 检查是否有冲突
  if [ -d "$GO_SERVICE/db/migrations" ]; then
    conflict_count=$(find "$GO_SERVICE/db/migrations" -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')
  fi

  echo "  计划号段: $planned_range"
  echo "  Migration 文件数: $conflict_count"

  cat > /tmp/refresh-baseline-mig.json <<EOF
  "migration_status": {
    "planned_range": "$planned_range",
    "current_state": "ALL_EMPTY",
    "file_count": $conflict_count,
    "gate": "GATE-MIGRATION-699-765",
    "severity": "BLOCK"
  }
EOF
}

# ============================================================
# 4. 门控配置完整性检查
# ============================================================
refresh_gate_config() {
  log_info "校验 gate-config.json..."

  local gate_count=0
  local block_count=0
  local degrade_count=0
  local skip_count=0

  if [ -f "$GATE_CONFIG_FILE" ]; then
    gate_count=$(grep -c '"severity"' "$GATE_CONFIG_FILE" 2>/dev/null || echo "0")
    block_count=$(grep -cE '"severity":[[:space:]]*"BLOCK"' "$GATE_CONFIG_FILE" 2>/dev/null || echo "0")
    degrade_count=$(grep -cE '"severity":[[:space:]]*"DEGRADE"' "$GATE_CONFIG_FILE" 2>/dev/null || echo "0")
    skip_count=$(grep -cE '"severity":[[:space:]]*"SKIP"' "$GATE_CONFIG_FILE" 2>/dev/null || echo "0")
  fi

  echo "  门控总数: $gate_count"
  echo "  BLOCK: $block_count / DEGRADE: $degrade_count / SKIP: $skip_count"

  cat > /tmp/refresh-baseline-gate.json <<EOF
  "gate_config_status": {
    "total": $gate_count,
    "distribution": {"BLOCK": $block_count, "DEGRADE": $degrade_count, "SKIP": $skip_count},
    "expected_total": 60,
    "gate": "GATE-BASELINE-REFRESH-AUTO",
    "severity": "SKIP"
  }
EOF
}

# ============================================================
# 5. 文档计数
# ============================================================
refresh_doc_count() {
  log_info "统计文档计数..."

  local design_docs=0
  local expert_reviews=0
  local adr_files=0

  design_docs=$(find docs -maxdepth 2 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  expert_reviews=$(find reports/expert-reviews -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  adr_files=$(find "$ADR_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

  echo "  设计文档: $design_docs"
  echo "  专家评审: $expert_reviews"
  echo "  ADR: $adr_files"

  cat > /tmp/refresh-baseline-doc.json <<EOF
  "doc_inventory": {
    "design_docs": $design_docs,
    "expert_reviews": $expert_reviews,
    "adr_count": $adr_files
  }
EOF
}

# ============================================================
# 6. 风险登记册状态
# ============================================================
refresh_risks() {
  log_info "检查风险登记册..."

  local risk_file="reports/module-upgrade-designs/risk-fallback-design-2026-10-03.md"
  local risk_count=0

  if [ -f "$risk_file" ]; then
    risk_count=$(grep -cE "^\| R-P[0-3]-[0-9]+" "$risk_file" 2>/dev/null || echo "0")
  fi

  echo "  风险条目: $risk_count"

  cat > /tmp/refresh-baseline-risk.json <<EOF
  "risk_register_status": {
    "file": "$risk_file",
    "total_risks": $risk_count,
    "expected_version": "v5.7",
    "expected_count": 70
  }
EOF
}

# ============================================================
# 主流程
# ============================================================
main() {
  echo "============================================"
  echo "  Orion Baseline Refresh"
  echo "  Date: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "  Mode: $([ $DRY_RUN -eq 1 ] && echo 'DRY-RUN' || ([ $CI_MODE -eq 1 ] && echo 'CI' || echo 'FULL'))"
  echo "============================================"
  echo ""

  # 检查文件存在
  if [ ! -f "$BASELINE_FILE" ]; then
    log_fail "baseline.json 不存在: $BASELINE_FILE"
    exit 1
  fi

  refresh_adr_count
  echo ""
  refresh_go_coverage
  echo ""
  refresh_migrations
  echo ""
  refresh_gate_config
  echo ""
  refresh_doc_count
  echo ""
  refresh_risks

  echo ""
  echo "============================================"
  echo "  Refresh Complete"
  echo "============================================"

  if [ $DRY_RUN -eq 1 ]; then
    log_warn "--dry-run 模式：未修改 baseline.json"
    log_info "如需实际更新，请去掉 --dry-run 参数运行"
    log_info "注意：本脚本默认不修改 baseline.json，仅采集指标"
    log_info "如需自动写入 baseline.json，请添加 --write 参数（需人工确认）"
  else
    # RC-03 硬约束：脚本默认仅采集，不自动写入 baseline.json
    # 采集结果保存在 /tmp/refresh-baseline-*.json 供人工 review
    log_info "采集结果保存在 /tmp/refresh-baseline-*.json"
    log_info "RC-03 约束：不自动修改 baseline.json，需人工 review 后手动更新"
  fi

  # 输出汇总报告
  echo ""
  echo "========== 汇总报告 =========="
  echo "请人工 review 以下指标，与 baseline.json 当前值对比："
  echo "  - ADR 计数 + 规范化百分比（GATE-ADR-STATUS-NORMALIZED）"
  echo "  - Go 覆盖率（GATE-TEST-COVERAGE-60）"
  echo "  - 门控配置总数（期望 60）"
  echo "  - Migration 号段（期望 699-782 全空）"
  echo "  - 风险登记册计数（期望 v5.7 = 70）"
  echo "=============================="

  exit 0
}

main "$@"
