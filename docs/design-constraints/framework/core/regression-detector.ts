/**
 * Regression Detector — detects NEW issues introduced by code changes.
 *
 * Purpose: Gap 5/9 — After implementing a feature or fixing a bug, run this
 * to ensure the change didn't introduce new design-constraint violations.
 *
 * How it works:
 *   1. Scan base branch (or HEAD~1) to get baseline issues using all 33 detectors
 *   2. Scan current branch to get current issues using all 33 detectors
 *   3. Diff: new issues = current - baseline (by file:line:type)
 *   4. Report regressions with severity and suggested fix
 *
 * Usage:
 *   detectRegressions()         — compares HEAD~1 vs HEAD
 *   detectRegressions('main')   — compares main vs current branch
 */

import { InteractionIssue, ScanResult } from './detectors/base';
import { FrontendInteractionAnalyzer } from './ast-analyzer';
import { gatherProjectContext, validateWithContext, ProjectContext } from './cross-validator';
// @ts-ignore TS2591
import * as fs from 'fs';
// @ts-ignore TS2591
import * as path from 'path';
// @ts-ignore TS2591
declare const __dirname: string;
// @ts-ignore TS2591
// @ts-ignore TS2591
import * as child_process from 'child_process';

/**
 * Regression report comparing baseline vs current scan.
 */
export interface RegressionReport {
  /** New issues introduced by the current changes */
  newIssues: InteractionIssue[];
  /** Issues that were fixed (present in baseline, absent in current) */
  fixedIssues: InteractionIssue[];
  /** Issues that persist (present in both) */
  persistentIssues: InteractionIssue[];
  /** Summary statistics */
  stats: {
    baselineCount: number;
    currentCount: number;
    newCount: number;
    fixedCount: number;
    persistentCount: number;
    netChange: number;
  };
  /** Whether the change is clean (no new P0/P1 issues) */
  isClean: boolean;
}

/**
 * Options for regression detection.
 */
export interface RegressionOptions {
  /** Base branch or commit to compare against (default: 'HEAD~1') */
  baseRef?: string;
  /** File paths to scan (if not provided, scans entire project) */
  files?: string[];
  /** Root path for scanning */
  rootPath?: string;
  /** Only report P0/P1 regressions (ignore P2 noise) */
  minSeverity?: 'P0' | 'P1' | 'P2';
  /** Enable cross-validation against project context */
  enableCrossValidation?: boolean;
}

const SEVERITY_ORDER = { P0: 3, P1: 2, P2: 1 };

/**
 * Detect regressions between base and current code.
 * Uses all 33 detectors for both baseline and current scans.
 */
export async function detectRegressions(
  options: RegressionOptions = {},
): Promise<RegressionReport> {
  const {
    baseRef = 'HEAD~1',
    rootPath = 'orion-frontend/src/pages/',
    minSeverity = 'P2',
    enableCrossValidation = true,
  } = options;

  // Step 1: Get list of changed files
  const changedFiles = getChangedFiles(baseRef);
  if (changedFiles.length === 0) {
    return {
      newIssues: [],
      fixedIssues: [],
      persistentIssues: [],
      stats: { baselineCount: 0, currentCount: 0, newCount: 0, fixedCount: 0, persistentCount: 0, netChange: 0 },
      isClean: true,
    };
  }

  // Step 2: Gather project context once
  let projectContext: ProjectContext | undefined;
  if (enableCrossValidation) {
    projectContext = gatherProjectContext(rootPath);
  }

  // Step 3: Scan baseline and current using all 33 detectors
  const baselineResults = await scanFilesAtRef(baseRef, changedFiles, projectContext);
  const currentResults = await scanCurrentFiles(changedFiles, projectContext);

  // Step 4: Flatten
  const baselineIssues = flattenIssues(baselineResults);
  const currentIssues = flattenIssues(currentResults);

  // Step 5: Diff
  const baselineKeys = new Set(baselineIssues.map(issueKey));
  const currentKeys = new Set(currentIssues.map(issueKey));

  const newIssues = currentIssues.filter(i => !baselineKeys.has(issueKey(i)));
  const fixedIssues = baselineIssues.filter(i => !currentKeys.has(issueKey(i)));
  const persistentIssues = currentIssues.filter(i => baselineKeys.has(issueKey(i)));

  // Filter by severity
  const minSev = SEVERITY_ORDER[minSeverity];
  const filteredNew = newIssues.filter(i => SEVERITY_ORDER[i.severity] >= minSev);

  const netChange = newIssues.length - fixedIssues.length;

  return {
    newIssues: filteredNew,
    fixedIssues,
    persistentIssues,
    stats: {
      baselineCount: baselineIssues.length,
      currentCount: currentIssues.length,
      newCount: newIssues.length,
      fixedCount: fixedIssues.length,
      persistentCount: persistentIssues.length,
      netChange,
    },
    isClean: newIssues.filter(i => i.severity === 'P0' || i.severity === 'P1').length === 0,
  };
}

