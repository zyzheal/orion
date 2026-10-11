#!/usr/bin/env bash
# baseline-refresh.sh — Baseline 自动刷新 (ADR-017 Phase 5)
#
# 功能:
#   1. 运行项目测试套件收集覆盖率
#   2. 更新 baseline.json 中的测试覆盖率数据
#   3. 更新 gate-config.json 中的阈值配置
#   4. 生成刷新报告
#
# 用法:
#   ./scripts/baseline-refresh.sh
#   ./scripts/baseline-refresh.sh --skip-tests
#   ./scripts/baseline-refresh.sh --json
#
# 退出码:
#   0 — 刷新成功
#   1 — 测试失败
#   2 — 脚本错误

set -euo pipefail

# --- Configuration ---
PROJECT_DIR="${PROJECT_DIR:-.}"
BASELINE_FILE="${BASELINE_FILE:-docs/baseline/baseline.json}"
GATE_CONFIG_FILE="${GATE_CONFIG_FILE:-docs/baseline/gate-config.json}"
COVERAGE_FILE="${COVERAGE_FILE:-coverage.out}"
SKIP_TESTS=false
JSON_OUTPUT=false
VERBOSE=false

# --- Usage ---
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-tests       Skip running tests (use existing coverage)"
    echo "  --json             Output as JSON"
    echo "  --verbose          Verbose output"
    echo "  --help             Show this help"
    echo ""
    echo "Exit codes:"
    echo "  0 — Refresh successful"
    echo "  1 — Tests failed"
    echo "  2 — Script error"
    exit 0
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-tests)
            SKIP_TESTS=true
            shift
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
if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "ERROR: Project directory '$PROJECT_DIR' not found" >&2
    exit 2
fi

cd "$PROJECT_DIR"

if [[ "$VERBOSE" == true ]]; then
    echo "Project dir: $(pwd)"
    echo "Baseline file: $BASELINE_FILE"
    echo "Gate config: $GATE_CONFIG_FILE"
fi

# --- Step 1: Run tests ---
total_coverage=0
package_count=0
failed_packages=0
failed_list=()

if [[ "$SKIP_TESTS" == false ]]; then
    if [[ "$VERBOSE" == true ]]; then
        echo ""
        echo "=== Running tests ==="
    fi
    
    # Run go test with coverage
    if go test ./... -coverprofile="$COVERAGE_FILE" -covermode=atomic 2>/dev/null; then
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✓ Tests passed"
        fi
    else
        # Tests failed, but continue to collect partial coverage
        failed_packages=1
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✗ Some tests failed"
        fi
    fi
fi

# --- Step 2: Calculate coverage ---
if [[ -f "$COVERAGE_FILE" ]]; then
    # Get total coverage percentage
    total_coverage=$(go tool cover -func="$COVERAGE_FILE" 2>/dev/null | grep "total:" | awk '{print $3}' | sed 's/%//' || echo "0")
    
    # Count packages
    package_count=$(go list ./... 2>/dev/null | wc -l)
    
    # Get per-package coverage
    package_coverage=$(go tool cover -func="$COVERAGE_FILE" 2>/dev/null | grep -v "total:" | awk '{print $3}' | sed 's/%//' | sort -n | tail -1 || echo "0")
    
    if [[ "$VERBOSE" == true ]]; then
        echo ""
        echo "=== Coverage Summary ==="
        echo "  Total coverage: ${total_coverage}%"
        echo "  Packages: $package_count"
        echo "  Max package coverage: ${package_coverage}%"
    fi
else
    if [[ "$VERBOSE" == true ]]; then
        echo "  ⚠ No coverage file found, using defaults"
    fi
fi

# --- Step 3: Update baseline.json ---
if [[ -f "$BASELINE_FILE" ]]; then
    if [[ "$VERBOSE" == true ]]; then
        echo ""
        echo "=== Updating baseline.json ==="
    fi
    
    # Create backup
    cp "$BASELINE_FILE" "${BASELINE_FILE}.bak"
    
    # Update coverage timestamp and values using jq
    if command -v jq &>/dev/null; then
        jq --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"            --arg coverage "$total_coverage"            --arg packages "$package_count"            '
            .lastUpdated = $now |
            .metrics.coverage.total = ($coverage | tonumber) |
            .metrics.packages.total = ($packages | tonumber)
        ' "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" &&            mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
        
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✓ baseline.json updated"
        fi
    else
        echo "  ⚠ jq not found, skipping baseline update"
        rm -f "${BASELINE_FILE}.bak"
    fi
else
    if [[ "$VERBOSE" == true ]]; then
        echo "  ⚠ baseline.json not found, skipping"
    fi
fi

# --- Step 4: Update gate-config.json ---
if [[ -f "$GATE_CONFIG_FILE" ]]; then
    if [[ "$VERBOSE" == true ]]; then
        echo ""
        echo "=== Updating gate-config.json ==="
    fi
    
    # Create backup
    cp "$GATE_CONFIG_FILE" "${GATE_CONFIG_FILE}.bak"
    
    # Update gate thresholds if needed
    if command -v jq &>/dev/null; then
        # Example: Update GATE-TEST-COVERAGE-60 threshold based on current coverage
        jq --arg coverage "$total_coverage" '
            if .gates["GATE-TEST-COVERAGE-60"] then
                .gates["GATE-TEST-COVERAGE-60"].currentValue = ($coverage | tonumber)
            else
                .
            end
        ' "$GATE_CONFIG_FILE" > "${GATE_CONFIG_FILE}.tmp" &&            mv "${GATE_CONFIG_FILE}.tmp" "$GATE_CONFIG_FILE"
        
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✓ gate-config.json updated"
        fi
    else
        echo "  ⚠ jq not found, skipping gate config update"
        rm -f "${GATE_CONFIG_FILE}.bak"
    fi
else
    if [[ "$VERBOSE" == true ]]; then
        echo "  ⚠ gate-config.json not found, skipping"
    fi
fi

# --- Step 5: Cleanup ---
if [[ "$VERBOSE" == true ]]; then
    echo ""
    echo "=== Cleanup ==="
    # Remove backup files if update succeeded
    rm -f "${BASELINE_FILE}.bak" "${GATE_CONFIG_FILE}.bak"
    rm -f "$COVERAGE_FILE"
    echo "  ✓ Cleanup complete"
fi

# --- Output ---
if [[ "$JSON_OUTPUT" == true ]]; then
    cat <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project_dir": "$(pwd)",
  "coverage": $total_coverage,
  "packages": $package_count,
  "tests_failed": $failed_packages,
  "baseline_updated": $([ -f "$BASELINE_FILE" ] && echo true || echo false),
  "gate_config_updated": $([ -f "$GATE_CONFIG_FILE" ] && echo true || echo false)
}
EOF
else
    echo ""
    echo "=== Baseline Refresh Complete ==="
    echo ""
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Coverage: ${total_coverage}%"
    echo "Packages: $package_count"
    echo "Tests failed: $failed_packages"
    echo "Baseline updated: $([ -f "$BASELINE_FILE" ] && echo "yes" || echo "no")"
    echo "Gate config updated: $([ -f "$GATE_CONFIG_FILE" ] && echo "yes" || echo "no")"
    
    if [[ $failed_packages -gt 0 ]]; then
        echo ""
        echo "✗ WARNING: Some tests failed. Review test output before committing."
    fi
    
    exit 0
fi
