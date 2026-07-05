#!/usr/bin/env tsx
/**
 * verify-spec-traceability.ts
 *
 * CI 验证脚本：确保每个 Spec 验收标准都有对应的测试引用。
 *
 * 检查项：
 *   1. 解析 docs/specs/*.md 中所有验收标准编号（格式: AG1, CM6, SH10 等）
 *   2. 扫描所有测试文件中的 [编号] 引用
 *   3. 验证 100% 覆盖率（每个 AC 至少有一个测试引用）
 *   4. 检测孤儿验收标准（无测试引用）
 *   5. 检测孤儿测试引用（引用了不存在的 AC）
 *   6. 生成可追溯性矩阵报告
 *
 * 用法:
 *   npx tsx scripts/verify-spec-traceability.ts
 *   npx tsx scripts/verify-spec-traceability.ts --threshold 100
 *   npx tsx scripts/verify-spec-traceability.ts --spec-dir docs/specs
 *   npx tsx scripts/verify-spec-traceability.ts --test-dir orion-platform-service/src
 *   npx tsx scripts/verify-spec-traceability.ts --json
 *   npx tsx scripts/verify-spec-traceability.ts --matrix
 *
 * 退出码:
 *   0 - 全部通过
 *   1 - 存在孤儿 AC 或覆盖率低于阈值
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================== Configuration ==============================

const PROJECT_DIR = path.resolve(__dirname, '..');

// 默认扫描目录
const DEFAULT_SPEC_DIRS = [path.join(PROJECT_DIR, 'docs', 'specs')];
const DEFAULT_TEST_DIRS = [
  path.join(PROJECT_DIR, 'orion-platform-service', 'src'),
  path.join(PROJECT_DIR, 'orion-platform-service', '__tests__'),
];

// AC 编号正则：匹配 AG1, CM6, SH10, AO22, CE1, DP1, DT1, FS1, SC1 等
const AC_ID_PATTERN = /\b([A-Z]{2,3})(\d+)\b/g;

// 测试引用正则：匹配 [AG1], [CM6] 等（在 describe/it 描述中）
const TEST_REF_PATTERN = /\[([A-Z]{2,3}\d+)\]/g;

// 验收标准章节标题正则
const ACCEPTANCE_HEADING_PATTERNS = [
  /^##\s+二[、.．]\s*验收标准/,
  /^##\s+验收标准/,
  /^##\s+Acceptance\s+Criteria/,
  /^###\s+验收标准/,
  /^###\s+Acceptance\s+Criteria/,
];

// 默认覆盖率阈值
const DEFAULT_THRESHOLD = 100;

// ============================== CLI 参数解析 ==============================

interface CliOptions {
  specDirs: string[];
  testDirs: string[];
  threshold: number;
  jsonOutput: boolean;
  matrixOutput: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    specDirs: [...DEFAULT_SPEC_DIRS],
    testDirs: [...DEFAULT_TEST_DIRS],
    threshold: DEFAULT_THRESHOLD,
    jsonOutput: false,
    matrixOutput: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--spec-dir':
        options.specDirs = [path.resolve(PROJECT_DIR, args[++i])];
        break;
      case '--test-dir':
        options.testDirs = [path.resolve(PROJECT_DIR, args[++i])];
        break;
      case '--threshold':
        options.threshold = parseInt(args[++i], 10) || DEFAULT_THRESHOLD;
        break;
      case '--json':
        options.jsonOutput = true;
        break;
      case '--matrix':
        options.matrixOutput = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
verify-spec-traceability.ts - Spec 验收标准可追溯性验证

用法:
  npx tsx scripts/verify-spec-traceability.ts [选项]

选项:
  --spec-dir <path>     指定 Spec 文档目录（可多次指定，默认: docs/specs）
  --test-dir <path>     指定测试文件目录（可多次指定，默认: orion-platform-service/src）
  --threshold <n>       覆盖率阈值百分比（默认: 100）
  --matrix              生成 Markdown 可追溯性矩阵
  --json                输出 JSON 格式结果
  --help, -h            显示帮助信息

检查项:
  1. 每个验收标准编号都有对应的测试引用
  2. 无孤儿验收标准（定义了但无测试引用）
  3. 无孤儿测试引用（引用了不存在的 AC）
  4. 全局覆盖率 >= 阈值

AC 编号格式: AG1, CM6, SH10, AO22, CE1, DP1, DT1, FS1, SC1 等
测试引用格式: [AG1], [CM6] 等（在 describe/it 描述中）

退出码:
  0  全部通过
  1  存在孤儿 AC 或覆盖率低于阈值
`);
}

// ============================== 类型定义 ==============================

interface AcceptanceCriterion {
  id: string;
  prefix: string;
  number: number;
  description: string;
  sourceFile: string;
  validationMethod: string;
}

interface TestReference {
  acId: string;
  file: string;
  line: number;
  context: string;
}

interface TraceabilityReport {
  generatedAt: string;
  threshold: number;
  summary: {
    totalSpecs: number;
    totalCriteria: number;
    totalTestRefs: number;
    matchedCriteria: number;
    orphanCriteria: number;
    orphanRefs: number;
    coveragePercent: number;
    pass: boolean;
  };
  criteria: CriterionTrace[];
  orphanCriteriaList: AcceptanceCriterion[];
  orphanRefsList: TestReference[];
  specFiles: string[];
  testFiles: string[];
}

interface CriterionTrace {
  id: string;
  prefix: string;
  description: string;
  sourceFile: string;
  validationMethod: string;
  matched: boolean;
  refs: TestReference[];
}

// ============================== Spec 文档解析 ==============================

/**
 * 查找验收标准章节的起始位置
 */
