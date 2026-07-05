/**
 * 错误码扫描脚本
 *
 * 扫描所有路由文件中的自由字符串错误码（未注册的错误码），
 * 输出为 CSV 供映射到新枚举。
 *
 * 用法:
 *   npx tsx scripts/scan-error-codes.ts [扫描目录]
 *
 * 示例:
 *   npx tsx scripts/scan-error-codes.ts src/api/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface ErrorCodeOccurrence {
  file: string;
  line: number;
  code: string;
  context: string;
  httpStatus?: number;
}

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '__tests__', '__snapshots__'].includes(entry.name)) continue;
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractErrorCodesFromFile(filePath: string, rootDir: string): ErrorCodeOccurrence[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const occurrences: ErrorCodeOccurrence[] = [];
  const relativePath = path.relative(rootDir, filePath);

  // 匹配 reply.status(NNN).send({ error: 'CODE', ... }) 或 reply.code(NNN).send({ error: 'CODE' })
  // 也匹配 { error: 'CODE', message: '...' } 模式
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配 send({ error: 'XXX' 或 send({ code: 'XXX'
    const sendErrorMatch = line.match(/\.send\s*\(\s*\{[^}]*error:\s*['"]([A-Z_]+)['"]/i);
    const codeMatch = line.match(/\.send\s*\(\s*\{[^}]*code:\s*['"]([A-Z_]+)['"]/i);
    const statusMatch = line.match(/reply\.(status|code)\s*\(\s*(\d{3})\s*\)/);

    if (sendErrorMatch || codeMatch) {
      const code = sendErrorMatch ? sendErrorMatch[1] : codeMatch![1];
      // 跳过已知的枚举引用（如 ErrorCode.NOT_FOUND）
      if (line.includes('ErrorCode.') || line.includes('ErrorCodes.')) continue;
      // 跳过已经是大写+点号分层的格式（如 BIZ.TENANT.001）
      if (code.includes('.')) continue;

      const context = line.trim().slice(0, 120);
      occurrences.push({
        file: relativePath,
        line: i + 1,
        code,
        context,
        httpStatus: statusMatch ? parseInt(statusMatch[2], 10) : undefined,
      });
    }
  }

  return occurrences;
}

function main() {
  const scanDir = process.argv[2] || 'src/api';
  const rootDir = process.cwd();
  const fullPath = path.resolve(rootDir, scanDir);

  if (!fs.existsSync(fullPath)) {
    console.error(`Directory not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`Scanning: ${fullPath}`);
  const files = findTsFiles(fullPath);
  console.log(`Found ${files.length} TypeScript files`);

  const allOccurrences: ErrorCodeOccurrence[] = [];
  for (const file of files) {
    const occurrences = extractErrorCodesFromFile(file, rootDir);
    allOccurrences.push(...occurrences);
  }

  // 去重并按代码分组
  const codeMap = new Map<string, ErrorCodeOccurrence[]>();
  for (const occ of allOccurrences) {
    const existing = codeMap.get(occ.code) || [];
    existing.push(occ);
    codeMap.set(occ.code, existing);
  }

  // 输出统计
  console.log(`\nFound ${allOccurrences.length} occurrences of ${codeMap.size} unique error codes`);
  console.log('='.repeat(80));

  // 输出 CSV
  const csvLines = ['file,line,code,http_status,context'];
  for (const [code, occurrences] of codeMap) {
    for (const occ of occurrences) {
      csvLines.push(
        `"${occ.file}",${occ.line},"${occ.code}",${occ.httpStatus || ''},"${occ.context.replace(/"/g, '""')}"`
      );
    }
  }

  const outputFile = path.join(rootDir, 'error-codes-scan.csv');
  fs.writeFileSync(outputFile, csvLines.join('\n'));
  console.log(`CSV written to: ${outputFile}`);

  // 输出汇总表格
  console.log('\nError Code Summary:');
  console.log('-'.repeat(80));
  console.log(`${'Code'.padEnd(40)} | ${'Count'.padEnd(6)} | ${'HTTP Status'.padEnd(12)} | First Occurrence`);
  console.log('-'.repeat(80));

  for (const [code, occurrences] of [...codeMap.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const firstHttp = occurrences.find(o => o.httpStatus)?.httpStatus;
    console.log(
      `${code.padEnd(40)} | ${String(occurrences.length).padEnd(6)} | ${String(firstHttp || '-').padEnd(12)} | ${occurrences[0].file}:${occurrences[0].line}`
    );
  }

  // 输出建议映射
  console.log('\n'.repeat(2));
  console.log('Suggested Mapping to New Error Codes:');
  console.log('-'.repeat(80));

  for (const code of [...codeMap.keys()].sort()) {
    const occurrences = codeMap.get(code)!;
    const httpStatus = occurrences.find(o => o.httpStatus)?.httpStatus;
    let suggestedCode = '';

    // 基于代码名称和 HTTP 状态的建议映射
    if (code.includes('NOT_FOUND') || code.includes('NOTFOUND') || httpStatus === 404) {
      suggestedCode = "CLIENT.404.001";
    } else if (code.includes('UNAUTHORIZED') || code.includes('UNAUTH') || httpStatus === 401) {
      suggestedCode = "CLIENT.401.001";
    } else if (code.includes('FORBIDDEN') || code.includes('PERMISSION') || httpStatus === 403) {
      suggestedCode = "CLIENT.403.001";
    } else if (code.includes('INVALID') || code.includes('VALIDATION') || httpStatus === 400) {
      suggestedCode = "CLIENT.400.001";
    } else if (code.includes('CONFLICT') || code.includes('DUPLICATE') || code.includes('EXISTS') || httpStatus === 409) {
      suggestedCode = "CLIENT.409.001";
    } else if (code.includes('INTERNAL') || code.includes('SERVER') || httpStatus === 500) {
      suggestedCode = "SYS.500.001";
    } else if (code.includes('UNAVAILABLE') || httpStatus === 503) {
      suggestedCode = "SYS.503.001";
    } else if (code.includes('TIMEOUT') || httpStatus === 504) {
      suggestedCode = "SYS.504.001";
    } else {
      suggestedCode = "BIZ.COMMON.001";
    }

    console.log(`  ${code.padEnd(35)} -> ${suggestedCode}  (${occurrences.length} occurrences)`);
  }
}

main();
