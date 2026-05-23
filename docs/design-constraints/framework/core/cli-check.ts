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

// ── Helpers ──

function printHelp(): void {
  const help = `
Design Constraint AST Check CLI

Usage:
  npx tsx cli-check.ts --scan <rootPath> [options]    Full AST scan of a directory
  npx tsx cli-check.ts --verify <filePath>             Single-file interaction chain verification
  npx tsx cli-check.ts --compliance <filePath>         Orion spec compliance check
  npx tsx cli-check.ts --regression [options]          Regression detection against base ref
  npx tsx cli-check.ts --fp <issueType> <file>:<line>  Log a false positive report
  npx tsx cli-check.ts --fp-stats                      View false positive statistics
  npx tsx cli-check.ts --fp-recalibrate                Recalibrate confidence scores
  npx tsx cli-check.ts --fp-filter                     Generate auto-confidence filters
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
  // If relative, resolve against project root (parent of docs/)
  if (p.startsWith('.') || !p.startsWith('/')) {
    return `${process.cwd()}/${p}`;
  }
  return p;
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

async function cmdVerify(args: CliArgs): Promise<void> {
  const filePath = args.positional[0];
  if (!filePath) {
    console.error(errorJSON('Missing file path', 'Usage: --verify <filePath>'));
    process.exit(1);
  }

  const resolvedPath = resolveProjectPath(filePath);

  try {
    const { existsSync } = require('fs');
    if (!existsSync(resolvedPath)) {
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
    const { existsSync } = require('fs');
    if (!existsSync(resolvedPath)) {
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
    const { existsSync, readFileSync } = require('fs');
    const logFile = require('path').join(__dirname, 'false-positive-log.json');

    if (!existsSync(logFile)) {
      console.log(JSON.stringify({ totalReports: 0, byType: {}, message: 'No false positive reports found' }, null, 2));
      return;
    }

    const log: FalsePositiveReport[] = JSON.parse(readFileSync(logFile, 'utf-8'));
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
