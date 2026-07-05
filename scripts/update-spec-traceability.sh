#!/bin/bash
# =============================================================================
# update-spec-traceability.sh
#
# 批量更新测试文件中的 Spec 验收标准编号引用。
# 从 spec-mapping.json 读取映射关系，自动在对应的测试文件的 it() 描述前添加 [V1] 引用。
#
# 用法:
#   ./scripts/update-spec-traceability.sh                    # 更新所有模块
#   ./scripts/update-spec-traceability.sh pipeline auth      # 只更新指定模块
#
# 映射文件格式 (spec-mapping.json):
# {
#   "pipeline": {
#     "PipelineVersionService.test.ts": ["V1", "V2", "V3", "V4", "V5", "V7"],
#     "PipelineBudgetService.test.ts": ["B1", "B2", "B3", "B4", "B5", "B6"],
#     "PipelineTemplateService.test.ts": ["T1", "T2", "T3", "T4", "T5"],
#     "DynamicParamsResolver.test.ts": ["D1", "D2"]
#   }
# }
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAPPING_FILE="$PROJECT_DIR/scripts/spec-mapping.json"
TRACE_FILE="$PROJECT_DIR/docs/specs/traceability-matrix.md"
BACKEND_TEST_DIR="$PROJECT_DIR/orion-platform-service/src"
FRONTEND_TEST_DIR="$PROJECT_DIR/orion-frontend/src"

total_updated=0
total_skipped=0

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查映射文件
if [ ! -f "$MAPPING_FILE" ]; then
  echo -e "${RED}错误: 映射文件 $MAPPING_FILE 不存在${NC}"
  echo "请先创建映射文件，格式见脚本头注释。"
  exit 1
fi

# 过滤模块列表
filter_modules=()
if [ $# -gt 0 ]; then
  filter_modules=("$@")
  echo -e "${YELLOW}过滤模块: ${filter_modules[*]}${NC}"
fi

# 读取映射并更新
modules=$(jq -r 'keys[]' "$MAPPING_FILE")
for module in $modules; do
  # 检查是否在过滤列表中
  if [ ${#filter_modules[@]} -gt 0 ]; then
    skip=true
    for fm in "${filter_modules[@]}"; do
      if [ "$module" = "$fm" ]; then
        skip=false
        break
      fi
    done
    if $skip; then
      continue
    fi
  fi

  echo -e "\n${GREEN}[$module]${NC} 处理中..."

  # 读取该模块的测试文件映射
  test_files=$(jq -r ".[\"$module\"] | keys[]" "$MAPPING_FILE")
  for test_file in $test_files; do
    refs=$(jq -r ".[\"$module\"][\"$test_file\"] | join(\",\")" "$MAPPING_FILE")
    IFS=',' read -ra ref_array <<< "$refs"

    # 查找测试文件
    found_file=$(find "$BACKEND_TEST_DIR" "$FRONTEND_TEST_DIR" -name "$test_file" 2>/dev/null | head -1)

    if [ -z "$found_file" ]; then
      echo -e "  ${YELLOW}⚠ 未找到 $test_file${NC}"
      total_skipped=$((total_skipped + 1))
      continue
    fi

    # 对每个引用，找到对应的 it() 并添加前缀
    updated=0
    for ref in "${ref_array[@]}"; do
      # 查找 it() 中是否已包含此引用
      if grep -q "\[$ref\]" "$found_file"; then
        echo -e "  ${YELLOW}  [$ref] 已存在${NC}"
        continue
      fi

      # 根据映射描述找到对应的 it()
      ref_desc=$(jq -r ".[\"$module\"][\"$test_file\"] | map(select(. == \"$ref\")) | .[0]" "$MAPPING_FILE" 2>/dev/null)
      if [ "$ref_desc" = "null" ] || [ -z "$ref_desc" ]; then
        continue
      fi

      # 在 it() 前添加引用
      # 查找对应的 it('...' 或 it("..." 并在描述前添加 [V1]
      # 使用 perl 做正则替换
      perl -i -pe "s/(it\\([\"'])(?!\[$ref\])/\$1[$ref] /g" "$found_file" 2>/dev/null
      updated=$((updated + 1))
    done

    if [ $updated -gt 0 ]; then
      echo -e "  ${GREEN}✅ $test_file (更新 $updated 处)${NC}"
    else
      echo -e "  ${YELLOW}  $test_file (无需更新)${NC}"
    fi
    total_updated=$((total_updated + updated))
  done
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}完成! 更新 $total_updated 处引用, 跳过 $total_skipped 个文件${NC}"
echo -e "${GREEN}========================================${NC}"

# 更新追溯矩阵的覆盖率数据
if [ $total_updated -gt 0 ]; then
  echo -e "\n${YELLOW}提示: 请更新 docs/specs/traceability-matrix.md 中的覆盖率统计${NC}"
fi