/**
 * 前端响应嵌套模式扫描脚本
 *
 * 扫描所有页面中 `.data.data`、`as any` 等嵌套解包模式，
 * 输出报告供 codemod 脚本批量修复。
 *
 * 用法:
 *   npx tsx scripts/scan-nesting-patterns.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface NestingIssue {
  file: string;
  line: number;
  pattern: string;
  context: string;
  severity: 'high' | 'medium' | 'low';
}

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next', '__tests__', '__snapshots__'].includes(entry.name)) continue;
      results.push(...findFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const NESTING_PATTERNS: { regex: RegExp; pattern: string; severity: 'high' | 'medium' | 'low' }[] = [
  // .data.data 双层嵌套
  { regex: /\.data\.data\b/g, pattern: '.data.data', severity: 'high' },
  // .data.data.data 三层嵌套
  { regex: /\.data\.data\.data\b/g, pattern: '.data.data.data', severity: 'high' },
  // (res.data as any) 类型断言
  { regex: /\(.*?\.data\s+as\s+any\)/g, pattern: '(response.data as any)', severity: 'medium' },
  // (res.data)?.data ?? res.data 兼容写法
  { regex: /\??\.data\s*\?\?\s*(res|response)\.data/g, pattern: '.data ?? response.data', severity: 'medium' },
  // response.data as any
  { regex: /response\.data\s+as\s+any/g, pattern: 'response.data as any', severity: 'medium' },
  // res.data as any
  { regex: /res\.data\s+as\s+any/g, pattern: 'res.data as any', severity: 'medium' },
  // body?.data ?? body 兼容写法
  { regex: /body\??\.data\s*\?\?\s*body/g, pattern: 'body?.data ?? body', severity: 'low' },
];

function scanFile(filePath: string, rootDir: string): NestingIssue[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(rootDir, filePath);
  const issues: NestingIssue[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { regex, pattern, severity } of NESTING_PATTERNS) {
      // 重置 regex lastIndex
      regex.lastIndex = 0;
      if (regex.test(line)) {
        // 跳过注释行
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        issues.push({
          file: relativePath,
          line: i + 1,
          pattern,
          context: trimmed.slice(0, 120),
          severity,
        });
      }
    }
  }

  return issues;
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const frontendDir = path.resolve(__dirname, '../../orion-frontend/src');
  if (!fs.existsSync(frontendDir)) {
    console.error(`Frontend src directory not found: ${frontendDir}`);
    process.exit(1);
  }

  const files = findFiles(frontendDir, ['.ts', '.tsx']);
  console.log(`Scanning ${files.length} TypeScript files...`);

  const allIssues: NestingIssue[] = [];
  for (const file of files) {
    const issues = scanFile(file, frontendDir);
    allIssues.push(...issues);
  }

  // 统计
  const highCount = allIssues.filter(i => i.severity === 'high').length;
  const mediumCount = allIssues.filter(i => i.severity === 'medium').length;
  const lowCount = allIssues.filter(i => i.severity === 'low').length;
  const uniqueFiles = new Set(allIssues.map(i => i.file)).size;

  console.log(`\nFound ${allIssues.length} issues in ${uniqueFiles} files:`);
  console.log(`  HIGH:   ${highCount}`);
  console.log(`  MEDIUM: ${mediumCount}`);
  console.log(`  LOW:    ${lowCount}`);

  // 按模式分组
  console.log('\n' + '='.repeat(80));
  console.log('By Pattern:');
  console.log('-'.repeat(80));

  const patternCounts = new Map<string, number>();
  for (const issue of allIssues) {
    patternCounts.set(issue.pattern, (patternCounts.get(issue.pattern) || 0) + 1);
  }

  for (const [pattern, count] of [...patternCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern.padEnd(30)} ${count} occurrences`);
  }

  // 按文件分组（前 20 个最多问题的文件）
  console.log('\n' + '='.repeat(80));
  console.log('Top 20 Files by Issue Count:');
  console.log('-'.repeat(80));

  const fileCounts = new Map<string, number>();
  for (const issue of allIssues) {
    fileCounts.set(issue.file, (fileCounts.get(issue.file) || 0) + 1);
  }

  const topFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [file, count] of topFiles) {
    console.log(`  ${count.toString().padStart(3)} issues  ${file}`);
  }

  // 输出 CSV 报告
  const outputFile = path.resolve(__dirname, '../../orion-frontend/nesting-issues-scan.csv');
  const csvLines = ['severity,file,line,pattern,context'];
  for (const issue of allIssues) {
    csvLines.push(
      `${issue.severity},"${issue.file}",${issue.line},"${issue.pattern}","${issue.context.replace(/"/g, '""')}"`
    );
  }
  fs.writeFileSync(outputFile, csvLines.join('\n'));
  console.log(`\nCSV report written to: ${outputFile}`);
}

main();