function findAcceptanceSection(content: string): { start: number; end: number } | null {
  const lines = content.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of ACCEPTANCE_HEADING_PATTERNS) {
      if (pattern.test(line)) {
        sectionStart = i;
        break;
      }
    }
    if (sectionStart >= 0) {
      // 找到同级别或更高级别的标题（非子章节）
      const headingMatch = line.match(/^(#{1,6})\s/);
      if (headingMatch && i > sectionStart) {
        const level = headingMatch[1].length;
        // 遇到 level-1 或非 "二、" 的 level-2 标题时结束
        if (level === 1 || (level === 2 && !line.match(/^##\s+二[、.．]/))) {
          sectionEnd = i;
          break;
        }
      }
    }
  }

  if (sectionStart < 0) return null;
  return { start: sectionStart, end: sectionEnd };
}

/**
 * 从验收标准章节提取所有 AC 编号
 */
function extractCriteriaFromSection(
  content: string,
  sectionStart: number,
  sectionEnd: number,
  sourceFile: string
): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  const lines = content.split('\n');

  // 收集该章节内所有表格行
  for (let i = sectionStart; i < sectionEnd; i++) {
    const line = lines[i];

    // 匹配表格行: | ID | 描述 | 验证方式 |
    const tableRowMatch = line.match(
      /^\|\s*([A-Za-z][\w.-]*)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/
    );
    if (!tableRowMatch) continue;

    // 跳过分隔行
    if (/^\|[\s-:|]+\|$/.test(line)) continue;

    const rawId = tableRowMatch[1].trim();
    const description = tableRowMatch[2].trim();
    const validationMethod = tableRowMatch[3].trim();

    // 匹配 AC 编号: 2-3 个字母 + 数字，如 AG1, CM6, SH10, AO22
    const acMatch = rawId.match(/^([A-Z]{2,3})(\d+)$/);
    if (!acMatch) continue;

    const [, prefix, numStr] = acMatch;

    criteria.push({
      id: rawId,
      prefix,
      number: parseInt(numStr, 10),
      description,
      sourceFile,
      validationMethod,
    });
  }

  return criteria;
}

/**
 * 解析单个 spec 文件，提取所有验收标准
 */
function parseSpecFile(filePath: string): AcceptanceCriterion[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const section = findAcceptanceSection(content);
  if (!section) return [];

  return extractCriteriaFromSection(content, section.start, section.end, filePath);
}

/**
 * 扫描目录下所有 spec 文件
 */
function discoverSpecFiles(specDirs: string[]): string[] {
  const specFiles: string[] = [];

  for (const specDir of specDirs) {
    if (!fs.existsSync(specDir)) continue;

    const entries = fs.readdirSync(specDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        // 跳过非 spec 文件
        const skipFiles = [
          'spec-status-report.md',
          'traceability-matrix.md',
          'acceptance-criteria-traceability.md',
          'acceptance-criteria-report.json',
          'README.md',
        ];
        if (skipFiles.includes(entry.name)) continue;
        specFiles.push(path.join(specDir, entry.name));
      }
    }
  }

  return specFiles.sort();
}

