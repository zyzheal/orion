#!/usr/bin/env bash
# adr-lint.sh — ADR 状态字段规范化检查器
# 关联：ADR-017 §4.1 Phase 3 + GATE-ADR-STATUS-NORMALIZED 门控
# 用法：./scripts/baseline/adr-lint.sh [--fix] [--strict]
# 退出码：0 通过 / 1 失败（有 ADR 缺状态字段）

set -euo pipefail

ADR_DIR="${ADR_DIR:-docs/adr}"
STRICT="${STRICT:-0}"
FIX_MODE=0

# 合法状态值（中文/英文均接受）
declare -a VALID_STATES=(
  "Accepted" "Proposed" "Deprecated" "Superseded" "Draft"
  "已接受" "已批准" "草案" "已废弃" "已被取代"
)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}✓${NC} $1"; }
log_fail() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fix) FIX_MODE=1; shift ;;
    --strict) STRICT=1; shift ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

# 收集所有 ADR 文件（排除 worktrees）
mapfile -t ADR_FILES < <(find "$ADR_DIR" -maxdepth 1 -name "*.md" -type f | sort)

if [ ${#ADR_FILES[@]} -eq 0 ]; then
  echo "No ADR files found in $ADR_DIR"
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
FAILED_FILES=()

for f in "${ADR_FILES[@]}"; do
  fname=$(basename "$f")

  # 跳过 README/index 文件
  [[ "$fname" == "README.md" || "$fname" == "INDEX.md" ]] && continue

  # 检测状态字段（支持多种格式）
  # 格式1: **状态**：✅ 已接受（Accepted）
  # 格式2: | 状态 | 已接受（Accepted）|
  # 格式3: ## Status \n **Accepted**
  # 格式4: > **状态**: 已批准
  # 格式5: **状态**: Accepted

  status_found=""

  # 尝试匹配中文状态字段
  for pattern in "^\*\*状态\*\*[：:]" "^状态[：:]" "^\| 状态 \|" "^> \*\*状态\*\*" "^> 状态[：:]"; do
    line=$(grep -m1 -E "$pattern" "$f" 2>/dev/null || true)
    if [ -n "$line" ]; then
      status_found="$line"
      break
    fi
  done

  # 尝试匹配英文 Status 字段
  if [ -z "$status_found" ]; then
    # 查找 ## Status 章节下的状态值
    status_section=$(sed -n '/^## Status$/,/^## /{ /^## Status$/d; /^## /d; p; }' "$f" 2>/dev/null | head -5 | tr -d '\n')
    if [ -n "$status_section" ]; then
      status_found="$status_section"
    fi
  fi

  # 判断是否有合法状态值
  has_valid_state=0
  for state in "${VALID_STATES[@]}"; do
    if echo "$status_found" | grep -qi "$state" 2>/dev/null; then
      has_valid_state=1
      break
    fi
  done

  if [ $has_valid_state -eq 1 ]; then
    log_pass "$fname — 状态字段存在"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    if [ $FIX_MODE -eq 1 ]; then
      # 自动修复：在第一行（# 标题）后插入状态字段
      # 判断是否已有 ## Status 章节
      if grep -q "^## Status$" "$f" 2>/dev/null; then
        # 已有 Status 章节但无值 — 在章节下补 Accepted
        sed -i '' '/^## Status$/a\
\
**Accepted** — (auto-added by adr-lint.sh, please verify)
' "$f"
        log_warn "$fname — 自动补全状态字段为 Accepted（请人工验证）"
        WARN_COUNT=$((WARN_COUNT + 1))
      else
        # 无 Status 章节 — 在第一个 ## 章节前插入
        # 暂不自动修改正文，仅警告
        log_fail "$fname — 无状态字段（--fix 无法自动添加，请手动补全）"
        FAILED_FILES+=("$fname")
        FAIL_COUNT=$((FAIL_COUNT + 1))
      fi
    else
      log_fail "$fname — 无状态字段或状态值不合法"
      FAILED_FILES+=("$fname")
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
done

# 汇总
echo ""
echo "==================== ADR Lint Summary ===================="
echo "  总计: $((PASS_COUNT + FAIL_COUNT + WARN_COUNT)) 个 ADR"
echo "  ${GREEN}通过${NC}: $PASS_COUNT"
echo "  ${YELLOW}警告${NC}: $WARN_COUNT"
echo "  ${RED}失败${NC}: $FAIL_COUNT"
echo "  阈值: GATE-ADR-STATUS-NORMALIZED 100% (当前 $(( PASS_COUNT * 100 / (PASS_COUNT + FAIL_COUNT + WARN_COUNT) ))%)"
echo "========================================================="

if [ $FAIL_COUNT -gt 0 ]; then
  echo ""
  echo "缺失状态字段的 ADR："
  for f in "${FAILED_FILES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "修复方式："
  echo "  1. 手动在 ADR 顶部添加: **状态**：✅ 已接受（Accepted）"
  echo "  2. 或运行: ./scripts/baseline/adr-lint.sh --fix"
  exit 1
fi

exit 0
