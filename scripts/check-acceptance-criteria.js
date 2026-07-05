#!/usr/bin/env node
/**
 * check-acceptance-criteria.js
 *
 * 从 feature_list.json 提取验收标准 (test_cases)，
 * 在实际测试文件中搜索对应描述，计算覆盖率并输出报告。
 *
 * 用法:
 *   node scripts/check-acceptance-criteria.js
 *   node scripts/check-acceptance-criteria.js platform-capability-enhancement
 */

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const REQUIREMENTS_DIR = path.join(PROJECT_DIR, '.dev-enegine', 'requirements');
const BACKEND_TEST_DIR = path.join(PROJECT_DIR, 'orion-platform-service', 'src');
const FRONTEND_TEST_DIR = path.join(PROJECT_DIR, 'orion-frontend', 'src');

// 过滤参数
const filterRequirements = process.argv.slice(2);

// 颜色
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  red: '\x1b[0;31m',
  blue: '\x1b[0;34m',
};

function log(color, msg) {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// 收集所有测试文件内容
function collectTestFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const name = entry.name;
      // 匹配 *.test.ts, *.test.tsx, *.test.js, *.spec.ts, *.spec.tsx
      if (/\.(test|spec)\.(ts|tsx|js)$/.test(name)) {
        const fullPath = entry.parentPath
          ? path.join(entry.parentPath, name)
          : path.join(dir, name);
        files.push(fullPath);
      }
    }
  }
  return files;
}

// 读取测试文件内容
function readTestContents(files) {
  const contents = new Map();
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      contents.set(file, content.toLowerCase());
    } catch (e) {
      // 忽略读取失败
    }
  }
  return contents;
}

// 从测试用例文本提取关键词
function extractKeywords(text) {
  // 移除常见标点，按语义切分
  const cleaned = text
    .replace(/[，。、；：！？]/g, ' ')
    .replace(/[()（）\[\]【】{}]/g, ' ')
    .replace(/[./\\]{1,}/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  return cleaned.slice(0, 8); // 取前8个关键词
}

// 在测试文件内容中搜索匹配
function searchInTestFiles(keywords, fileContents) {
  if (keywords.length === 0) return null;

  for (const [file, content] of fileContents) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    // 匹配超过40%关键词则视为命中
    if (matchCount >= Math.max(1, Math.ceil(keywords.length * 0.4))) {
      return path.basename(file);
    }
  }
  return null;
}

