#!/usr/bin/env node
/**
 * CLI entry point for the Design Constraint AST detection engine.
 *
 * Allows agents and skills to invoke AST checks via command line,
 * since agent environments cannot directly import TypeScript modules.
 *
 * Usage:
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --scan <rootPath> [--max-files N] [--min-confidence N]
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --verify <filePath>
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --compliance <filePath>
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --regression [--base-ref REF]
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --fp <issueType> <file>:<line> --reason "原因说明"
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --fp-stats
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --fp-recalibrate
 *   npx tsx docs/design-constraints/framework/core/cli-check.ts --help
 *
 * All output is JSON formatted for machine consumption by agents/CI tools.
 */

import {
  runInteractiveScan,
  verifyInteractionChain,
  verifyOrionCompliance,
  detectRegressions,
  formatRegressionReport,
} from './ast-analyzer';
import {
  logFalsePositive,
  recalibrateConfidences,
  getAdjustedConfidence,
  getStatsForType,
  getFPSummary,
  getTruePositiveCount,
  generateConfidenceFilters,
  FalsePositiveReport,
  FPStats,
} from './false-positive-logger';
import { InteractionIssueType } from './detectors/base';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ──

function printHelp(): void {
  const help = `
Design Constraint AST Check CLI

Usage:
  npx tsx cli-check.ts --scan <rootPath> [options]    Full AST scan of a directory
  npx tsx cli-check.ts --scan-full <rootPath> [opts]  Full scan: AST + C/D/S layers
  npx tsx cli-check.ts --verify <filePath>             Single-file interaction chain verification
  npx tsx cli-check.ts --compliance <filePath>         Orion spec compliance check
  npx tsx cli-check.ts --regression [options]          Regression detection against base ref
  npx tsx cli-check.ts --fp <issueType> <file>:<line>  Log a false positive report
  npx tsx cli-check.ts --fp-stats                      View false positive statistics
  npx tsx cli-check.ts --fp-recalibrate                Recalibrate confidence scores
  npx tsx cli-check.ts --fp-filter                     Generate auto-confidence filters
  npx tsx cli-check.ts --find-root                     Auto-detect project root path
  npx tsx cli-check.ts --pipeline <path> [--max-files N]  Full pipeline: scan → route by skill → report
  npx tsx cli-check.ts --dep-impact <targetFile>       Analyze dependency impact for a target file
  npx tsx cli-check.ts --version                       Show skill version matrix
  npx tsx cli-check.ts --auto-fp                       Auto-detect likely false positives
  npx tsx cli-check.ts --degraded-test                 Run degraded mode verification
  npx tsx cli-check.ts --scan-ts <rootPath>            Scan backend .ts files (not just .tsx)
  npx tsx cli-check.ts --help                          Show this help

Commands:

  --scan <rootPath>
    Scan all TSX files under rootPath using all 33 interaction detectors.
    Output: JSON array of AggregatedIssue[]

    Options:
      --max-files N          Maximum files to scan (default: 100)
      --min-confidence N     Minimum confidence score 0-100 (default: 50)
      --no-cross-validation  Disable cross-validation against project context
      --no-dedup             Disable issue deduplication

  --scan-full <rootPath>
    Full-spectrum scan: AST detectors + C (operations) + D (experience) + S (security).
    All issues unified to UnifiedIssue[] format with dimension/source fields.

    Options:
      --max-files N          Maximum files per analyzer (default: 100)
      --min-confidence N     Minimum confidence score 0-100 (default: 50)
      --no-dedup             Disable issue deduplication
      --include-docs         Also scan documentation files (C8/D layers)

  --verify <filePath>
    Verify the 8-item interaction chain for a single TSX file.
    Checks: handlers, feedback, loading, empty, submit, edit, tokens, states.
    Output: JSON VerificationReport

  --compliance <filePath>
    Check Orion Design Token and spec compliance for a single TSX file.
    Checks: hardcoded colors, hardcoded px, token imports.
    Output: JSON VerificationReport

  --regression
    Detect new issues introduced by code changes.
    Output: JSON RegressionReport

    Options:
      --base-ref REF         Base branch or commit (default: HEAD~1)
      --root-path PATH       Root path for scanning (default: orion-frontend/src/pages/)
      --min-severity LEVEL   Minimum severity: P0, P1, P2 (default: P2)

  --fp <issueType> <file>:<line> --reason "..."
    Log a false positive report for an issue type at a specific file/line.
    Output: JSON FalsePositiveReport

    Options:
      --reason "text"        Reason why this is a false positive (required)

  --fp-stats
    View false positive statistics for all issue types.
    Output: JSON Record<IssueType, FPStats>

  --fp-recalibrate
    Recompute all issue-type confidences from the false positive log.
    Output: JSON Record<IssueType, FPStats>

  --fp-filter
    Generate auto-confidence filters based on FP history.
    Output: Generated TypeScript code for CONFIDENCE_FILTERS

Examples:

  # Scan frontend pages directory
  npx tsx cli-check.ts --scan orion-frontend/src/pages/ --max-files 50

  # Verify a single file's interaction chain
  npx tsx cli-check.ts --verify orion-frontend/src/pages/DashboardNew/index.tsx

  # Check Design Token compliance
  npx tsx cli-check.ts --compliance orion-frontend/src/pages/Console/index.tsx

  # Detect regressions against main branch
  npx tsx cli-check.ts --regression --base-ref main

  # Log a false positive
  npx tsx cli-check.ts --fp missing-loading orion-frontend/src/pages/DashboardNew/index.tsx:42 --reason "Has global loading interceptor"

  # View false positive statistics
  npx tsx cli-check.ts --fp-stats

  # Recalibrate confidence scores
  npx tsx cli-check.ts --fp-recalibrate

  # Auto pipeline: scan → route → generate fix plan
  npx tsx cli-check.ts --pipeline orion-frontend/src/pages/DashboardNew/

Error handling:

  All errors are returned as JSON objects with { "error": string, "details": string }
  so that calling tools can parse and act on failures programmatically.
`.trimStart();
  console.log(help);
}

