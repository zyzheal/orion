/**
 * Multi-Language Scanner — 多语言统一扫描入口
 *
 * 协调 TypeScript / Go / Python 三种语言的检测器，
 * 输出统一的 InteractionIssue 格式，可与前端 AST 结果聚合。
 *
 * Usage:
 *   const scanner = new MultiLangScanner();
 *   const results = await scanner.scan('orion-platform-service/src/');
 */

import { InteractionIssue, ScanResult } from './detectors/base';
import { getTsFiles, getGoFiles, getPyFiles } from './file-utils';
import { GoSqlInjectionDetector, GoSensitiveLogDetector, GoMissingAuthDetector, GoMissingErrorCheckDetector } from './detectors/go-security';
import { PySqlInjectionDetector, PySensitiveLogDetector, PyMissingAuthDetector, PyEvalInjectionDetector, PyHardcodedSecretDetector } from './detectors/python-security';
import { FrontendInteractionAnalyzer } from './ast-analyzer';

// @ts-ignore TS2591
import * as fs from 'fs';

export interface MultiLangScanResult {
  tsResults: ScanResult[];
  goResults: GoScanResult[];
  pyResults: PyScanResult[];
  totalIssues: number;
  bySeverity: Record<'P0' | 'P1' | 'P2', number>;
}

export interface GoScanResult {
  file: string;
  issues: InteractionIssue[];
}

export interface PyScanResult {
  file: string;
  issues: InteractionIssue[];
}

export class MultiLangScanner {
  /**
   * 扫描多语言代码
   */
  async scan(rootPaths: { ts?: string; go?: string; py?: string }): Promise<MultiLangScanResult> {
    const allIssues: InteractionIssue[] = [];
    let tsCount = 0, goCount = 0, pyCount = 0;

    // TypeScript (frontend + backend)
    if (rootPaths.ts) {
      console.log(`📊 扫描 TypeScript 文件: ${rootPaths.ts}`);
      const tsFiles = getTsFiles(rootPaths.ts);
      // Also scan TSX for frontend
      const { getTsxFiles } = await import('./file-utils');
      const tsxFiles = getTsxFiles(rootPaths.ts);
      const allTsFiles = [...tsFiles, ...tsxFiles];

      for (const file of allTsFiles) {
        try {
          const analyzer = new FrontendInteractionAnalyzer(file);
          const result = analyzer.analyze();
          tsCount += result.issues.length;
          allIssues.push(...result.issues);
        } catch { /* skip */ }
      }
      console.log(`  ✓ TypeScript: ${allTsFiles.length} 文件, ${tsCount} 问题`);
    }

    // Go
    if (rootPaths.go) {
      console.log(`📊 扫描 Go 文件: ${rootPaths.go}`);
      const goFiles = getGoFiles(rootPaths.go);

      for (const file of goFiles) {
        try {
          const detectors = [
            new GoSqlInjectionDetector(file),
            new GoSensitiveLogDetector(file),
            new GoMissingAuthDetector(file),
            new GoMissingErrorCheckDetector(file),
          ];

          const issues: InteractionIssue[] = [];
          for (const detector of detectors) {
            issues.push(...detector.analyze());
          }
          goCount += issues.length;
          allIssues.push(...issues);
        } catch { /* skip */ }
      }
      console.log(`  ✓ Go: ${goFiles.length} 文件, ${goCount} 问题`);
    }

    // Python
    if (rootPaths.py) {
      console.log(`📊 扫描 Python 文件: ${rootPaths.py}`);
      const pyFiles = getPyFiles(rootPaths.py);

      for (const file of pyFiles) {
        try {
          const detectors = [
            new PySqlInjectionDetector(file),
            new PySensitiveLogDetector(file),
            new PyMissingAuthDetector(file),
            new PyEvalInjectionDetector(file),
            new PyHardcodedSecretDetector(file),
          ];

          const issues: InteractionIssue[] = [];
          for (const detector of detectors) {
            issues.push(...detector.analyze());
          }
          pyCount += issues.length;
          allIssues.push(...issues);
        } catch { /* skip */ }
      }
      console.log(`  ✓ Python: ${pyFiles.length} 文件, ${pyCount} 问题`);
    }

    const p0 = allIssues.filter(i => i.severity === 'P0').length;
    const p1 = allIssues.filter(i => i.severity === 'P1').length;
    const p2 = allIssues.filter(i => i.severity === 'P2').length;

    return {
      tsResults: [],
      goResults: [],
      pyResults: [],
      totalIssues: allIssues.length,
      bySeverity: { P0: p0, P1: p1, P2: p2 },
    };
  }
}

/**
 * Format multi-language scan summary
 */
export function formatMultiLangSummary(result: MultiLangScanResult): string {
  const lines = [
    '┌────────────────────────────────────────────────────────────┐',
    '│  Multi-Language Scan Summary                               │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Total issues:         ${result.totalIssues.toString().padStart(32)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  P0 (Critical):        ${result.bySeverity.P0.toString().padStart(32)}│`,
    `│  P1 (Warning):         ${result.bySeverity.P1.toString().padStart(32)}│`,
    `│  P2 (Info):            ${result.bySeverity.P2.toString().padStart(32)}│`,
    '└────────────────────────────────────────────────────────────┘',
  ];
  return lines.join('\n');
}
