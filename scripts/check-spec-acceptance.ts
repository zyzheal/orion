#!/usr/bin/env tsx
// check-spec-acceptance.ts
//
// CI 集成用：扫描所有 spec 文档，验证验收标准完整性。
// 扫描范围：docs/specs/*.md + docs/services/*/spec.md
//
// 检查项：
//   1. 是否存在"验收标准"或"Acceptance Criteria"章节
//   2. 该章节下是否至少包含 3 条验收标准（表格行）
//   3. 文档头部是否声明状态（状态值须为合法枚举之一）
//
// Usage:
//   npx tsx scripts/check-spec-acceptance.ts
//   npx tsx scripts/check-spec-acceptance.ts --dir docs/specs
//   npx tsx scripts/check-spec-acceptance.ts --min-criteria 3
//   npx tsx scripts/check-spec-acceptance.ts --json
//
// 退出码：
//   0 - 全部通过
//   1 - 存在不通过项

import * as fs from 'fs';
import * as path from 'path';

// ============================== Configuration ==============================

const PROJECT_DIR = path.resolve(__dirname, '..');

const DEFAULT_SCAN_DIRS = [
  path.join(PROJECT_DIR, 'docs', 'specs'),
  path.join(PROJECT_DIR, 'docs', 'services'),
];

// 合法状态值（中文 + 英文）
const VALID_STATUSES = [
  'draft', 'reviewed', 'implementing', 'completed',
  '编写中', '评审中', '实施中', '已验证',
];

// 验收标准章节标题的正则（匹配中英文，支持 ## 或 ### 级别）
const ACCEPTANCE_HEADING_PATTERNS = [
  /^##\s+二[、.．]\s*验收标准/,
  /^##\s+验收标准/,
  /^##\s+Acceptance\s+Criteria/,
  /^###\s+验收标准/,
  /^###\s+Acceptance\s+Criteria/,
];

// 解析 CLI 参数
function parseArgs(): { scanDirs: string[]; minCriteria: number; jsonOutput: boolean } {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {
    scanDirs: [...DEFAULT_SCAN_DIRS],
    minCriteria: 3,
    jsonOutput: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dir':
        result.scanDirs = [path.resolve(PROJECT_DIR, args[++i])];
        break;
      case '--min-criteria':
        result.minCriteria = parseInt(args[++i], 10) || 3;
        break;
      case '--json':
        result.jsonOutput = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }
  return result;
}

function printHelp(): void {
  console.log(`
check-spec-acceptance.ts - Spec 验收标准完整性检查

用法:
  npx tsx scripts/check-spec-acceptance.ts [选项]

选项:
  --dir <path>        指定扫描目录（可多次指定，默认扫描 docs/specs + docs/services）
  --min-criteria <n>  每条验收标准最少条目数（默认: 3）
  --json              输出 JSON 格式结果
  --help, -h          显示帮助信息

检查项:
  1. 文档是否存在"验收标准"章节
  2. 章节下是否至少包含 N 条表格形式的验收标准条目
  3. 文档头部是否声明有效状态值

合法状态值:
  draft / reviewed / implementing / completed
  编写中 / 评审中 / 实施中 / 已验证

退出码:
  0  全部通过
  1  存在不通过项
`);
}

// ============================== File Discovery ==============================

function findSpecFiles(scanDirs: string[]): string[] {
  const specFiles: string[] = [];

  for (const scanDir of scanDirs) {
    if (!fs.existsSync(scanDir)) {
      continue;
    }

    // docs/specs/*.md
    if (path.basename(scanDir) === 'specs') {
      const entries = fs.readdirSync(scanDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && !['spec-status-report.md', 'traceability-matrix.md', 'acceptance-criteria-traceability.md', 'acceptance-criteria-report.json'].includes(entry.name)) {
          specFiles.push(path.join(scanDir, entry.name));
        }
      }
    }

    // docs/services/*/spec.md
    if (path.basename(scanDir) === 'services') {
      const entries = fs.readdirSync(scanDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const specFile = path.join(scanDir, entry.name, 'spec.md');
          if (fs.existsSync(specFile)) {
            specFiles.push(specFile);
          }
        }
      }
    }

    // Generic fallback: recurse and collect any spec.md
    if (!['specs', 'services'].includes(path.basename(scanDir))) {
      function walkDir(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && entry.name === 'spec.md') {
            specFiles.push(fullPath);
          }
        }
      }
      walkDir(scanDir);
    }
  }

  return specFiles;
}

// ============================== Markdown Parser ==============================

function extractStatus(content: string): string | null {
  // Match "> **状态**: <value>" anywhere in first 20 lines
  const lines = content.split('\n').slice(0, 30);
  for (const line of lines) {
    const match = line.match(/>\s*\*\*状态\*\*\s*:\s*(.+)/);
    if (match) {
      return match[1].trim();
    }
    // Also try English: "> **Status**: <value>"
    const enMatch = line.match(/>\s*\*\*Status\*\*\s*:\s*(.+)/i);
    if (enMatch) {
      return enMatch[1].trim();
    }
  }
  return null;
}

