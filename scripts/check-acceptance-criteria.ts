#!/usr/bin/env tsx
/**
 * check-acceptance-criteria.ts
 *
 * 从 docs/services/ 下的各服务目录提取验收标准，
 * 检查对应的测试文件是否存在并覆盖验收标准。
 *
 * 用法:
 *   npx tsx scripts/check-acceptance-criteria.ts
 *   npx tsx scripts/check-acceptance-criteria.ts --service pipeline
 *   npx tsx scripts/check-acceptance-criteria.ts --threshold 80
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================== Configuration ==============================

const PROJECT_DIR = path.resolve(__dirname, '..');
const DOCS_SERVICES_DIR = path.join(PROJECT_DIR, 'docs', 'services');
const BACKEND_TEST_DIR = path.join(PROJECT_DIR, 'orion-platform-service', 'src');
const FRONTEND_TEST_DIR = path.join(PROJECT_DIR, 'orion-frontend', 'src');
const REPORT_OUTPUT_DIR = path.join(PROJECT_DIR, 'docs', 'specs');

// Parse CLI args
const args = process.argv.slice(2);
const filterService = args.find(a => a.startsWith('--service='))?.split('=')[1];
const thresholdArg = args.find(a => a.startsWith('--threshold='))?.split('=')[1];
const coverageThreshold = thresholdArg ? parseInt(thresholdArg, 10) : 60;

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  red: '\x1b[0;31m',
  blue: '\x1b[0;34m',
  dim: '\x1b[2m',
};

function log(color: keyof typeof colors, msg: string) {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// ============================== Types ==============================

interface AcceptanceCriterion {
  id: string;
  description: string;
  validationMethod: string;
  sourceFile: string;
  serviceDir: string;
}

interface TestMatchResult {
  criterion: AcceptanceCriterion;
  foundIn: string | null;
  matchCount: number;
  totalKeywords: number;
}

interface ServiceReport {
  serviceDir: string;
  specFile: string;
  criteria: AcceptanceCriterion[];
  matched: number;
  unmatched: number;
  testFilesFound: string[];
  testFilesMissing: string[];
  coveragePercent: number;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
}

// ============================== Helpers ==============================

function extractKeywords(text: string): string[] {
  const cleaned = text
    .replace(/[，。、；：！？]/g, ' ')
    .replace(/[()（）\[\]【】{}]/g, ' ')
    .replace(/[./\\]{1,}/g, ' ')
    .replace(/[|]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  return cleaned.slice(0, 10);
}

function searchInTestFiles(keywords: string[], fileContents: Map<string, string>): { file: string | null; matchCount: number } {
  if (keywords.length === 0) return { file: null, matchCount: 0 };

  let bestMatch = { file: null as string | null, matchCount: 0 };

  for (const [file, content] of fileContents) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > bestMatch.matchCount) {
      bestMatch = { file: path.basename(file), matchCount };
    }
  }

  // Require at least 40% keyword match
  if (bestMatch.matchCount >= Math.max(1, Math.ceil(keywords.length * 0.4))) {
    return bestMatch;
  }
  return { file: null, matchCount: 0 };
}

// ============================== Markdown Parser ==============================

function findAcceptanceCriteriaSection(content: string): string | null {
  // Look for "## 二、验收标准" section
  const sectionMatch = content.match(/##\s+二[、.．]\s*验收标准([\s\S]*?)(?=##\s+三[、.．]|$)/);
  if (sectionMatch) {
    return sectionMatch[1];
  }
  return null;
}

function parseCriteriaTable(sectionContent: string, sourceFile: string, serviceDir: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];

  // Find all subsections (### 2.x or ### 2.x.x)
  const subsectionRegex = /###\s+2\.\d+[^\n]*\n([\s\S]*?)(?=###\s+2\.\d+|---)/g;
  let subsectionMatch;

  while ((subsectionMatch = subsectionRegex.exec(sectionContent)) !== null) {
    const subsectionBody = subsectionMatch[1];

    // Find markdown tables in this subsection
    const tableRegex = /\|[^\n]*\|[^\n]*\|\n\|[-| :]+\|\n((?:\|[^\n]*\|\n?)+)/g;
    let tableMatch;

    while ((tableMatch = tableRegex.exec(subsectionBody)) !== null) {
      const tableBody = tableMatch[1];
      const rows = tableBody.split('\n').filter(line => line.trim().startsWith('|'));

      for (const row of rows) {
        const cells = row.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length >= 3) {
          const id = cells[0];
          const description = cells[1];
          const validationMethod = cells[2];

          // Validate criterion ID format (e.g., V1, B2, DP10, L1-L5)
          if (/^[A-Z][0-9]+(-[A-Z][0-9]+)?$/.test(id)) {
            criteria.push({
              id,
              description,
              validationMethod,
              sourceFile,
              serviceDir,
            });
          }
        }
      }
    }
  }

  return criteria;
}

// ============================== Test File Discovery ==============================

function findTestFilesForService(serviceDir: string): string[] {
  const testFiles: string[] = [];

  // Backend service tests: src/services/{serviceDir}/__tests__/
  const backendServiceTestDir = path.join(BACKEND_TEST_DIR, 'services', serviceDir, '__tests__');
  if (fs.existsSync(backendServiceTestDir)) {
    const entries = fs.readdirSync(backendServiceTestDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js)$/.test(entry.name)) {
        testFiles.push(path.join(backendServiceTestDir, entry.name));
      }
    }
  }

  // Backend API tests: src/api/__tests__/ (look for files mentioning the service)
  const apiTestDir = path.join(BACKEND_TEST_DIR, 'api', '__tests__');
  if (fs.existsSync(apiTestDir)) {
    const entries = fs.readdirSync(apiTestDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js)$/.test(entry.name)) {
        const fileName = entry.name.toLowerCase();
        const serviceName = serviceDir.toLowerCase();
        if (fileName.includes(serviceName) || fileName.includes(serviceName.replace('-', ''))) {
          testFiles.push(path.join(apiTestDir, entry.name));
        }
      }
    }
  }

  return testFiles;
}

function collectAllTestContents(): Map<string, string> {
  const allContents = new Map<string, string>();

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js)$/.test(entry.name)) {
        const fullPath = path.join(dir, entry.name);
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          allContents.set(fullPath, content.toLowerCase());
        } catch (e) {
          // Ignore read errors
        }
      }
    }
  }

  scanDir(path.join(BACKEND_TEST_DIR, 'services'));
  scanDir(path.join(BACKEND_TEST_DIR, 'api', '__tests__'));
  scanDir(path.join(BACKEND_TEST_DIR, 'repositories', '__tests__'));
  scanDir(path.join(BACKEND_TEST_DIR, 'middleware', '__tests__'));
  scanDir(path.join(FRONTEND_TEST_DIR));

  return allContents;
}

// ============================== Main Logic ==============================

function analyzeService(serviceDir: string, allTestContents: Map<string, string>): ServiceReport | null {
  const specFiles: string[] = [];

  // Find spec files in the service directory
  const servicePath = path.join(DOCS_SERVICES_DIR, serviceDir);
  if (!fs.existsSync(servicePath)) return null;

  const entries = fs.readdirSync(servicePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && /spec\.md$/.test(entry.name)) {
      specFiles.push(path.join(servicePath, entry.name));
    }
  }

  if (specFiles.length === 0) return null;

  const allCriteria: AcceptanceCriterion[] = [];
  const testFilesFound = new Set<string>();

  for (const specFile of specFiles) {
    const content = fs.readFileSync(specFile, 'utf8');
    const sectionContent = findAcceptanceCriteriaSection(content);
    if (sectionContent) {
      const criteria = parseCriteriaTable(sectionContent, path.basename(specFile), serviceDir);
      allCriteria.push(...criteria);
    }
  }

  if (allCriteria.length === 0) return null;

  // Find test files for this service
  const serviceTestFiles = findTestFilesForService(serviceDir);
  const testFileNames = serviceTestFiles.map(f => path.basename(f));

  // Check each criterion against test files
  let matched = 0;
  let unmatched = 0;

  for (const criterion of allCriteria) {
    const keywords = extractKeywords(criterion.description);
    const { file: foundIn, matchCount } = searchInTestFiles(keywords, allTestContents);

    if (foundIn) {
      matched++;
      testFilesFound.add(foundIn);
    } else {
      unmatched++;
    }
  }

  const coveragePercent = allCriteria.length > 0 ? Math.round((matched / allCriteria.length) * 100) : 0;

  let status: 'PASS' | 'PARTIAL' | 'FAIL' = 'PASS';
  if (coveragePercent < 60) {
    status = 'FAIL';
  } else if (unmatched > 0) {
    status = 'PARTIAL';
  }

  return {
    serviceDir,
    specFile: path.basename(specFiles[0]),
    criteria: allCriteria,
    matched,
    unmatched,
    testFilesFound: Array.from(testFilesFound),
    testFilesMissing: serviceTestFiles.length === 0 ? ['(no test files found)'] : [],
    coveragePercent,
    status,
  };
}

// ============================== Report Generation ==============================

function generateMarkdownReport(reports: ServiceReport[]): string {
  const now = new Date().toISOString();
  const totalCriteria = reports.reduce((sum, r) => sum + r.criteria.length, 0);
  const totalMatched = reports.reduce((sum, r) => sum + r.matched, 0);
  const totalUnmatched = reports.reduce((sum, r) => sum + r.unmatched, 0);
  const globalCoverage = totalCriteria > 0 ? Math.round((totalMatched / totalCriteria) * 100) : 0;

  let md = `# 验收标准追溯表\n\n`;
  md += `> **生成日期**: ${now.split('T')[0]}\n`;
  md += `> **生成工具**: scripts/check-acceptance-criteria.ts\n`;
  md += `> **数据源**: docs/services/*/spec.md\n\n`;

  md += `## 一、概览\n\n`;
  md += `| 指标 | 值 |\n|------|-----|\n`;
  md += `| 服务模块数 | ${reports.length} |\n`;
  md += `| 验收标准总数 | ${totalCriteria} |\n`;
  md += `| 已覆盖 | ${totalMatched} |\n`;
  md += `| 未覆盖 | ${totalUnmatched} |\n`;
  md += `| 全局覆盖率 | **${globalCoverage}%** |\n`;
  md += `| CI 阈值 | ${coverageThreshold}% |\n\n`;

  md += `## 二、模块明细\n\n`;

  for (const report of reports) {
    const statusIcon = report.status === 'PASS' ? '✅' : report.status === 'PARTIAL' ? '⚠️' : '❌';
    md += `### ${statusIcon} ${report.serviceDir}\n\n`;
    md += `| 属性 | 值 |\n|------|-----|\n`;
    md += `| Spec 文档 | \`${report.specFile}\` |\n`;
    md += `| 验收标准数 | ${report.criteria.length} |\n`;
    md += `| 已覆盖 | ${report.matched} |\n`;
    md += `| 未覆盖 | ${report.unmatched} |\n`;
    md += `| 覆盖率 | **${report.coveragePercent}%** |\n`;
    md += `| 状态 | ${report.status} |\n\n`;

    if (report.unmatched > 0) {
      md += `**未覆盖的验收标准**:\n\n`;
      md += `| Spec # | 验收标准 | 验证方式 |\n|--------|---------|----------|\n`;
      for (const criterion of report.criteria) {
        // We don't track foundIn per criterion in this simplified version
        // Just list all unmatched
      }
      // Actually let's just list all criteria with their match status
      md += `| # | 标准 | 验证方式 | 状态 |\n|---|------|----------|------|\n`;
      // Need to re-analyze to get per-criterion status... let me adjust the report structure
    }
  }

  return md;
}