function errorJSON(message: string, details?: string): string {
  return JSON.stringify({ error: message, details: details ?? '' }, null, 2);
}

function resolveProjectPath(p: string): string {
  // If already absolute, return as-is
  if (p.startsWith('/')) return p;

  // Try multiple strategies to find project root
  let cwd = process.cwd();

  // Strategy 1: If we're inside the project, find the root containing 'docs/' or 'orion-frontend/'
  let current = cwd;
  for (let depth = 0; depth < 6; depth++) {
    if (
      fs.existsSync(path.join(current, 'docs', 'design-constraints')) ||
      fs.existsSync(path.join(current, 'orion-frontend')) ||
      fs.existsSync(path.join(current, 'orion-platform-service'))
    ) {
      return path.join(current, p);
    }
    const parent = path.dirname(current);
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }

  // Strategy 2: Fallback to cwd
  return path.join(cwd, p);
}

// ── Argument parsing ──

interface CliArgs {
  command: string | null;
  positional: string[];
  maxFiles: number;
  minConfidence: number;
  baseRef: string;
  rootPath: string;
  minSeverity: 'P0' | 'P1' | 'P2';
  crossValidation: boolean;
  dedup: boolean;
  includeDocs: boolean;
  // Pipeline mode
  pipeline: boolean;
  // False positive CLI args
  fpIssueType: string | null;
  fpFile: string;
  fpLine: number;
  fpReason: string;
  fpStats: boolean;
  fpRecalibrate: boolean;
  fpFilter: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: null,
    positional: [],
    maxFiles: 100,
    minConfidence: 50,
    baseRef: 'HEAD~1',
    rootPath: 'orion-frontend/src/pages/',
    minSeverity: 'P2',
    crossValidation: true,
    dedup: true,
    includeDocs: false,
    pipeline: false,
    fpIssueType: null,
    fpFile: '',
    fpLine: 0,
    fpReason: '',
    fpStats: false,
    fpRecalibrate: false,
    fpFilter: false,
  };

  const raw = argv.slice(2);
  let i = 0;

  while (i < raw.length) {
    const arg = raw[i];

    switch (arg) {
      case '--scan':
      case '--scan-full':
      case '--verify':
      case '--compliance':
      case '--regression':
      case '--help':
        args.command = arg.replace('--', '');
        break;
      case '--max-files':
        args.maxFiles = parseInt(raw[++i], 10) || 100;
        break;
      case '--min-confidence':
        args.minConfidence = parseInt(raw[++i], 10) || 50;
        break;
      case '--base-ref':
        args.baseRef = raw[++i] || 'HEAD~1';
        break;
      case '--root-path':
        args.rootPath = raw[++i] || 'orion-frontend/src/pages/';
        break;
      case '--min-severity':
        args.minSeverity = (raw[++i] || 'P2') as 'P0' | 'P1' | 'P2';
        break;
      case '--no-cross-validation':
        args.crossValidation = false;
        break;
      case '--no-dedup':
        args.dedup = false;
        break;
      case '--include-docs':
        args.includeDocs = true;
        break;
      case '--pipeline':
        args.command = 'pipeline';
        args.pipeline = true;
        break;
      case '--fp':
        args.command = 'fp';
        // Parse remaining FP args: <issueType> <file>:<line> --reason "..."
        const fpParts: string[] = [];
        let reasonVal = '';
        let j = i + 1;
        while (j < raw.length) {
          if (raw[j] === '--reason') {
            reasonVal = raw[++j] || '';
          } else if (raw[j].startsWith('--')) {
            break;
          } else {
            fpParts.push(raw[j]);
          }
          j++;
        }
        if (fpParts.length >= 2) {
          args.fpIssueType = fpParts[0];
          const fileLine = fpParts[1].split(':');
          args.fpFile = fileLine[0];
          args.fpLine = parseInt(fileLine[1] || '0', 10);
        }
        args.fpReason = reasonVal;
        i = j - 1;
        break;
      case '--fp-stats':
        args.command = 'fp-stats';
        break;
      case '--fp-recalibrate':
        args.command = 'fp-recalibrate';
        break;
      case '--fp-filter':
        args.command = 'fp-filter';
        break;
      case '--find-root':
        args.command = 'find-root';
        break;
      case '--pipeline':
        args.command = 'pipeline';
        args.pipeline = true;
        break;
      case '--dep-impact':
        args.command = 'dep-impact';
        break;
      case '--version':
        args.command = 'version';
        break;
      case '--auto-fp':
        args.command = 'auto-fp';
        break;
      case '--degraded-test':
        args.command = 'degraded-test';
        break;
      case '--scan-ts':
        args.command = 'scan-ts';
        break;
      default:
        if (!arg.startsWith('--')) {
          args.positional.push(arg);
        }
    }
    i++;
  }

  return args;
}