// ============================== 测试文件扫描 ==============================

/**
 * 收集所有测试文件内容
 */
function collectTestContents(testDirs: string[]): Map<string, string> {
  const contents = new Map<string, string>();

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js)$/.test(entry.name)) {
        const fullPath = path.join(dir, entry.name);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          contents.set(fullPath, content);
        } catch {
          // 忽略读取失败的文件
        }
      }
    }
  }

  for (const testDir of testDirs) {
    scanDir(testDir);
  }

  return contents;
}

/**
 * 从测试文件内容中提取所有 AC 引用
 */
function extractTestReferences(
  filePath: string,
  content: string
): TestReference[] {
  const refs: TestReference[] = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const matches = [...line.matchAll(TEST_REF_PATTERN)];

    for (const match of matches) {
      const acId = match[1];
      // 验证格式: 2-3 个字母 + 数字
      if (/^[A-Z]{2,3}\d+$/.test(acId)) {
        refs.push({
          acId,
          file: path.relative(PROJECT_DIR, filePath),
          line: lineNum + 1,
          context: line.trim().slice(0, 120),
        });
      }
    }
  }

  return refs;
}

/**
 * 扫描所有测试文件，提取 AC 引用
 */
function scanAllTestReferences(testDirs: string[]): Map<string, TestReference[]> {
  // key: AC ID (e.g. "AG1"), value: list of references
  const refMap = new Map<string, TestReference[]>();
  const testFiles: string[] = [];

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js)$/.test(entry.name)) {
        testFiles.push(path.join(dir, entry.name));
      }
    }
  }

  for (const testDir of testDirs) {
    scanDir(testDir);
  }

  // 按文件排序以保证确定性输出
  testFiles.sort();

  for (const filePath of testFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const refs = extractTestReferences(filePath, content);
      for (const ref of refs) {
        const existing = refMap.get(ref.acId) || [];
        existing.push(ref);
        refMap.set(ref.acId, existing);
      }
    } catch {
      // 忽略读取失败
    }
  }

  return refMap;
}

// ============================== 验证逻辑 ==============================

interface CriterionTrace {
  id: string;
  prefix: string;
  number: number;
  description: string;
  sourceFile: string;
  validationMethod: string;
  matched: boolean;
  refs: TestReference[];
}