/**
 * Generate a human-readable regression report.
 */
export function formatRegressionReport(report: RegressionReport): string {
  const lines: string[] = [];

  lines.push('┌────────────────────────────────────────────────────────────┐');
  lines.push('│  Regression Detection Report                               │');
  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Baseline issues:    ${report.stats.baselineCount.toString().padStart(32)}│`);
  lines.push(`│  Current issues:     ${report.stats.currentCount.toString().padStart(32)}│`);
  lines.push(`│  NEW issues:         ${report.stats.newCount.toString().padStart(32)}│`);
  lines.push(`│  FIXED issues:       ${report.stats.fixedCount.toString().padStart(32)}│`);
  lines.push(`│  Persistent issues:  ${report.stats.persistentCount.toString().padStart(32)}│`);
  lines.push(`│  Net change:         ${report.stats.netChange > 0 ? '+' : ''}${report.stats.netChange.toString().padStart(31)}│`);
  lines.push(`│  Clean (no P0/P1):   ${(report.isClean ? 'YES' : 'NO').padStart(32)}│`);
  lines.push('├────────────────────────────────────────────────────────────┤');

  if (report.newIssues.length > 0) {
    lines.push('│  NEW Issues (regressions):                               │');
    for (const issue of report.newIssues) {
      const shortFile = issue.file.split('/').slice(-2).join('/');
      lines.push(`│  [${issue.severity}] ${shortFile}:${issue.line} — ${issue.type.padEnd(30)}│`);
    }
    lines.push('├────────────────────────────────────────────────────────────┤');
  }

  if (report.fixedIssues.length > 0) {
    lines.push(`│  FIXED issues: ${report.fixedIssues.length}                                     │`);
    lines.push('├────────────────────────────────────────────────────────────┤');
  }

  lines.push(report.isClean
    ? '│  ✓ No P0/P1 regressions introduced                    │'
    : '│  ✗ P0/P1 regressions detected — must fix before merge │',
  );
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

// ── Internal helpers ──

function issueKey(issue: InteractionIssue): string {
  return `${issue.file}:${issue.line}:${issue.type}`;
}

function flattenIssues(results: ScanResult[]): InteractionIssue[] {
  const all: InteractionIssue[] = [];
  for (const r of results) {
    all.push(...r.issues);
  }
  return all;
}

function getChangedFiles(baseRef: string): string[] {
  try {
    const output = child_process.execSync(
      `git diff --name-only ${baseRef} -- '*.tsx' '*.ts'`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    );
    return output.split('\n').filter((f: string) => f.length > 0);
  } catch {
    return [];
  }
}

/**
 * Scan files at a git ref using ALL 33 detectors.
 * Writes content to temp file so FrontendInteractionAnalyzer can reuse
 * the full detector pipeline (not just 2 regex checks).
 */
async function scanFilesAtRef(
  ref: string,
  files: string[],
  projectContext: ProjectContext | undefined,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const tempDir = path.join(__dirname, '.temp-regression');

  for (const file of files) {
    try {
      const content = child_process.execSync(
        `git show ${ref}:${file}`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
      );

      // Write to temp file so FrontendInteractionAnalyzer can use all 33 detectors
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, path.basename(file));
      fs.writeFileSync(tempFile, content, 'utf-8');

      // Override filePath in the result to the real path (not temp)
      const analyzer = new FrontendInteractionAnalyzer(tempFile);
      let result = analyzer.analyze();
      // Fix file paths back to real paths
      result.file = file;
      for (const issue of result.issues) {
        issue.file = file;
      }

      if (projectContext) {
        result = validateWithContext(result, projectContext);
      }

      results.push(result);
      fs.unlinkSync(tempFile);
    } catch {
      // File may not exist at this ref
    }
  }

  // Clean up temp dir
  try { fs.rmdirSync(tempDir); } catch { /* ignore */ }

  return results;
}

async function scanCurrentFiles(
  files: string[],
  projectContext: ProjectContext | undefined,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const analyzer = new FrontendInteractionAnalyzer(file);
      let result = analyzer.analyze();

      if (projectContext) {
        result = validateWithContext(result, projectContext);
      }

      results.push(result);
    } catch {
      // Skip unparseable files
    }
  }

  return results;
}
