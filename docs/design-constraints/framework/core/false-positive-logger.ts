/**
 * False Positive Logger — tracks and learns from false positive reports.
 *
 * Purpose: Gap 3 — When skills (design-doc-reviewer, task-decomposer,
 * code-design-analyzer) find that an AST-detected issue is actually a
 * false positive, they can log it here. Over time, the system automatically
 * adjusts confidence scores based on historical false positive rates.
 *
 * Storage: JSON file at docs/design-constraints/framework/core/false-positive-log.json
 *
 * Usage:
 *   logFalsePositive(issue, reason, context)
 *   recalibrateConfidences()           — recompute confidences from log data
 *   getAdjustedConfidence(issueType)   — get confidence adjusted by FP history
 */

import { InteractionIssue, InteractionIssueType } from './detectors/base';
// @ts-ignore TS2591
import * as fs from 'fs';
// @ts-ignore TS2591
import * as path from 'path';

// @ts-ignore TS2591: requires @types/node — already available in project runtime
declare const __dirname: string;

// Resolve persistent data path: prefer project-level .design-constraints/ directory
function resolveDataPath(fileName: string): string {
  // Strategy 1: Look for .design-constraints/ directory at project root
  let current = __dirname;
  for (let depth = 0; depth < 8; depth++) {
    const candidate = path.join(current, '.design-constraints', fileName);
    if (fs.existsSync(path.dirname(candidate)) ||
        (depth > 0 && fs.existsSync(path.join(current, '.design-constraints')))) {
      return candidate;
    }
    // Also check if .design-constraints exists at this level
    const dcDir = path.join(current, '.design-constraints');
    if (fs.existsSync(dcDir)) {
      return path.join(dcDir, fileName);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Strategy 2: Fallback to same directory as this file (legacy behavior)
  return path.join(__dirname, fileName);
}

const LOG_FILE = resolveDataPath('false-positive-log.json');
const CONFIG_FILE = resolveDataPath('confidence-config.json');
const DETECTION_COUNTS_FILE = resolveDataPath('detection-counts.json');

/**
 * A single false positive report.
 */
export interface FalsePositiveReport {
  /** Issue type that was a false positive */
  issueType: InteractionIssueType;
  /** File path where the false positive occurred */
  file: string;
  /** Line number */
  line: number;
  /** Reason why this is a false positive */
  reason: string;
  /** Who reported it (skill name) */
  reportedBy: string;
  /** When it was reported */
  timestamp: string;
  /** Additional context (e.g., "has global interceptor", "intentionally omitted") */
  context?: Record<string, string>;
  /** Original confidence score */
  originalConfidence: number;
}

/**
 * Per-issue-type statistics.
 */
export interface FPStats {
  /** Total times this issue type was detected (true + false positives) */
  totalDetections: number;
  /** Times it was marked as false positive */
  falsePositiveCount: number;
  /** True positive count = totalDetections - falsePositiveCount */
  truePositiveCount: number;
  /** False positive rate (0-1) */
  falsePositiveRate: number;
  /** Recommended confidence adjustment (negative number) */
  confidencePenalty: number;
  /** Sample false positive reasons */
  sampleReasons: string[];
}

/**
 * Log a scan result to track true positive counts.
 * Called by InteractionScanner.scan() after each scan to record
 * how many times each issue type was detected (not just FP reports).
 */
export function logScanResults(results: Array<{ type: InteractionIssueType; file: string; line: number }>): void {
  const tpFile = path.join(__dirname, 'detection-counts.json');
  const counts = loadDetectionCounts();

  for (const result of results) {
    const key = `${result.file}:${result.line}:${result.type}`;
    if (!counts.totalByKey[key]) {
      counts.totalByKey[key] = 0;
    }
    counts.totalByKey[key]++;
    counts.totalByType[result.type] = (counts.totalByType[result.type] || 0) + 1;
  }

  fs.writeFileSync(tpFile, JSON.stringify(counts, null, 2), 'utf-8');
}

/**
 * Load detection counts.
 */
function loadDetectionCounts(): { totalByKey: Record<string, number>; totalByType: Record<string, number> } {
  const tpFile = path.join(__dirname, 'detection-counts.json');
  try {
    if (fs.existsSync(tpFile)) {
      return JSON.parse(fs.readFileSync(tpFile, 'utf-8'));
    }
  } catch {
    // Corrupted
  }
  return { totalByKey: {}, totalByType: {} };
}

/**
 * Get true positive count for an issue type.
 */
export function getTruePositiveCount(issueType: InteractionIssueType): number {
  const log = loadLog();
  const counts = loadDetectionCounts();
  const fpCount = log.filter(e => e.issueType === issueType).length;
  const totalCount = counts.totalByType[issueType] || fpCount;
  return Math.max(0, totalCount - fpCount);
}

/**
 * Log a false positive report.
 */
export function logFalsePositive(
  issue: InteractionIssue,
  reason: string,
  reportedBy: string,
  context?: Record<string, string>,
): void {
  const entry: FalsePositiveReport = {
    issueType: issue.type,
    file: issue.file,
    line: issue.line,
    reason,
    reportedBy,
    timestamp: new Date().toISOString(),
    context,
    originalConfidence: issue.confidence ?? 90,
  };

  const log = loadLog();
  log.push(entry);
  saveLog(log);
}

/**
 * Get adjusted confidence for an issue type based on FP history.
 */
export function getAdjustedConfidence(issueType: InteractionIssueType, baseConfidence: number = 90): number {
  const stats = getStatsForType(issueType);
  return Math.max(0, Math.round(baseConfidence + stats.confidencePenalty));
}

/**
 * Get statistics for a specific issue type.
 */
export function getStatsForType(issueType: InteractionIssueType): FPStats {
  const log = loadLog();
  const counts = loadDetectionCounts();

  const typeEntries = log.filter(e => e.issueType === issueType);
  const falsePositiveCount = typeEntries.length;
  const totalCount = counts.totalByType[issueType] || falsePositiveCount;
  const truePositiveCount = Math.max(0, totalCount - falsePositiveCount);

  // Confidence penalty: based on FP rate and absolute count
  let confidencePenalty = 0;
  if (falsePositiveCount >= 10) confidencePenalty = -30;
  else if (falsePositiveCount >= 5) confidencePenalty = -20;
  else if (falsePositiveCount >= 3) confidencePenalty = -15;
  else if (falsePositiveCount >= 2) confidencePenalty = -10;
  else if (falsePositiveCount >= 1) confidencePenalty = -5;

  return {
    totalDetections: totalCount,
    falsePositiveCount,
    truePositiveCount,
    falsePositiveRate: totalCount > 0 ? falsePositiveCount / totalCount : 0,
    confidencePenalty,
    sampleReasons: typeEntries.slice(0, 3).map(e => e.reason),
  };
}

/**
 * Recompute all issue-type confidences from the false positive log.
 * Returns a map of issue type → adjusted confidence.
 */
export function recalibrateConfidences(): Record<string, FPStats> {
  const log = loadLog();
  const issueTypes = [...new Set(log.map(e => e.issueType))];
  const result: Record<string, FPStats> = {};

  for (const type of issueTypes) {
    result[type] = getStatsForType(type as InteractionIssueType);
  }

  // Save recalibrated config
  const configPath = CONFIG_FILE;
  fs.writeFileSync(configPath, JSON.stringify(result, null, 2), 'utf-8');

  return result;
}

/**
 * Apply recalibrated confidences to the cross-validator.
 * This generates an updated CONFIDENCE_FILTERS config.
 */
export function generateConfidenceFilters(): string {
  const log = loadLog();
  const issueTypes = [...new Set(log.map(e => e.issueType))];

  const lines: string[] = [
    '// Auto-generated by recalibrateConfidences()',
    '// Based on false positive feedback from AI skills',
    '',
    'const CONFIDENCE_FILTERS: Record<string, number> = {',
  ];

  for (const type of issueTypes) {
    const stats = getStatsForType(type);
    if (stats.falsePositiveCount >= 3) {
      lines.push(`  '${type}': ${Math.round(90 + stats.confidencePenalty)}, // FP rate: ${(stats.falsePositiveRate * 100).toFixed(0)}% (${stats.falsePositiveCount} reports)`);
    }
  }

  lines.push('};');
  lines.push('');
  lines.push('export default CONFIDENCE_FILTERS;');

  return lines.join('\n');
}

/**
 * Get a summary of the false positive log.
 */
export function getFPSummary(): string {
  const log = loadLog();

  const byType: Record<string, number> = {};
  const byReporter: Record<string, number> = {};

  for (const entry of log) {
    byType[entry.issueType] = (byType[entry.issueType] || 0) + 1;
    byReporter[entry.reportedBy] = (byReporter[entry.reportedBy] || 0) + 1;
  }

  const lines = [
    '┌────────────────────────────────────────────────────────────┐',
    '│  False Positive Log Summary                                │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Total reports:          ${log.length.toString().padStart(32)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  By issue type:                                              │',
  ];

  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const stats = getStatsForType(type as InteractionIssueType);
    lines.push(`│    ${type.padEnd(32)} ${count.toString().padStart(10)} (penalty: ${stats.confidencePenalty})│`);
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push('│  By reporter:                                              │');

  for (const [reporter, count] of Object.entries(byReporter).sort((a, b) => b[1] - a[1])) {
    lines.push(`│    ${reporter.padEnd(32)} ${count.toString().padStart(10)}│`);
  }

  lines.push('└────────────────────────────────────────────────────────────┘');
  return lines.join('\n');
}

// ── Internal helpers ──

function loadLog(): FalsePositiveReport[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    }
  } catch {
    // Corrupted or unreadable file
  }
  return [];
}

function saveLog(log: FalsePositiveReport[]): void {
  // Keep only last 1000 entries to prevent file bloat
  const trimmed = log.slice(-1000);
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}