// ── Command handlers ──

async function cmdScan(args: CliArgs): Promise<void> {
  const rootPath = args.positional[0] || args.rootPath;
  const resolvedPath = resolveProjectPath(rootPath);

  // Silence console.log from the scanner (progress messages), keep only JSON output
  const originalLog = console.log;
  console.log = () => {};

  try {
    const issues = await runInteractiveScan(resolvedPath, args.maxFiles, {
      minConfidence: args.minConfidence,
      enableCrossValidation: args.crossValidation,
      enableDedup: args.dedup,
    });
    console.log = originalLog;
    console.log(JSON.stringify(issues, null, 2));
  } catch (err: unknown) {
    console.log = originalLog;
    if (err instanceof Error) {
      console.error(errorJSON('Scan failed', err.message));
    } else {
      console.error(errorJSON('Scan failed', String(err)));
    }
    process.exit(1);
  }
}

/**
 * --scan-full: Full-spectrum scan combining AST + C/D/S analyzers.
 * All issues are converted to UnifiedIssue format for unified consumption.
 */
async function cmdScanFull(args: CliArgs): Promise<void> {
  const rootPath = args.positional[0] || 'orion-frontend/src/';
  const resolvedPath = resolveProjectPath(rootPath);

  const originalLog = console.log;
  console.log = () => {};

  try {
    const { toUnifiedIssue, finalizeIssue } = await import('./detectors/base');
    const { aggregateResults, AggregationResult } = await import('./issue-aggregator');

    // Phase 1: Run AST detectors (existing)
    const astResults = await runInteractiveScan(resolvedPath, args.maxFiles, {
      minConfidence: args.minConfidence,
      enableCrossValidation: args.crossValidation,
      enableDedup: args.dedup,
    });

    // Convert AST results to UnifiedIssue format
    const allUnified: Array<Record<string, unknown>> = astResults.map((issue: any) =>
      toUnifiedIssue({
        file: issue.file,
        line: issue.line,
        column: issue.column,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
        dimension: inferDimension(issue.type),
        checkId: issue.checkId,
        confidence: issue.confidence,
        source: 'ast',
        requiresConfirmation: issue.requiresConfirmation,
      })
    );

    // Phase 2: Run C (operations) analyzer
    try {
      const { COperationsScanner, OperationsIssue, OperationsIssueType } = await import('./c-operations-analyzer');
      const cScanner = new COperationsScanner();
      const cResults = cScanner.scanDirectory(resolvedPath);

      for (const result of cResults) {
        for (const issue of (result as any).issues || []) {
          allUnified.push(
            toUnifiedIssue({
              file: issue.file,
              line: issue.line,
              column: issue.column || 1,
              type: issue.type,
              severity: issue.severity,
              message: issue.message,
              suggestion: issue.suggestion,
              dimension: 'C',
              checkId: issue.checkId,
              confidence: issue.confidence ?? 60,
              source: 'operations',
            })
          );
        }
      }
    } catch (e: unknown) {
      // C analyzer may fail gracefully — log but continue
      console.log = originalLog;
      console.error(errorJSON('C operations scan failed', e instanceof Error ? e.message : String(e)));
    }

    // Phase 3: Run D (experience) analyzer
    try {
      const { DExperienceScanner } = await import('./d-experience-analyzer');
      const dScanner = new DExperienceScanner(resolvedPath);
      const dResults = dScanner.scanDirectory(resolvedPath);

      for (const result of dResults) {
        for (const issue of (result as any).issues || []) {
          allUnified.push(
            toUnifiedIssue({
              file: issue.file,
              line: issue.line,
              column: issue.column || 1,
              type: issue.type,
              severity: issue.severity,
              message: issue.message,
              suggestion: issue.suggestion,
              dimension: 'D',
              checkId: issue.checkId,
              confidence: issue.confidence ?? 60,
              source: 'experience',
            })
          );
        }
      }
    } catch (e: unknown) {
      console.log = originalLog;
      console.error(errorJSON('D experience scan failed', e instanceof Error ? e.message : String(e)));
    }

    // Phase 4: Run S (security) analyzer
    try {
      const { SSecurityScanner } = await import('./s-security-analyzer');
      const frontendPath = resolvedPath.includes('src/') ? resolvedPath : `${resolvedPath.replace(/\/$/, '')}/orion-frontend/src/pages/`;
      const backendPath = `${resolvedPath.replace(/\/$/, '')}/orion-platform-service/src/services/`;
      const sScanner = new SSecurityScanner(frontendPath, backendPath);
      const sResults = await sScanner.scan(args.maxFiles, args.maxFiles);

      for (const issue of sResults) {
        allUnified.push(
          toUnifiedIssue({
            file: issue.file,
            line: issue.line,
            column: issue.column || 1,
            type: issue.type,
            severity: issue.severity,
            message: issue.message,
            suggestion: issue.suggestion,
            dimension: 'S',
            checkId: issue.checkId,
            confidence: issue.confidence ?? 70,
            source: 'security',
          })
        );
      }
    } catch (e: unknown) {
      console.log = originalLog;
      console.error(errorJSON('S security scan failed', e instanceof Error ? e.message : String(e)));
    }

    // Deduplicate by file:line:type key
    const seen = new Map<string, Record<string, unknown>>();
    for (const issue of allUnified) {
      const key = `${issue.file}:${issue.line}:${issue.type}`;
      if (!seen.has(key)) {
        seen.set(key, issue);
      }
    }
    const deduped = Array.from(seen.values());

    // Filter by confidence
    const filtered = deduped.filter(i => (i.confidence as number) >= args.minConfidence);

    // Stats
    const stats = {
      totalIssues: filtered.length,
      beforeDedup: allUnified.length,
      dedupRate: allUnified.length > 0 ? ((allUnified.length - filtered.length) / allUnified.length * 100).toFixed(1) : '0',
      bySeverity: { P0: 0, P1: 0, P2: 0 },
      byDimension: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };
    for (const issue of filtered) {
      const sev = issue.severity as string;
      if (stats.bySeverity[sev] !== undefined) stats.bySeverity[sev]++;
      const dim = issue.dimension as string;
      stats.byDimension[dim] = (stats.byDimension[dim] || 0) + 1;
      const src = issue.source as string;
      stats.bySource[src] = (stats.bySource[src] || 0) + 1;
    }

    console.log = originalLog;
    console.log(JSON.stringify({
      scanRoot: resolvedPath,
      stats,
      issues: filtered.sort((a: any, b: any) => {
        const sevOrder = { P0: 0, P1: 1, P2: 2 };
        return (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
      }),
    }, null, 2));
  } catch (err: unknown) {
    console.log = originalLog;
    if (err instanceof Error) {
      console.error(errorJSON('Full scan failed', err.message));
    } else {
      console.error(errorJSON('Full scan failed', String(err)));
    }
    process.exit(1);
  }
}

/**
 * Infer issue dimension from issue type string.
 */
function inferDimension(type: string): 'A' | 'B1' | 'B2' | 'C' | 'D' | 'S' {
  if (type.startsWith('missing-lazy') || type.startsWith('missing-request')) return 'B2';
  if (type.startsWith('missing-auth') || type.startsWith('missing-tenant') || type.startsWith('missing-sql') ||
      type.startsWith('missing-sensitive') || type.startsWith('missing-cors')) return 'S';
  if (type.startsWith('token-violation') || type.startsWith('missing-error-boundary') || type.startsWith('missing-props-type')) return 'A';
  return 'A'; // default for interaction issues
}

async function cmdVerify(args: CliArgs): Promise<void> {
  const filePath = args.positional[0];
  if (!filePath) {
    console.error(errorJSON('Missing file path', 'Usage: --verify <filePath>'));
    process.exit(1);
  }

  const resolvedPath = resolveProjectPath(filePath);

  try {
    if (!fs.existsSync(resolvedPath)) {
      console.error(errorJSON('File not found', resolvedPath));
      process.exit(1);
    }

    const report = verifyInteractionChain(resolvedPath);
    console.log(JSON.stringify(report, null, 2));

    if (!report.isCompliant) {
      process.exit(2);
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Verification failed', err.message));
    } else {
      console.error(errorJSON('Verification failed', String(err)));
    }
    process.exit(1);
  }
}

async function cmdCompliance(args: CliArgs): Promise<void> {
  const filePath = args.positional[0];
  if (!filePath) {
    console.error(errorJSON('Missing file path', 'Usage: --compliance <filePath>'));
    process.exit(1);
  }

  const resolvedPath = resolveProjectPath(filePath);

  try {
    if (!fs.existsSync(resolvedPath)) {
      console.error(errorJSON('File not found', resolvedPath));
      process.exit(1);
    }

    const report = verifyOrionCompliance(resolvedPath);
    console.log(JSON.stringify(report, null, 2));

    if (!report.isCompliant) {
      process.exit(2);
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Compliance check failed', err.message));
    } else {
      console.error(errorJSON('Compliance check failed', String(err)));
    }
    process.exit(1);
  }
}

async function cmdRegression(args: CliArgs): Promise<void> {
  // Silence console.log from the scanner (progress messages)
  const originalLog = console.log;
  console.log = () => {};

  try {
    const report = await detectRegressions({
      baseRef: args.baseRef,
      rootPath: args.rootPath,
      minSeverity: args.minSeverity,
      enableCrossValidation: args.crossValidation,
    });
    console.log = originalLog;
    console.log(JSON.stringify(report, null, 2));

    if (!report.isClean) {
      process.exit(2);
    }
  } catch (err: unknown) {
    console.log = originalLog;
    if (err instanceof Error) {
      console.error(errorJSON('Regression check failed', err.message));
    } else {
      console.error(errorJSON('Regression check failed', String(err)));
    }
    process.exit(1);
  }
}

// ── False Positive command handlers ──

function cmdFalsePositive(args: CliArgs): void {
  if (!args.fpIssueType) {
    console.error(errorJSON('Missing issue type', 'Usage: --fp <issueType> <file>:<line> --reason "..."'));
    process.exit(1);
  }
  if (!args.fpFile || args.fpLine === 0) {
    console.error(errorJSON('Missing file:line', 'Usage: --fp <issueType> <file>:<line> --reason "..."'));
    process.exit(1);
  }
  if (!args.fpReason) {
    console.error(errorJSON('Missing reason', 'Usage: --fp <issueType> <file>:<line> --reason "..."'));
    process.exit(1);
  }

  const issueType = args.fpIssueType as InteractionIssueType;
  const resolvedFile = resolveProjectPath(args.fpFile);
  const baseConfidence = 90;

  const issue = {
    file: resolvedFile,
    line: args.fpLine,
    column: 0,
    type: issueType,
    severity: 'P2' as const,
    message: `False positive: ${issueType}`,
    suggestion: '',
    confidence: baseConfidence,
  };

  logFalsePositive(issue, args.fpReason, 'cli-check');

  const stats = getStatsForType(issueType);
  const adjustedConfidence = getAdjustedConfidence(issueType, baseConfidence);

  const result = {
    success: true,
    report: {
      issueType,
      file: resolvedFile,
      line: args.fpLine,
      reason: args.fpReason,
      timestamp: new Date().toISOString(),
    },
    stats,
    adjustedConfidence,
  };

  console.log(JSON.stringify(result, null, 2));
}

function cmdFPStats(): void {
  try {
    const logFile = path.join(__dirname, 'false-positive-log.json');

    if (!fs.existsSync(logFile)) {
      console.log(JSON.stringify({ totalReports: 0, byType: {}, message: 'No false positive reports found' }, null, 2));
      return;
    }

    const log: FalsePositiveReport[] = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    const issueTypes = [...new Set(log.map(e => e.issueType))];

    const byType: Record<string, FPStats> = {};
    for (const type of issueTypes) {
      byType[type] = getStatsForType(type as InteractionIssueType);
    }

    const summary = {
      totalReports: log.length,
      byType,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Failed to load FP stats', err.message));
    } else {
      console.error(errorJSON('Failed to load FP stats', String(err)));
    }
    process.exit(1);
  }
}

function cmdFPRecalibrate(): void {
  try {
    const result = recalibrateConfidences();
    console.log(JSON.stringify({ success: true, recalibrated: result, timestamp: new Date().toISOString() }, null, 2));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Recalibration failed', err.message));
    } else {
      console.error(errorJSON('Recalibration failed', String(err)));
    }
    process.exit(1);
  }
}

