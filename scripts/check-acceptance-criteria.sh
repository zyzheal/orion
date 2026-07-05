#!/bin/bash
# =============================================================================
# check-acceptance-criteria.sh
#
# 从 Spec 文档 (feature_list.json) 中提取验收标准 (test_cases)，
# 并在实际测试文件中搜索对应描述，计算覆盖率。
#
# 用法:
#   ./scripts/check-acceptance-criteria.sh                    # 检查所有需求
#   ./scripts/check-acceptance-criteria.sh platform-capability-enhancement  # 检查指定需求
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUIREMENTS_DIR="$PROJECT_DIR/.dev-enegine/requirements"
BACKEND_TEST_DIR="$PROJECT_DIR/orion-platform-service/src"
FRONTEND_TEST_DIR="$PROJECT_DIR/orion-frontend/src"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 过滤的需求目录
filter_requirements=()
if [ $# -gt 0 ]; then
  filter_requirements=("$@")
  echo -e "${BLUE}过滤需求目录: ${filter_requirements[*]}${NC}"
fi

# 检查 requirements 目录
if [ ! -d "$REQUIREMENTS_DIR" ]; then
  echo -e "${RED}错误: $REQUIREMENTS_DIR 不存在${NC}"
  exit 1
fi

# 统计变量
total_criteria=0
matched_criteria=0
unmatched_criteria=0
total_features=0
features_with_tests=0

# 结果存储
declare -a report_lines=()
report_lines+=("acceptance_criteria_report")
report_lines+=("generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)")

# 遍历所有需求目录
for req_dir in "$REQUIREMENTS_DIR"/*/; do
  req_name=$(basename "$req_dir")

  # 过滤
  if [ ${#filter_requirements[@]} -gt 0 ]; then
    skip=true
    for fr in "${filter_requirements[@]}"; do
      if [ "$req_name" = "$fr" ]; then
        skip=false
        break
      fi
    done
    if $skip; then
      continue
    fi
  fi

  feature_list="$req_dir/feature_list.json"
  if [ ! -f "$feature_list" ]; then
    echo -e "${YELLOW}⚠ [$req_name] 未找到 feature_list.json，跳过${NC}"
    continue
  fi

  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}[$req_name] 验收标准检查${NC}"
  echo -e "${BLUE}========================================${NC}"

  # 使用 Node.js 解析 JSON 并提取 test_cases
  result=$(node -e "
    const fs = require('fs');
    const path = require('path');

    const featureListPath = path.join('$req_dir', 'feature_list.json');
    const data = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
    const features = data.features || [];

    let totalCriteria = 0;
    let featuresWithTests = 0;
    const results = [];

    for (const feature of features) {
      const testCases = feature.test_cases || [];
      if (testCases.length === 0) continue;

      totalCriteria += testCases.length;
      if (feature.passes === true) {
        featuresWithTests++;
      }

      results.push(JSON.stringify({
        id: feature.id,
        description: feature.description,
        test_cases: testCases,
        passes: feature.passes || false
      }));
    }

    console.log(JSON.stringify({
      totalCriteria,
      featuresWithTests,
      featuresCount: features.length,
      results
    }));
  " 2>/dev/null)

  if [ -z "$result" ]; then
    echo -e "${YELLOW}  ⚠ 解析 feature_list.json 失败${NC}"
    continue
  fi

  # 解析 JSON 结果
  total_criteria_req=$(echo "$result" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.totalCriteria);")
  features_with_tests_req=$(echo "$result" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(j);console.log(j.featuresWithTests);")
  features_count=$(echo "$result" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.featuresCount);")

  echo -e "  特性总数: $features_count"
  echo -e "  验收标准总数: $total_criteria_req"

  total_criteria=$((total_criteria + total_criteria_req))
  total_features=$((total_features + features_count))

  # 对每个 test_case 搜索匹配
  matched_req=0
  unmatched_req=0

  echo "$result" | node -e "
    const fs = require('fs');
    const path = require('path');
    const readline = require('readline');

    const PROJECT_DIR = '$PROJECT_DIR';
    const BACKEND_TEST_DIR = '$BACKEND_TEST_DIR';
    const FRONTEND_TEST_DIR = '$FRONTEND_TEST_DIR';

    // 收集所有测试文件内容
    const testFiles = [];

    function scanDir(dir, extensions) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          testFiles.push(path.join(dir, entry.name));
        }
      }
    }

    scanDir(BACKEND_TEST_DIR, ['.test.ts', '.test.tsx', '.test.js', '.spec.ts', '.spec.tsx']);
    scanDir(FRONTEND_TEST_DIR, ['.test.ts', '.test.tsx', '.test.js', '.spec.ts', '.spec.tsx']);

    // 读取所有测试文件内容
    const fileContents = new Map();
    for (const file of testFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        fileContents.set(file, content.toLowerCase());
      } catch (e) {
        // 忽略读取失败的文件
      }
    }

    const rl = readline.createInterface({ input: process.stdin });
    let lineIndex = 0;
    let jsonData = '';

    rl.on('line', (line) => {
      if (lineIndex === 0) {
        jsonData = line;
      }
      lineIndex++;
    });

    rl.on('close', () => {
      const data = JSON.parse(jsonData);
      const results = JSON.parse(data);

      let matched = 0;
      let unmatched = 0;

      for (const feature of results.results) {
        const featureMatched = [];
        const featureUnmatched = [];

        for (const testCase of feature.test_cases) {
          const keywords = extractKeywords(testCase);
          const found = searchInTestFiles(keywords, fileContents);

          if (found) {
            matched++;
            featureMatched.push({ case: testCase, found_in: found });
          } else {
            unmatched++;
            featureUnmatched.push(testCase);
          }
        }

        // 输出结果
        const status = featureUnmatched.length === 0 ? 'PASS' : 'PARTIAL';
        const statusColor = featureUnmatched.length === 0 ? 'GREEN' : 'YELLOW';

        console.log('FEATURE:' + feature.id + ':' + status + ':' + featureUnmatched.length + '/' + feature.test_cases.length);

        if (featureUnmatched.length > 0) {
          console.log('  UNMATCHED: ' + featureUnmatched.join('; '));
        }
      }

      console.log('MATCHED:' + matched);
      console.log('UNMATCHED:' + unmatched);

      function extractKeywords(text) {
        // 移除标点符号，提取关键词
        return text
          .replace(/[，。、；：！？]/g, ' ')
          .replace(/[()（）\[\]【】]/g, ' ')
          .replace(/[./\\\\]{1,}/g, ' ')
          .split(/\\s+/)
          .filter(w => w.length > 1)
          .slice(0, 5); // 取前5个关键词
      }

      function searchInTestFiles(keywords, fileContents) {
        if (keywords.length === 0) return null;

        for (const [file, content] of fileContents) {
          let matchCount = 0;
          for (const keyword of keywords) {
            if (content.includes(keyword.toLowerCase())) {
              matchCount++;
            }
          }
          // 如果匹配超过50%的关键词，认为找到
          if (matchCount >= Math.ceil(keywords.length * 0.5)) {
            return file;
          }
        }
        return null;
      }
    });
  " 2>/dev/null) || true

  # 从脚本输出中提取统计
  # (简化处理：重新遍历 JSON 计算结果)
  echo -e "${GREEN}  检查完成${NC}"
done

# 输出汇总
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}验收标准覆盖率汇总${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  特性总数: $total_features"
echo -e "  验收标准总数: $total_criteria"
echo -e "  已匹配: $matched_criteria"
echo -e "  未匹配: $unmatched_criteria"
if [ $total_criteria -gt 0 ]; then
  coverage=$((matched_criteria * 100 / total_criteria))
  echo -e "  覆盖率: ${coverage}%"
fi

# 生成 JSON 报告
cat > "$PROJECT_DIR/acceptance-criteria-report.json" <<EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "total_features": $total_features,
  "total_criteria": $total_criteria,
  "matched_criteria": $matched_criteria,
  "unmatched_criteria": $unmatched_criteria,
  "coverage_percent": $([ $total_criteria -gt 0 ] && echo $((matched_criteria * 100 / total_criteria)) || echo 0)
}
EOF

echo -e "\n${GREEN}报告已生成: acceptance-criteria-report.json${NC}"
