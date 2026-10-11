#!/usr/bin/env bash
# adr-lint.sh — ADR 状态规范化检查 (ADR-017 Phase 3)
#
# 功能:
#   1. 扫描 docs/adr/ADR-*.md 所有 ADR 文件
#   2. 检查每个 ADR 是否有"状态"字段 (| 状态 |)
#   3. 检查状态值是否为已知值 (已接受/已拒绝/已废弃/草案/待定)
#   4. 报告缺失或异常状态的 ADR
#   5. 支持阈值检查 (--min-percent)
#
# 用法:
#   ./scripts/adr-lint.sh                          # 报告模式
#   ./scripts/adr-lint.sh --min-percent 100        # 强制 100% 覆盖率
#   ./scripts/adr-lint.sh --json                   # JSON 输出
#
# 退出码:
#   0 — 所有 ADR 状态正常 (或达到阈值)
#   1 — 有 ADR 状态异常 (未达阈值)
#   2 — 脚本错误

set -euo pipefail

# --- Configuration ---
ADR_DIR="${ADR_DIR:-docs/adr}"
MIN_PERCENT=0
JSON_OUTPUT=false
VERBOSE=false

# Known valid status values (normalized)
# Includes common variants found in existing ADRs
declare -A VALID_STATUSES=(
    ["已接受"]=1
    ["已接受（Accepted）"]=1
    ["已批准"]=1
    ["已拒绝"]=1
    ["已废弃"]=1
    ["草案"]=1
    ["待定"]=1
    ["accepted"]=1
    ["rejected"]=1
    ["deprecated"]=1
    ["draft"]=1
    ["pending"]=1
    ["proposed"]=1
)

# --- Usage ---
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --min-percent N    Minimum status coverage percentage (default: 0)"
    echo "  --json             Output as JSON"
    echo "  --verbose          Verbose output"
    echo "  --help             Show this help"
    echo ""
    echo "Exit codes:"
    echo "  0 — All ADRs have valid status (or threshold met)"
    echo "  1 — Some ADRs have missing/invalid status"
    echo "  2 — Script error"
    exit 0
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --min-percent)
            MIN_PERCENT="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 2
            ;;
    esac
done

# --- Validation ---
if ! [[ "$MIN_PERCENT" =~ ^[0-9]+$ ]]; then
    echo "ERROR: --min-percent must be a number" >&2
    exit 2
fi

if [[ "$MIN_PERCENT" -lt 0 || "$MIN_PERCENT" -gt 100 ]]; then
    echo "ERROR: --min-percent must be between 0 and 100" >&2
    exit 2
fi

# --- Scan ADRs ---
total=0
valid=0
invalid=0
missing_status=()
invalid_status=()

for adr_file in "$ADR_DIR"/ADR-*.md; do
    [[ -e "$adr_file" ]] || continue
    total=$((total + 1))
    filename=$(basename "$adr_file")
    
    # Check for status field
    status_line=$(grep -E '^\|.*状态.*\|' "$adr_file" 2>/dev/null | head -1 || true)
    
    if [[ -z "$status_line" ]]; then
        missing_status+=("$filename")
        invalid=$((invalid + 1))
        continue
    fi
    
    # Extract status value (after the second |)
    status_value=$(echo "$status_line" | awk -F'|' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Check if status is known
    if [[ -n "${VALID_STATUSES[$status_value]+x}" ]]; then
        valid=$((valid + 1))
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✓ $filename: $status_value"
        fi
    else
        invalid_status+=("$filename ($status_value)")
        invalid=$((invalid + 1))
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✗ $filename: unknown status '$status_value'"
        fi
    fi
done

# --- Calculate coverage ---
if [[ $total -eq 0 ]]; then
    echo "No ADR files found in $ADR_DIR" >&2
    exit 2
fi

coverage=$((valid * 100 / total))

# --- Output ---
if [[ "$JSON_OUTPUT" == true ]]; then
    cat <<EOF
{
  "total": $total,
  "valid": $valid,
  "invalid": $invalid,
  "coverage": $coverage,
  "min_percent": $MIN_PERCENT,
  "passed": $([ $coverage -ge $MIN_PERCENT ] && echo true || echo false),
  "missing_status": $(printf '%s\n' "${missing_status[@]}" | jq -R . | jq -s .),
  "invalid_status": $(printf '%s\n' "${invalid_status[@]}" | jq -R . | jq -s .)
}
EOF
else
    echo "=== ADR Status Lint Report ==="
    echo ""
    echo "Directory: $ADR_DIR"
    echo "Total ADRs: $total"
    echo "Valid status: $valid ($coverage%)"
    echo "Invalid/missing: $invalid"
    echo "Threshold: $MIN_PERCENT%"
    echo ""
    
    if [[ ${#missing_status[@]} -gt 0 ]]; then
        echo "--- Missing Status (${#missing_status[@]}) ---"
        for f in "${missing_status[@]}"; do
            echo "  ✗ $f"
        done
        echo ""
    fi
    
    if [[ ${#invalid_status[@]} -gt 0 ]]; then
        echo "--- Invalid Status (${#invalid_status[@]}) ---"
        for f in "${invalid_status[@]}"; do
            echo "  ✗ $f"
        done
        echo ""
    fi
    
    if [[ $coverage -ge $MIN_PERCENT ]]; then
        echo "✓ PASS: Coverage $coverage% >= threshold $MIN_PERCENT%"
        exit 0
    else
        echo "✗ FAIL: Coverage $coverage% < threshold $MIN_PERCENT%"
        exit 1
    fi
fi