function hasAcceptanceSection(content: string): { found: boolean; headingLevel: number; sectionIndex: number } {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of ACCEPTANCE_HEADING_PATTERNS) {
      if (pattern.test(line)) {
        // Extract heading level
        const levelMatch = line.match(/^(#{1,6})\s/);
        return {
          found: true,
          headingLevel: levelMatch ? levelMatch[1].length : 2,
          sectionIndex: i,
        };
      }
    }
  }
  return { found: false, headingLevel: 0, sectionIndex: -1 };
}

function countAcceptanceCriteria(content: string, sectionIndex: number): number {
  // Strategy 1: Count rows in markdown tables within the acceptance section and its subsections
  // A table row looks like: | something | something | something |
  const lines = content.split('\n');
  let count = 0;
  let pastAcceptanceHeading = false;

  for (let i = sectionIndex; i < lines.length; i++) {
    const line = lines[i];

    // Track when we've passed the acceptance section heading itself
    if (i === sectionIndex) {
      pastAcceptanceHeading = true;
    }

    // Detect next same-or-higher-level heading (exit condition)
    const headingMatch = line.match(/^(#{1,6})\s/);
    if (headingMatch && pastAcceptanceHeading) {
      const currentLevel = headingMatch[1].length;
      // Always break on level-1 headings (new top-level section)
      if (currentLevel === 1) break;
      // Break on level-2 headings that are NOT subsections of the acceptance section
      // (i.e., not starting with ## 二、 which means we've hit ## 三、 or ## 设计 etc.)
      if (currentLevel === 2 && !line.match(/^##\s+二[、.．]/)) break;
    }

    // Count table rows that look like criteria entries
    // Pattern: | <id> | <description> | <method> |
    // The ID column matches specs like AG1, CM6, V1, B2, etc. (letter(s)+digits+optional suffix)
    const tableRowMatch = line.match(/^\|\s*([A-Za-z][\w.-]*)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (tableRowMatch) {
      // Skip header separator rows (|---|---|)
      if (/^\|[\s-:|]+\|$/.test(line)) continue;
      // Skip rows where all cells are empty or just dashes
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 2) {
        count++;
      }
    }
  }

  return count;
}

// ============================== Analysis ==============================

interface SpecResult {
  file: string;
  relativePath: string;
  status: string | null;
  statusValid: boolean;
  hasAcceptanceSection: boolean;
  criteriaCount: number;
  criteriaMinMet: boolean;
  pass: boolean;
  issues: string[];
}

function analyzeFile(filePath: string, minCriteria: number): SpecResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(PROJECT_DIR, filePath);
  const issues: string[] = [];

  // 1. Status
  const status = extractStatus(content);
  const statusValid = status !== null && VALID_STATUSES.some(s => status!.toLowerCase() === s.toLowerCase());

  if (!status) {
    issues.push('缺少状态声明（头部需包含 `> **状态**: <值>`）');
  } else if (!statusValid) {
    issues.push(`状态值 "${status}" 不在合法枚举中（合法值: ${VALID_STATUSES.join(', ')}）`);
  }

  // 2. Acceptance criteria section
  const sectionResult = hasAcceptanceSection(content);
  if (!sectionResult.found) {
    issues.push('缺少验收标准章节（需包含 "## 二、验收标准" 或 "## Acceptance Criteria"）');
  }

  // 3. Criteria count
  let criteriaCount = 0;
  if (sectionResult.found) {
    criteriaCount = countAcceptanceCriteria(content, sectionResult.sectionIndex);
    if (criteriaCount < minCriteria) {
      issues.push(`验收标准条目不足（当前 ${criteriaCount} 条，要求 ≥ ${minCriteria} 条）`);
    }
  }

  const pass = issues.length === 0;

  return {
    file: filePath,
    relativePath,
    status,
    statusValid: statusValid || status === null, // null status is caught by issues, not by valid flag
    hasAcceptanceSection: sectionResult.found,
    criteriaCount,
    criteriaMinMet: criteriaCount >= minCriteria,
    pass,
    issues,
  };
}

// ============================== Report ==============================

function generateReport(results: SpecResult[], minCriteria: number): string {
  const now = new Date().toISOString();
  const totalFiles = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = totalFiles - passed;

  let report = '';
  report += `\n${'='.repeat(70)}\n`;
  report += `  Spec 验收标准完整性检查报告\n`;
  report += `  生成时间: ${now}\n`;
  report += `${'='.repeat(70)}\n\n`;

  report += `扫描范围:\n`;
  report += `  最小验收标准条目数: ${minCriteria}\n`;
  report += `  合法状态值: ${VALID_STATUSES.join(', ')}\n\n`;

  report += `汇总:\n`;
  report += `  总 Spec 数:    ${totalFiles}\n`;
  report += `  ✅ 通过:       ${passed}\n`;
  report += `  ❌ 未通过:     ${failed}\n`;
  report += `  通过率:        ${totalFiles > 0 ? ((passed / totalFiles) * 100).toFixed(1) : '0.0'}%\n\n`;

  if (failed > 0) {
    report += `${'─'.repeat(70)}\n`;
    report += `未通过的 Spec:\n`;
    report += `${'─'.repeat(70)}\n\n`;

    for (const result of results.filter(r => !r.pass)) {
      report += `  ❌ ${result.relativePath}\n`;
      for (const issue of result.issues) {
        report += `     • ${issue}\n`;
      }
      if (result.hasAcceptanceSection && result.criteriaCount > 0) {
        report += `     ℹ️  验收标准条目数: ${result.criteriaCount}\n`;
      }
      report += `\n`;
    }
  }

  // List all passed specs
  if (passed > 0) {
    report += `${'─'.repeat(70)}\n`;
    report += `通过的 Spec (${passed}):\n`;
    report += `${'─'.repeat(70)}\n\n`;
    for (const result of results.filter(r => r.pass)) {
      report += `  ✅ ${result.relativePath} (${result.criteriaCount} 条验收标准`;
      if (result.status) {
        report += `, 状态: ${result.status}`;
      }
      report += `)\n`;
    }
    report += `\n`;
  }

  return report;
}

function generateJSONReport(results: SpecResult[], minCriteria: number): string {
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      min_criteria: minCriteria,
      valid_statuses: VALID_STATUSES,
      summary: {
        total: results.length,
        passed,
        failed,
        pass_rate: results.length > 0 ? parseFloat(((passed / results.length) * 100).toFixed(1)) : 0,
      },
      results: results.map(r => ({
        file: r.relativePath,
        status: r.status,
        has_acceptance_section: r.hasAcceptanceSection,
        criteria_count: r.criteriaCount,
        criteria_min_met: r.criteriaMinMet,
        pass: r.pass,
        issues: r.issues,
      })),
    },
    null,
    2
  );
}

// ============================== Entry Point ==============================

function main(): void {
  const { scanDirs, minCriteria, jsonOutput } = parseArgs();

  const specFiles = findSpecFiles(scanDirs);

  if (specFiles.length === 0) {
    console.error('错误: 未找到任何 spec 文件。请确认扫描目录包含 docs/specs/ 或 docs/services/*/spec.md');
    process.exit(1);
  }

  const results: SpecResult[] = specFiles
    .sort((a, b) => a.localeCompare(b))
    .map(file => analyzeFile(file, minCriteria));

  // Always write JSON report to docs/specs/ for CI artifact upload
  const reportDir = path.join(PROJECT_DIR, 'docs', 'specs');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const jsonReportPath = path.join(reportDir, 'acceptance-criteria-report.json');
  fs.writeFileSync(jsonReportPath, generateJSONReport(results, minCriteria), 'utf-8');

  // Also write a human-readable traceability summary
  const traceabilityPath = path.join(reportDir, 'acceptance-criteria-traceability.md');
  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  let traceMd = `# Spec 验收标准验证报告\n\n`;
  traceMd += `> **生成时间**: ${new Date().toISOString()}\n`;
  traceMd += `> **总 Spec 数**: ${results.length} | ✅ 通过: ${passed} | ❌ 未通过: ${failed} | 通过率: ${results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : '0.0'}%\n\n`;
  traceMd += `## 通过的 Spec (${passed})\n\n`;
  traceMd += `| Spec 文档 | 验收标准数 | 状态 |\n|----------|:---------:|------|\n`;
  for (const r of results.filter(r => r.pass)) {
    traceMd += `| ${r.relativePath} | ${r.criteriaCount} | ${r.status || 'N/A'} |\n`;
  }
  if (failed > 0) {
    traceMd += `\n## 未通过的 Spec (${failed})\n\n`;
    traceMd += `| Spec 文档 | 问题 |\n|----------|------|\n`;
    for (const r of results.filter(r => !r.pass)) {
      traceMd += `| ${r.relativePath} | ${r.issues.join('; ')} |\n`;
    }
  }
  traceMd += `\n---\n_由 check-spec-acceptance.ts 自动生成_\n`;
  fs.writeFileSync(traceabilityPath, traceMd, 'utf-8');

  // Print to stdout
  if (jsonOutput) {
    console.log(generateJSONReport(results, minCriteria));
  } else {
    console.log(generateReport(results, minCriteria));
  }

  const failedCount = results.filter(r => !r.pass).length;

  if (failedCount > 0) {
    console.error(`\n✗ 检查未通过: ${failedCount} 个 Spec 存在缺失项`);
    process.exit(1);
  } else {
    console.log(`\n✓ 检查通过: 全部 ${results.length} 个 Spec 符合验收标准完整性要求`);
    process.exit(0);
  }
}

main();