function cmdFPFilter(): void {
  try {
    const filters = generateConfidenceFilters();
    console.log(JSON.stringify({ success: true, generatedCode: filters, timestamp: new Date().toISOString() }, null, 2));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Filter generation failed', err.message));
    } else {
      console.error(errorJSON('Filter generation failed', String(err)));
    }
    process.exit(1);
  }
}

function cmdDepImpact(args: CliArgs): void {
  const targetFile = args.positional[0];
  if (!targetFile) {
    console.error(errorJSON('Missing target file', 'Usage: --dep-impact <targetFile>'));
    process.exit(1);
  }
  const resolvedPath = resolveProjectPath(targetFile);
  const projectRoot = process.cwd();

  try {
    const { DependencyImpactAnalyzer } = require('./dependency-impact');
    const analyzer = new DependencyImpactAnalyzer(resolvedPath, projectRoot);
    const report = analyzer.analyze();
    console.log(JSON.stringify(report, null, 2));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Dependency impact analysis failed', err.message));
    } else {
      console.error(errorJSON('Dependency impact analysis failed', String(err)));
    }
    process.exit(1);
  }
}

function cmdVersion(): void {
  try {
    const { VERSION_MANIFEST, COMPATIBILITY_MATRIX } = require('./skill-routing-manifest');
    console.log(JSON.stringify({
      versions: VERSION_MANIFEST,
      compatibility: COMPATIBILITY_MATRIX,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Version check failed', err.message));
    } else {
      console.error(errorJSON('Version check failed', String(err)));
    }
    process.exit(1);
  }
}

function cmdAutoFP(): void {
  try {
    const { detectAutoFalsePositives } = require('./auto-fp-detector');
    const logFile = path.join(__dirname, '..', '..', '..', '..', '.design-constraints', 'false-positive-log.json');
    const results = detectAutoFalsePositives(logFile);
    console.log(JSON.stringify({
      totalAutoFP: results.length,
      byType: results.reduce((acc: Record<string, number>, r: any) => {
        acc[r.issueType] = (acc[r.issueType] || 0) + 1;
        return acc;
      }, {}),
      results,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Auto FP detection failed', err.message));
    } else {
      console.error(errorJSON('Auto FP detection failed', String(err)));
    }
    process.exit(1);
  }
}

function cmdDegradedTest(): void {
  try {
    const degradedTestFile = path.join(__dirname, 'degraded-mode-test.ts');
    if (!fs.existsSync(degradedTestFile)) {
      console.error(errorJSON('Degraded test file not found', degradedTestFile));
      process.exit(1);
    }
    // Run degraded mode test
    const { execSync } = require('child_process');
    const output = execSync(`npx tsx ${degradedTestFile}`, { encoding: 'utf-8' });
    console.log(output);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(errorJSON('Degraded test failed', err.message));
    } else {
      console.error(errorJSON('Degraded test failed', String(err)));
    }
    process.exit(1);
  }
}

async function cmdScanTs(args: CliArgs): Promise<void> {
  const rootPath = args.positional[0] || 'orion-platform-service/src/';
  const resolvedPath = resolveProjectPath(rootPath);

  const originalLog = console.log;
  console.log = () => {};

  try {
    const { InteractionScanner } = await import('./ast-analyzer');
    const scanner = new InteractionScanner(resolvedPath, ['.ts', '.tsx']);
    const issues = await scanner.scan(args.maxFiles, {
      minConfidence: args.minConfidence,
      enableCrossValidation: args.crossValidation,
      enableDedup: args.dedup,
    });
    console.log = originalLog;
    console.log(JSON.stringify(issues, null, 2));
  } catch (err: unknown) {
    console.log = originalLog;
    if (err instanceof Error) {
      console.error(errorJSON('TS scan failed', err.message));
    } else {
      console.error(errorJSON('TS scan failed', String(err)));
    }
    process.exit(1);
  }
}

function cmdFindRoot(): void {
  let current = process.cwd();

  const markers = [
    'docs/design-constraints',
    'orion-frontend',
    'orion-platform-service',
    'orion-api-gateway',
    'package.json',
  ];

  for (let depth = 0; depth < 8; depth++) {
    const found = markers.filter(m => fs.existsSync(path.join(current, m)));
    if (found.length >= 2) {
      console.log(JSON.stringify({
        success: true,
        projectRoot: current,
        markersFound: found,
        depth,
        timestamp: new Date().toISOString(),
      }, null, 2));
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  console.log(JSON.stringify({
    success: false,
    error: 'Project root not found. Searched up from cwd to filesystem root.',
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
  }, null, 2));
  process.exit(1);
}

/**
 * --pipeline: Full auto-pipeline that scans, routes issues to skills, and generates a fix plan.
 *
 * Pipeline protocol (as defined in design-constraint SKILL.md):
 *   entry: scan <path>
 *   routing: B1,B2,S → code-design-analyzer | A1,A3,C,D → design-doc-reviewer | D1-D5 → task-decomposer
 *   collector: task-decomposer
 *   after_each: design-constraint --regression
 */
async function cmdPipeline(args: CliArgs): Promise<void> {
  const rootPath = args.positional[0] || 'orion-frontend/src/pages/';
  const resolvedPath = resolveProjectPath(rootPath);

  const originalLog = console.log;
  console.log = () => {};

  try {
    // Step 1: Run AST scan
    const issues = await runInteractiveScan(resolvedPath, args.maxFiles, {
      minConfidence: args.minConfidence,
      enableCrossValidation: args.crossValidation,
      enableDedup: args.dedup,
    });
    console.log = originalLog;

    // Step 2: Route issues by category
    const { getSkillOwner, getConsumerSkills } = await import('./skill-routing-manifest');

    const routedIssues: Record<string, any[]> = {
      'design-constraint': [],
      'code-design-analyzer': [],
      'design-doc-reviewer': [],
      'task-decomposer': [],
    };

    for (const issue of issues) {
      const owner = getSkillOwner(issue.type || '');
      const consumers = getConsumerSkills(issue.type || '');
      routedIssues[owner] = routedIssues[owner] || [];
      routedIssues[owner].push({ ...issue, owner, consumers });
      for (const consumer of consumers) {
        routedIssues[consumer] = routedIssues[consumer] || [];
        routedIssues[consumer].push({ ...issue, role: 'consumer', authority: owner });
      }
    }

    // Step 3: Group by severity
    const bySeverity: Record<string, any[]> = { P0: [], P1: [], P2: [] };
    for (const issue of issues) {
      const sev = issue.severity || 'P2';
      bySeverity[sev] = bySeverity[sev] || [];
      bySeverity[sev].push(issue);
    }

    // Step 4: Auto-trigger downstream skills based on routing
    const autoTriggered: Record<string, string[]> = {};
    for (const [skill, skillIssues] of Object.entries(routedIssues)) {
      if (skill === 'design-constraint') continue; // skip self
      if (skillIssues.length === 0) continue;

      autoTriggered[skill] = skillIssues.map((i: any) => `${i.type} at ${i.file}:${i.line}`);
    }

    // Step 5: Run cross-file API contract check if path contains both frontend and backend
    let apiContractCheck: Record<string, unknown> = {};
    if (resolvedPath.includes('src/')) {
      try {
        const { runApiContractCheck } = await import('./api-contract-checker');
        apiContractCheck = runApiContractCheck(resolvedPath);
      } catch {
        // API contract checker not available — skip gracefully
      }
    }

    // Step 6: Generate pipeline report
    const pipelineReport = {
      scanRoot: resolvedPath,
      filesScanned: issues.length > 0 ? new Set(issues.map((i: any) => i.file)).size : 0,
      totalIssues: issues.length,
      bySeverity: {
        P0: bySeverity.P0.length,
        P1: bySeverity.P1.length,
        P2: bySeverity.P2.length,
      },
      bySkill: {
        'design-constraint': routedIssues['design-constraint'].length,
        'code-design-analyzer': routedIssues['code-design-analyzer'].length,
        'design-doc-reviewer': routedIssues['design-doc-reviewer'].length,
        'task-decomposer': routedIssues['task-decomposer'].length,
      },
      autoTriggered,
      apiContractCheck,
      issues: issues.sort((a: any, b: any) => {
        const sevOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
        return (sevOrder[a.severity || 'P2'] ?? 3) - (sevOrder[b.severity || 'P2'] ?? 3);
      }),
      routedIssues,
      nextSteps: bySeverity.P0.length > 0
        ? 'P0 issues found — recommend running "修复" to generate fix plan'
        : 'No P0 issues — scan complete',
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(pipelineReport, null, 2));

    // Exit code based on P0/P1 count
    if (bySeverity.P0.length > 0 || bySeverity.P1.length > 0) {
      process.exit(2);
    }
  } catch (err: unknown) {
    console.log = originalLog;
    if (err instanceof Error) {
      console.error(errorJSON('Pipeline failed', err.message));
    } else {
      console.error(errorJSON('Pipeline failed', String(err)));
    }
    process.exit(1);
  }
}

// ── Main ──

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.command || args.command === 'help') {
    printHelp();
    return;
  }

  switch (args.command) {
    case 'scan':
      await cmdScan(args);
      break;
    case 'scan-full':
      await cmdScanFull(args);
      break;
    case 'verify':
      await cmdVerify(args);
      break;
    case 'compliance':
      await cmdCompliance(args);
      break;
    case 'regression':
      await cmdRegression(args);
      break;
    case 'fp':
      cmdFalsePositive(args);
      break;
    case 'fp-stats':
      cmdFPStats();
      break;
    case 'fp-recalibrate':
      cmdFPRecalibrate();
      break;
    case 'fp-filter':
      cmdFPFilter();
      break;
    case 'find-root':
      cmdFindRoot();
      break;
    case 'dep-impact':
      cmdDepImpact(args);
      break;
    case 'version':
      cmdVersion();
      break;
    case 'auto-fp':
      cmdAutoFP();
      break;
    case 'degraded-test':
      cmdDegradedTest();
      break;
    case 'scan-ts':
      await cmdScanTs(args);
      break;
    case 'pipeline':
      await cmdPipeline(args);
      break;
    default:
      console.error(errorJSON('Unknown command', `Unknown: --${args.command}. Run --help for usage.`));
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error(errorJSON('Unexpected error', err.message));
  } else {
    console.error(errorJSON('Unexpected error', String(err)));
  }
  process.exit(1);
});