function buildTraceabilityReport(
  allCriteria: AcceptanceCriterion[],
  testRefMap: Map<string, TestReference[]>,
  testFiles: string[],
  threshold: number
): TraceabilityReport {
  const now = new Date().toISOString();

  // 按 AC ID 分组
  const criteriaByAcId = new Map<string, AcceptanceCriterion[]>();
  for (const criterion of allCriteria) {
    const existing = criteriaByAcId.get(criterion.id) || [];
    existing.push(criterion);
    criteriaByAcId.set(criterion.id, existing);
  }

  // 为每个 AC 编号构建追溯记录
  const criteriaTraces: CriterionTrace[] = [];
  let matchedCount = 0;
  const orphanCriteriaList: AcceptanceCriterion[] = [];
  const orphanRefsList: TestReference[] = [];

  // 获取所有有效的 AC ID
  const validAcIds = new Set<string>();
  for (const criterion of allCriteria) {
    validAcIds.add(criterion.id);
  }

  // 构建追溯
  for (const [acId, criteriaList] of criteriaByAcId) {
    const refs = testRefMap.get(acId) || [];
    const matched = refs.length > 0;

    if (matched) {
      matchedCount++;
    } else {
      // 添加到孤儿列表（取第一条描述）
      orphanCriteriaList.push({
        ...criteriaList[0],
        description: criteriaList.map(c => c.description).join('; '),
      });
    }

    criteriaTraces.push({
      id: acId,
      prefix: criteriaList[0].prefix,
      number: criteriaList[0].number,
      description: criteriaList.map(c => c.description).join('; '),
      sourceFile: criteriaList[0].sourceFile,
      validationMethod: criteriaList[0].validationMethod,
      matched,
      refs,
    });
  }

  // 按 AC ID 排序
  criteriaTraces.sort((a, b) => {
    if (a.prefix !== b.prefix) return a.prefix.localeCompare(b.prefix);
    return a.number - b.number;
  });

  // 检测孤儿测试引用（引用了不存在的 AC）
  for (const [acId, refs] of testRefMap) {
    if (!validAcIds.has(acId)) {
      orphanRefsList.push(...refs);
    }
  }

  // 按文件排序孤儿引用
  orphanRefsList.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  // 收集所有唯一的 spec 文件
  const specFilesSet = new Set<string>();
  for (const criterion of allCriteria) {
    specFilesSet.add(criterion.sourceFile);
  }
  const specFiles = [...specFilesSet].sort();

  const totalCriteria = criteriaTraces.length;
  const coveragePercent =
    totalCriteria > 0 ? Math.round((matchedCount / totalCriteria) * 100) : 0;

  const pass = orphanCriteriaList.length === 0 && coveragePercent >= threshold;

  return {
    generatedAt: now,
    threshold,
    summary: {
      totalSpecs: specFiles.length,
      totalCriteria,
      totalTestRefs: [...testRefMap.values()].reduce((sum, refs) => sum + refs.length, 0),
      matchedCriteria: matchedCount,
      orphanCriteria: orphanCriteriaList.length,
      orphanRefs: orphanRefsList.length,
      coveragePercent,
      pass,
    },
    criteria: criteriaTraces,
    orphanCriteriaList,
    orphanRefsList,
    specFiles,
    testFiles: testFiles.sort(),
  };
}

// ============================== 报告生成 ==============================