// Actually, let me rewrite the main function to collect per-criterion data for the report

interface CriterionReport {
  criterion: AcceptanceCriterion;
  foundIn: string | null;
  matchCount: number;
  totalKeywords: number;
}

interface DetailedServiceReport {
  serviceDir: string;
  specFile: string;
  criteria: CriterionReport[];
  matched: number;
  unmatched: number;
  coveragePercent: number;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
}

function analyzeServiceDetailed(serviceDir: string, allTestContents: Map<string, string>): DetailedServiceReport | null {
  const specFiles: string[] = [];
  const servicePath = path.join(DOCS_SERVICES_DIR, serviceDir);
  if (!fs.existsSync(servicePath)) return null;

  const entries = fs.readdirSync(servicePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && /spec\.md$/.test(entry.name)) {
      specFiles.push(path.join(servicePath, entry.name));
    }
  }

  if (specFiles.length === 0) return null;

  const allCriteria: AcceptanceCriterion[] = [];
  for (const specFile of specFiles) {
    const content = fs.readFileSync(specFile, 'utf8');
    const sectionContent = findAcceptanceCriteriaSection(content);
    if (sectionContent) {
      const criteria = parseCriteriaTable(sectionContent, path.basename(specFile), serviceDir);
      allCriteria.push(...criteria);
    }
  }

  if (allCriteria.length === 0) return null;

  const serviceTestFiles = findTestFilesForService(serviceDir);
  const criterionReports: CriterionReport[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const criterion of allCriteria) {
    const keywords = extractKeywords(criterion.description);
    const { file: foundIn, matchCount } = searchInTestFiles(keywords, allTestContents);

    if (foundIn) {
      matched++;
    } else {
      unmatched++;
    }

    criterionReports.push({
      criterion,
      foundIn,
      matchCount,
      totalKeywords: keywords.length,
    });
  }

  const coveragePercent = allCriteria.length > 0 ? Math.round((matched / allCriteria.length) * 100) : 0;
  let status: 'PASS' | 'PARTIAL' | 'FAIL' = 'PASS';
  if (coveragePercent < coverageThreshold) {
    status = 'FAIL';
  } else if (unmatched > 0) {
    status = 'PARTIAL';
  }

  return {
    serviceDir,
    specFile: path.basename(specFiles[0]),
    criteria: criterionReports,
    matched,
    unmatched,
    coveragePercent,
    status,
  };
}

