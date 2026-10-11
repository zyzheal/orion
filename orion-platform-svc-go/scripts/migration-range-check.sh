#!/usr/bin/env bash
# migration-range-check.sh — Migration 号段冲突检查 (ADR-017 Phase 4)
#
# 功能:
#   1. 扫描 migrations/*.sql 所有 migration 文件
#   2. 提取文件名的数字前缀 (e.g., 735_create_xxx.sql → 735)
#   3. 检查号段是否在允许范围内 (默认 699-775)
#   4. 检查是否有号段冲突 (同一数字多个文件)
#   5. 检查 UP/DOWN 文件是否成对存在
#
# 用法:
#   ./scripts/migration-range-check.sh
#   ./scripts/migration-range-check.sh --min 699 --max 775
#   ./scripts/migration-range-check.sh --json
#
# 退出码:
#   0 — 无冲突 (或全部在允许范围内)
#   1 — 有冲突或号段越界
#   2 — 脚本错误

set -euo pipefail

# --- Configuration ---
MIGRATIONS_DIR="${MIGRATIONS_DIR:-migrations}"
# If migrations dir not found, try common alternates
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    for alt in "../migrations" "./orion-platform-svc-go/migrations"; do
        if [[ -d "$alt" ]]; then
            MIGRATIONS_DIR="$alt"
            break
        fi
    done
fi
MIN_RANGE=699
MAX_RANGE=775
JSON_OUTPUT=false
VERBOSE=false

# --- Usage ---
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --min N          Minimum migration number (default: 699)"
    echo "  --max N          Maximum migration number (default: 775)"
    echo "  --json           Output as JSON"
    echo "  --verbose        Verbose output"
    echo "  --help           Show this help"
    echo ""
    echo "Exit codes:"
    echo "  0 — No conflicts (all migrations valid)"
    echo "  1 — Conflicts found or out of range"
    echo "  2 — Script error"
    exit 0
}

# --- Argument parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --min)
            MIN_RANGE="$2"
            shift 2
            ;;
        --max)
            MAX_RANGE="$2"
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
if ! [[ "$MIN_RANGE" =~ ^[0-9]+$ ]]; then
    echo "ERROR: --min must be a number" >&2
    exit 2
fi

if ! [[ "$MAX_RANGE" =~ ^[0-9]+$ ]]; then
    echo "ERROR: --max must be a number" >&2
    exit 2
fi

if [[ "$MIN_RANGE" -gt "$MAX_RANGE" ]]; then
    echo "ERROR: --min ($MIN_RANGE) > --max ($MAX_RANGE)" >&2
    exit 2
fi

# --- Scan migrations ---
total=0
in_range=0
out_of_range=0
conflicts=0
missing_down=0
missing_up=0
out_of_range_files=()
conflict_files=()
missing_down_files=()
missing_up_files=()

declare -A MIGRATION_NUMBERS