function generateMarkdownMatrix(report: TraceabilityReport): string {
  const now = new Date(report.generatedAt).toISOString().split('T')[0];
  let md = `# Spec 验收标准可追溯性矩阵\n\n`;
  md += `> **生成日期**: ${now}\n`;
  md += `> **生成工具**: \`scripts/verify-spec-traceability.ts\`\n`;
  md += `> **覆盖率阈值**: ${report.threshold}%\n\n`;

  // 概览
  md += `## 一、概览\n\n`;
  md += `| 指标 | 值 |\n|------|-----|\n`;
  md += `| Spec 文档数 | ${report.summary.totalSpecs} |\n`;
  md += `| 验收标准总数 | ${report.summary.totalCriteria} |\n`;
  md += `| 测试引用总数 | ${report.summary.totalTestRefs} |\n`;
  md += `| 已覆盖 AC | ${report.summary.matchedCriteria} |\n`;
  md += `| 孤儿 AC（无测试） | ${report.summary.orphanCriteria} |\n`;
  md += `| 孤儿引用（无效 AC） | ${report.summary.orphanRefs} |\n`;
  md += `| 覆盖率 | **${report.summary.coveragePercent}%** |\n`;
  md += `| 状态 | ${report.summary.pass ? '✅ 通过' : '❌ 未通过'} |\n\n`;

  // 按模块分组
  const moduleMap = new Map<string, CriterionTrace[]>();
  for (const criterion of report.criteria) {
    const moduleName = path.basename(path.dirname(criterion.sourceFile));
    const existing = moduleMap.get(moduleName) || [];
    existing.push(criterion);
    moduleMap.set(moduleName, existing);
  }

  // 按模块名排序
  const modules = [...moduleMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  md += `## 二、验收标准覆盖明细\n\n`;

  for (const [module, criteria] of modules) {
    const matchedInModule = criteria.filter(c => c.matched).length;
    const totalInModule = criteria.length;
    const coverage =
      totalInModule > 0 ? Math.round((matchedInModule / totalInModule) * 100) : 0;
    const statusIcon = coverage === 100 ? '✅' : coverage >= 50 ? '⚠️' : '❌';

    md += `### ${statusIcon} ${module} (${matchedInModule}/${totalInModule}, ${coverage}%)\n\n`;

    if (criteria.length > 0) {
      md += `| AC 编号 | 验收标准 | 验证方式 | 覆盖状态 | 测试引用数 |\n`;
      md += `|---------|---------|----------|----------|----------|\n`;
      for (const c of criteria) {
        const status = c.matched ? '✅ 已覆盖' : '❌ 未覆盖';
        const refCount = c.refs.length;
        const escapedDesc = c.description.replace(/\|/g, '\\|').slice(0, 60);
        md += `| ${c.id} | ${escapedDesc} | ${c.validationMethod} | ${status} | ${refCount} |\n`;
      }
      md += `\n`;
    }
  }

  // 孤儿 AC
  if (report.orphanCriteriaList.length > 0) {
    md += `## 三、孤儿验收标准（无测试引用）\n\n`;
    md += `以下验收标准未在任何测试文件中找到引用：\n\n`;
    md += `| AC 编号 | 验收标准 | Spec 文档 |\n`;
    md += `|---------|---------|----------|\n`;
    for (const c of report.orphanCriteriaList) {
      const escapedDesc = c.description.replace(/\|/g, '\\|').slice(0, 80);
      md += `| ${c.id} | ${escapedDesc} | \`${path.basename(c.sourceFile)}\` |\n`;
    }
    md += `\n`;
  }

  // 孤儿测试引用
  if (report.orphanRefsList.length > 0) {
    md += `## 四、孤儿测试引用（引用不存在的 AC）\n\n`;
    md += `以下测试引用指向未定义的验收标准编号：\n\n`;
    md += `| 引用 | 文件 | 行号 | 上下文 |\n`;
    md += `|------|------|------|--------|\n`;
    for (const ref of report.orphanRefsList) {
      const escapedCtx = ref.context.replace(/\|/g, '\\|').slice(0, 80);
      md += `| [${ref.acId}] | \`${ref.file}\` | ${ref.line} | ${escapedCtx} |\n`;
    }
    md += `\n`;
  }

  // 测试文件列表
  md += `## 五、测试文件清单\n\n`;
  md += `共扫描 ${report.testFiles.length} 个测试文件：\n\n`;
  for (const testFile of report.testFiles) {
    md += `- \`${testFile}\`\n`;
  }
  md += `\n---\n`;
  md += `_由 \`scripts/verify-spec-traceability.ts\` 自动生成_\n`;

  return md;
}

function generateJsonReport(report: TraceabilityReport): string {
  return JSON.stringify(
    {
      generated_at: report.generatedAt,
      threshold: report.threshold,
      summary: report.summary,
      spec_files: report.specFiles,
      test_files: report.testFiles,
      criteria: report.criteria.map(c => ({
        id: c.id,
        prefix: c.prefix,
        number: c.number,
        description: c.description,
        source_file: c.sourceFile,
        validation_method: c.validationMethod,
        matched: c.matched,
        ref_count: c.refs.length,
        refs: c.refs.map(r => ({
          ac_id: r.acId,
          file: r.file,
          line: r.line,
          context: r.context,
        })),
      })),
      orphan_criteria: report.orphanCriteriaList.map(c => ({
        id: c.id,
        description: c.description,
        source_file: c.sourceFile,
      })),
      orphan_refs: report.orphanRefsList.map(r => ({
        ac_id: r.acId,
        file: r.file,
        line: r.line,
        context: r.context,
      })),
    },
    null,
    2
  );
}

// ============================== 主流程 ==============================

function main(): void {
  const options = parseArgs();

  // 1. 发现所有 spec 文件
  const specFiles = discoverSpecFiles(options.specDirs);
  if (specFiles.length === 0) {
    console.error('错误: 未找到任何 spec 文件。请确认 --spec-dir 参数。');
    process.exit(1);
  }

  // 2. 解析所有验收标准
  const allCriteria: AcceptanceCriterion[] = [];
  for (const specFile of specFiles) {
    const criteria = parseSpecFile(specFile);
    allCriteria.push(...criteria);
  }

  // 3. 扫描测试引用
  const testRefMap = scanAllTestReferences(options.testDirs);
  const testFiles = [...testRefMap.values()].flat().map(r => r.file);
  const uniqueTestFiles = [...new Set(testFiles)].sort();

  // 4. 构建追溯报告
  const report = buildTraceabilityReport(
    allCriteria,
    testRefMap,
    uniqueTestFiles,
    options.threshold
  );

  // 5. 输出报告
  const reportDir = path.join(PROJECT_DIR, 'docs', 'specs');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // JSON 报告
  const jsonReportPath = path.join(reportDir, 'spec-traceability-report.json');
  fs.writeFileSync(jsonReportPath, generateJsonReport(report), 'utf-8');

  // Markdown 追溯矩阵
  const matrixPath = path.join(reportDir, 'spec-traceability-matrix.md');
  fs.writeFileSync(matrixPath, generateMarkdownMatrix(report), 'utf-8');

  // 控制台输出
  if (options.jsonOutput) {
    console.log(generateJsonReport(report));
  } else {
    console.log('='.repeat(70));
    console.log('  Spec 验收标准可追溯性验证');
    console.log('='.repeat(70));
    console.log(`  Spec 文档数:       ${report.summary.totalSpecs}`);
    console.log(`  验收标准总数:       ${report.summary.totalCriteria}`);
    console.log(`  测试引用总数:       ${report.summary.totalTestRefs}`);
    console.log(`  已覆盖 AC:          ${report.summary.matchedCriteria}`);
    console.log(`  孤儿 AC (无测试):   ${report.summary.orphanCriteria}`);
    console.log(`  孤儿引用 (无效 AC): ${report.summary.orphanRefs}`);
    console.log(`  覆盖率:             ${report.summary.coveragePercent}%`);
    console.log(`  阈值:               ${report.threshold}%`);
    console.log(`  状态:               ${report.summary.pass ? '✅ 通过' : '❌ 未通过'}`);
    console.log('='.repeat(70));

    if (report.orphanCriteriaList.length > 0) {
      console.log('\n⚠️  孤儿验收标准（无测试引用）:');
      for (const c of report.orphanCriteriaList) {
        console.log(`  - [${c.id}] ${c.description.slice(0, 60)}...`);
      }
    }

    if (report.orphanRefsList.length > 0) {
      console.log('\n⚠️  孤儿测试引用（引用不存在的 AC）:');
      for (const ref of report.orphanRefsList.slice(0, 10)) {
        console.log(`  - [${ref.acId}] @ ${ref.file}:${ref.line}`);
      }
      if (report.orphanRefsList.length > 10) {
        console.log(`  ... 还有 ${report.orphanRefsList.length - 10} 个`);
      }
    }

    if (report.summary.pass) {
      console.log('\n✓ 所有验收标准均已覆盖测试引用');
    } else {
      console.log('\n✗ 检查未通过：存在孤儿验收标准或覆盖率低于阈值');
    }
  }

  // 可选：输出 Markdown 矩阵路径
  if (options.matrixOutput) {
    console.log(`\nMarkdown 矩阵: ${matrixPath}`);
  }

  // 退出码
  if (!report.summary.pass) {
    process.exit(1);
  }
}

main();