// 主逻辑
function main() {
  log('blue', '========================================');
  log('blue', '验收标准覆盖率检查');
  log('blue', '========================================');

  if (!fs.existsSync(REQUIREMENTS_DIR)) {
    log('red', `错误: ${REQUIREMENTS_DIR} 不存在`);
    process.exit(1);
  }

  // 收集测试文件
  log('yellow', '收集测试文件...');
  const backendFiles = collectTestFiles(BACKEND_TEST_DIR);
  const frontendFiles = collectTestFiles(FRONTEND_TEST_DIR);
  const allTestFiles = [...backendFiles, ...frontendFiles];
  log('green', `找到 ${allTestFiles.length} 个测试文件 (后端: ${backendFiles.length}, 前端: ${frontendFiles.length})`);

  const testContents = readTestContents(allTestFiles);

  // 遍历需求目录
  const reqDirs = fs.readdirSync(REQUIREMENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let totalFeatures = 0;
  let totalCriteria = 0;
  let matchedCriteria = 0;
  let unmatchedCriteria = 0;
  const report = {
    generated_at: new Date().toISOString(),
    requirements: [],
  };

  for (const reqName of reqDirs) {
    // 过滤
    if (filterRequirements.length > 0 && !filterRequirements.includes(reqName)) {
      continue;
    }

    const featureListPath = path.join(REQUIREMENTS_DIR, reqName, 'feature_list.json');
    if (!fs.existsSync(featureListPath)) {
      log('yellow', `⚠ [${reqName}] 未找到 feature_list.json，跳过`);
      continue;
    }

    log('blue', `\n[${reqName}] 检查中...`);

    let featureList;
    try {
      featureList = JSON.parse(fs.readFileSync(featureListPath, 'utf8'));
    } catch (e) {
      log('red', `  ✗ 解析 feature_list.json 失败: ${e.message}`);
      continue;
    }

    const features = featureList.features || [];
    const reqReport = {
      name: reqName,
      features: [],
      total_criteria: 0,
      matched_criteria: 0,
      unmatched_criteria: 0,
    };

    for (const feature of features) {
      const testCases = feature.test_cases || [];
      if (testCases.length === 0) continue;

      totalFeatures++;
      reqReport.total_criteria += testCases.length;
      totalCriteria += testCases.length;

      const featureResult = {
        id: feature.id,
        description: feature.description,
        test_cases: [],
        matched: 0,
        unmatched: 0,
        status: 'PASS',
      };

      for (const testCase of testCases) {
        const keywords = extractKeywords(testCase);
        const foundIn = searchInTestFiles(keywords, testContents);

        if (foundIn) {
          matchedCriteria++;
          reqReport.matched_criteria++;
          featureResult.matched++;
          featureResult.test_cases.push({
            case: testCase,
            status: 'MATCHED',
            found_in: foundIn,
          });
        } else {
          unmatchedCriteria++;
          reqReport.unmatched_criteria++;
          featureResult.unmatched++;
          featureResult.test_cases.push({
            case: testCase,
            status: 'UNMATCHED',
            found_in: null,
          });
        }
      }

      if (featureResult.unmatched > 0) {
        featureResult.status = featureResult.matched === 0 ? 'FAIL' : 'PARTIAL';
      }

      reqReport.features.push(featureResult);

      // 控制台输出
      const statusIcon = featureResult.status === 'PASS' ? '✓' : featureResult.status === 'PARTIAL' ? '△' : '✗';
      const statusColor = featureResult.status === 'PASS' ? 'green' : featureResult.status === 'PARTIAL' ? 'yellow' : 'red';
      log(statusColor, `  ${statusIcon} ${feature.id}: ${featureResult.matched}/${testCases.length} 验收标准已覆盖`);
      if (featureResult.unmatched > 0) {
        log('yellow', `    未覆盖: ${featureResult.test_cases.filter(t => t.status === 'UNMATCHED').map(t => t.case).join(', ')}`);
      }
    }

    report.requirements.push(reqReport);

    // 需求汇总
    const reqCoverage = reqReport.total_criteria > 0
      ? Math.round((reqReport.matched_criteria / reqReport.total_criteria) * 100)
      : 0;
    log('green', `  [${reqName}] 覆盖率: ${reqCoverage}% (${reqReport.matched_criteria}/${reqReport.total_criteria})`);
  }

  // 全局汇总
  log('blue', '\n========================================');
  log('blue', '覆盖率汇总');
  log('blue', '========================================');
  log('yellow', `特性总数: ${totalFeatures}`);
  log('yellow', `验收标准总数: ${totalCriteria}`);
  log('green', `已匹配: ${matchedCriteria}`);
  log('red', `未匹配: ${unmatchedCriteria}`);

  const globalCoverage = totalCriteria > 0 ? Math.round((matchedCriteria / totalCriteria) * 100) : 0;
  log('blue', `全局覆盖率: ${globalCoverage}%`);

  // 写入报告
  report.total_features = totalFeatures;
  report.total_criteria = totalCriteria;
  report.matched_criteria = matchedCriteria;
  report.unmatched_criteria = unmatchedCriteria;
  report.coverage_percent = globalCoverage;

  const reportPath = path.join(PROJECT_DIR, 'acceptance-criteria-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log('green', `\n报告已生成: ${reportPath}`);

  // 设置退出码
  if (globalCoverage < 60) {
    log('red', '\n✗ 覆盖率低于 60%，检查不通过');
    process.exit(1);
  } else if (unmatchedCriteria > 0) {
    log('yellow', '\n△ 存在未覆盖的验收标准，建议补充测试');
    process.exit(0);
  } else {
    log('green', '\n✓ 所有验收标准均已覆盖');
    process.exit(0);
  }
}

main();