function generateFullMarkdownReport(reports: DetailedServiceReport[]): string {
  const now = new Date().toISOString();
  const totalCriteria = reports.reduce((sum, r) => sum + r.criteria.length, 0);
  const totalMatched = reports.reduce((sum, r) => sum + r.matched, 0);
  const totalUnmatched = reports.reduce((sum, r) => sum + r.unmatched, 0);
  const globalCoverage = totalCriteria > 0 ? Math.round((totalMatched / totalCriteria) * 100) : 0;

  let md = `# 验收标准追溯表\n\n`;
  md += `> **生成日期**: ${now.split('T')[0]}\n`;
  md += `> **生成工具**: scripts/check-acceptance-criteria.ts\n`;
  md += `> **数据源**: docs/services/*/spec.md\n\n`;

  md += `## 一、概览\n\n`;
  md += `| 指标 | 值 |\n|------|-----|\n`;
  md += `| 服务模块数 | ${reports.length} |\n`;
  md += `| 验收标准总数 | ${totalCriteria} |\n`;
  md += `| 已覆盖 | ${totalMatched} |\n`;
  md += `| 未覆盖 | ${totalUnmatched} |\n`;
  md += `| 全局覆盖率 | **${globalCoverage}%** |\n`;
  md += `| CI 阈值 | ${coverageThreshold}% |\n\n`;

  md += `## 二、模块明细\n\n`;

  for (const report of reports) {
    const statusIcon = report.status === 'PASS' ? '✅' : report.status === 'PARTIAL' ? '⚠️' : '❌';
    md += `### ${statusIcon} ${report.serviceDir}\n\n`;
    md += `| 属性 | 值 |\n|------|-----|\n`;
    md += `| Spec 文档 | \`${report.specFile}\` |\n`;
    md += `| 验收标准数 | ${report.criteria.length} |\n`;
    md += `| 已覆盖 | ${report.matched} |\n`;
    md += `| 未覆盖 | ${report.unmatched} |\n`;
    md += `| 覆盖率 | **${report.coveragePercent}%** |\n`;
    md += `| 状态 | ${report.status} |\n\n`;

    if (report.criteria.length > 0) {
      md += `| Spec # | 验收标准 | 验证方式 | 覆盖状态 | 对应测试文件 |\n`;
      md += `|--------|---------|----------|----------|------------|\n`;
      for (const cr of report.criteria) {
        const coverageStatus = cr.foundIn ? '✅ 已覆盖' : '❌ 未覆盖';
        const testFile = cr.foundIn ? `\`${cr.foundIn}\`` : '—';
        // Escape pipe characters in markdown table cells
        const escapedDesc = cr.criterion.description.replace(/\|/g, '\\|');
        md += `| ${cr.criterion.id} | ${escapedDesc} | ${cr.criterion.validationMethod} | ${coverageStatus} | ${testFile} |\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

// ============================== Entry Point ==============================

function main() {
  log('blue', '========================================');
  log('blue', '验收标准覆盖率检查 (docs/services/*/spec.md)');
  log('blue', '========================================');

  if (!fs.existsSync(DOCS_SERVICES_DIR)) {
    log('red', `错误: ${DOCS_SERVICES_DIR} 不存在`);
    process.exit(1);
  }

  log('yellow', '收集测试文件...');
  const allTestContents = collectAllTestContents();
  log('green', `找到 ${allTestContents.size} 个测试文件`);

  // Discover service directories
  const serviceDirs = fs.readdirSync(DOCS_SERVICES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (filterService) {
    log('yellow', `过滤服务: ${filterService}`);
  }

  const reports: DetailedServiceReport[] = [];
  let totalCriteria = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const serviceDir of serviceDirs) {
    if (filterService && serviceDir !== filterService) {
      continue;
    }

    const report = analyzeServiceDetailed(serviceDir, allTestContents);
    if (!report) continue;

    reports.push(report);

    totalCriteria += report.criteria.length;
    totalMatched += report.matched;
    totalUnmatched += report.unmatched;

    const statusIcon = report.status === 'PASS' ? '✓' : report.status === 'PARTIAL' ? '△' : '✗';
    const statusColor = report.status === 'PASS' ? 'green' : report.status === 'PARTIAL' ? 'yellow' : 'red';
    log(statusColor, `  ${statusIcon} ${serviceDir}: ${report.matched}/${report.criteria.length} 验收标准已覆盖 (${report.coveragePercent}%)`);
  }

  // Global summary
  log('blue', '\n========================================');
  log('blue', '覆盖率汇总');
  log('blue', '========================================');
  log('yellow', `服务模块数: ${reports.length}`);
  log('yellow', `验收标准总数: ${totalCriteria}`);
  log('green', `已覆盖: ${totalMatched}`);
  log('red', `未覆盖: ${totalUnmatched}`);

  const globalCoverage = totalCriteria > 0 ? Math.round((totalMatched / totalCriteria) * 100) : 0;
  log('blue', `全局覆盖率: ${globalCoverage}%`);

  // Generate reports
  const jsonReport = {
    generated_at: new Date().toISOString(),
    total_services: reports.length,
    total_criteria: totalCriteria,
    matched_criteria: totalMatched,
    unmatched_criteria: totalUnmatched,
    coverage_percent: globalCoverage,
    coverage_threshold: coverageThreshold,
    services: reports.map(r => ({
      service_dir: r.serviceDir,
      spec_file: r.specFile,
      total_criteria: r.criteria.length,
      matched: r.matched,
      unmatched: r.unmatched,
      coverage_percent: r.coveragePercent,
      status: r.status,
      criteria: r.criteria.map(c => ({
        id: c.criterion.id,
        description: c.criterion.description,
        validation_method: c.criterion.validationMethod,
        status: c.foundIn ? 'MATCHED' : 'UNMATCHED',
        found_in: c.foundIn,
        match_count: c.matchCount,
        total_keywords: c.totalKeywords,
      })),
    })),
  };

  // Ensure output directory exists
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true });
  }

  const jsonReportPath = path.join(REPORT_OUTPUT_DIR, 'acceptance-criteria-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  log('green', `\nJSON 报告已生成: ${jsonReportPath}`);

  const markdownReport = generateFullMarkdownReport(reports);
  const markdownReportPath = path.join(REPORT_OUTPUT_DIR, 'acceptance-criteria-traceability.md');
  fs.writeFileSync(markdownReportPath, markdownReport);
  log('green', `Markdown 追溯表已生成: ${markdownReportPath}`);

  // Exit code
  if (globalCoverage < coverageThreshold) {
    log('red', `\n✗ 覆盖率 ${globalCoverage}% 低于阈值 ${coverageThreshold}%，检查不通过`);
    process.exit(1);
  } else if (totalUnmatched > 0) {
    log('yellow', `\n△ 存在 ${totalUnmatched} 个未覆盖的验收标准，建议补充测试`);
    process.exit(0);
  } else {
    log('green', '\n✓ 所有验收标准均已覆盖');
    process.exit(0);
  }
}

main();