# First pass: collect all migration numbers
for file in "$MIGRATIONS_DIR"/*.sql; do
    [[ -e "$file" ]] || continue
    total=$((total + 1))
    filename=$(basename "$file")
    
    # Extract number prefix (e.g., "735_create_xxx.sql" → "735")
    number=$(echo "$filename" | grep -oE '^[0-9]+' || true)
    
    if [[ -z "$number" ]]; then
        if [[ "$VERBOSE" == true ]]; then
            echo "  ⚠ $filename: no number prefix"
        fi
        continue
    fi
    
    # Remove leading zeros
    number=$((10#$number))
    
    # Check range
    if [[ "$number" -lt "$MIN_RANGE" || "$number" -gt "$MAX_RANGE" ]]; then
        out_of_range=$((out_of_range + 1))
        out_of_range_files+=("$filename ($number)")
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✗ $filename: number $number out of range [$MIN_RANGE-$MAX_RANGE]"
        fi
    else
        in_range=$((in_range + 1))
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✓ $filename: number $number"
        fi
    fi
    
    # Track for conflict detection
    if [[ -n "${MIGRATION_NUMBERS[$number]+x}" ]]; then
        conflicts=$((conflicts + 1))
        conflict_files+=("$filename ($number)")
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✗ $filename: number $number conflicts with ${MIGRATION_NUMBERS[$number]}"
        fi
    else
        MIGRATION_NUMBERS[$number]="$filename"
    fi
done

# Second pass: check UP/DOWN pairs
for file in "$MIGRATIONS_DIR"/*_down.sql; do
    [[ -e "$file" ]] || continue
    filename=$(basename "$file")
    number=$(echo "$filename" | grep -oE '^[0-9]+' || true)
    if [[ -z "$number" ]]; then
        continue
    fi
    up_file=$(echo "$filename" | sed 's/_down\.sql$//')
    if [[ ! -f "$MIGRATIONS_DIR/$up_file" ]]; then
        missing_up=$((missing_up + 1))
        missing_up_files+=("$filename (missing $up_file)")
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✗ $filename: missing UP file $up_file"
        fi
    fi
done

for file in "$MIGRATIONS_DIR"/*.sql; do
    [[ -e "$file" ]] || continue
    filename=$(basename "$file")
    # Skip down files
    [[ "$filename" == *_down.sql ]] && continue
    
    number=$(echo "$filename" | grep -oE '^[0-9]+' || true)
    if [[ -z "$number" ]]; then
        continue
    fi
    down_file="${filename%.sql}_down.sql"
    if [[ ! -f "$MIGRATIONS_DIR/$down_file" ]]; then
        missing_down=$((missing_down + 1))
        missing_down_files+=("$filename (missing $down_file)")
        if [[ "$VERBOSE" == true ]]; then
            echo "  ✗ $filename: missing DOWN file $down_file"
        fi
    fi
done

# --- Calculate ---
issues=$((out_of_range + conflicts + missing_down + missing_up))
passed=$((total - issues))

# --- Output ---
if [[ "$JSON_OUTPUT" == true ]]; then
    cat <<EOF
{
  "total": $total,
  "in_range": $in_range,
  "out_of_range": $out_of_range,
  "conflicts": $conflicts,
  "missing_down": $missing_down,
  "missing_up": $missing_up,
  "range": ["$MIN_RANGE", "$MAX_RANGE"],
  "passed": $([ $issues -eq 0 ] && echo true || echo false),
  "out_of_range_files": $(printf '%s\n' "${out_of_range_files[@]}" | jq -R . | jq -s .),
  "conflict_files": $(printf '%s\n' "${conflict_files[@]}" | jq -R . | jq -s .),
  "missing_down_files": $(printf '%s\n' "${missing_down_files[@]}" | jq -R . | jq -s .),
  "missing_up_files": $(printf '%s\n' "${missing_up_files[@]}" | jq -R . | jq -s .)
}
EOF
else
    echo "=== Migration Range Check Report ==="
    echo ""
    echo "Directory: $MIGRATIONS_DIR"
    echo "Range: [$MIN_RANGE-$MAX_RANGE]"
    echo "Total migrations: $total"
    echo "In range: $in_range"
    echo "Out of range: $out_of_range"
    echo "Conflicts: $conflicts"
    echo "Missing DOWN: $missing_down"
    echo "Missing UP: $missing_up"
    echo ""
    
    if [[ $issues -eq 0 ]]; then
        echo "✓ PASS: All migrations valid"
        exit 0
    else
        echo "✗ FAIL: $issues issue(s) found"
        
        if [[ $out_of_range -gt 0 ]]; then
            echo ""
            echo "--- Out of Range ($out_of_range) ---"
            for f in "${out_of_range_files[@]}"; do
                echo "  ✗ $f"
            done
        fi
        
        if [[ $conflicts -gt 0 ]]; then
            echo ""
            echo "--- Conflicts ($conflicts) ---"
            for f in "${conflict_files[@]}"; do
                echo "  ✗ $f"
            done
        fi
        
        if [[ $missing_down -gt 0 ]]; then
            echo ""
            echo "--- Missing DOWN ($missing_down) ---"
            for f in "${missing_down_files[@]}"; do
                echo "  ✗ $f"
            done
        fi
        
        if [[ $missing_up -gt 0 ]]; then
            echo ""
            echo "--- Missing UP ($missing_up) ---"
            for f in "${missing_up_files[@]}"; do
                echo "  ✗ $f"
            done
        fi
        
        exit 1
    fi
fi
