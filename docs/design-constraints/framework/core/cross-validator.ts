/**
 * Cross Validator — validates AST analysis results against global project context.
 *
 * Purpose: Reduce false positives from AST analysis by checking for:
 *   - Global ErrorBoundary / axios interceptors
 *   - Global empty component config
 *   - Base component types
 *   - Project-wide design token config
 *
 * This prevents the "error amplification" problem where 1 AST false positive
 * causes 3 AI skills to generate useless fix plans.
 */

import * as ts from 'typescript';
// @ts-ignore TS2591
import * as path from 'path';
// @ts-ignore TS2591
import * as fs from 'fs';
import { InteractionIssue, ScanResult } from './detectors/base';

// @ts-ignore TS2591: requires @types/node — already available in project runtime
declare const __dirname: string;

/**
 * Project-wide context gathered from scanning key files.
 */
export interface ProjectContext {
  /** Whether the project has a global error handler (axios interceptor, ErrorBoundary, etc.) */
  hasGlobalErrorHandler: boolean;
  /** Whether the project has global empty component config */
  hasGlobalEmptyConfig: boolean;
  /** Whether the project uses a base props type pattern */
  hasBasePropsType: boolean;
  /** Whether the project has a global loading interceptor */
  hasGlobalLoadingInterceptor: boolean;
  /** Whether the project uses global timeout config */
  hasGlobalTimeoutConfig: boolean;
  /** Whether the project has global permission handling */
  hasGlobalPermissionHandling: boolean;
  /** Project-wide API client file paths */
  apiClientFiles: string[];
}

/**
 * Confidence thresholds for filtering issues.
 * Auto-overridden by false-positive-logger recalibration if available.
 */
const DEFAULT_CONFIDENCE_FILTERS: Record<string, number> = {
  'missing-network-error': 50,   // May have global interceptor
  'missing-empty': 55,           // May have global empty config
  'missing-skeleton': 60,        // May use loading state
  'missing-permission-error': 50, // May have global permission handling
  'missing-timeout': 60,         // May have global timeout config
  'missing-data-empty': 55,      // May have global empty config
};

/**
 * Load confidence filters, preferring recalibrated config from false-positive-logger.
 */
function loadConfidenceFilters(): Record<string, number> {
  try {
    const configPath = path.join(__dirname, 'confidence-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // Merge recalibrated filters with defaults
      const merged = { ...DEFAULT_CONFIDENCE_FILTERS };
      for (const [type, stats] of Object.entries(config) as [string, { confidencePenalty: number }][]) {
        // Lower threshold = more likely to filter out (FP-prone types get higher threshold)
        merged[type] = Math.min(90, DEFAULT_CONFIDENCE_FILTERS[type] || 60 - stats.confidencePenalty);
      }
      return merged;
    }
  } catch {
    // Fall through to defaults
  }
  return DEFAULT_CONFIDENCE_FILTERS;
}

const CONFIDENCE_FILTERS: Record<string, number> = loadConfidenceFilters();

/**
 * Default confidence for issue types not in the filter map.
 */
const DEFAULT_CONFIDENCE = 75;

/**
 * Gather project-wide context by scanning key files.
 * This is a one-time operation per scan session.
 */
export function gatherProjectContext(rootPath: string): ProjectContext {
  const context: ProjectContext = {
    hasGlobalErrorHandler: false,
    hasGlobalEmptyConfig: false,
    hasBasePropsType: false,
    hasGlobalLoadingInterceptor: false,
    hasGlobalTimeoutConfig: false,
    hasGlobalPermissionHandling: false,
    apiClientFiles: [],
  };

  // Scan for key files that indicate global config
  const keyPatterns = [
    { pattern: 'axios', checks: ['interceptor', 'response.use', 'request.use'] },
    { pattern: 'error-boundary', checks: ['ErrorBoundary', 'errorBoundary'] },
    { pattern: 'permission', checks: ['can(', 'hasPermission', 'usePermission'] },
    { pattern: 'config', checks: ['emptyText', 'locale'] },
  ];

  // Scan a subset of files for context (limit to 200 for better coverage)
  const files = scanTsxFiles(rootPath, 200);
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for axios interceptors
      if (/axios\.interceptors\.use|response\.use/.test(content)) {
        context.hasGlobalErrorHandler = true;
        if (/loading|spinner/i.test(content)) {
          context.hasGlobalLoadingInterceptor = true;
        }
        if (/timeout|ETIMEDOUT/i.test(content)) {
          context.hasGlobalTimeoutConfig = true;
        }
      }

      // Check for ErrorBoundary
      if (/ErrorBoundary|withErrorBoundary|getDerivedStateFromError/.test(content)) {
        context.hasGlobalErrorHandler = true;
      }

      // Check for permission handling
      if (/can\(|hasPermission|usePermission|v-permission/.test(content)) {
        context.hasGlobalPermissionHandling = true;
      }

      // Check for global empty config
      if (/emptyText.*Empty|global.*empty|locale.*emptyText/.test(content)) {
        context.hasGlobalEmptyConfig = true;
      }

      // Check for base props type
      if (/BaseProps|BaseComponentProps|CommonProps/.test(content)) {
        context.hasBasePropsType = true;
      }
    } catch {
      // Skip unreadable files
    }
  }

  return context;
}

/**
 * Validate a scan result against the project context.
 * Adjusts confidence scores and flags issues that may be false positives.
 */
export function validateWithContext(
  result: ScanResult,
  context: ProjectContext,
): ScanResult {
  const validated: InteractionIssue[] = [];

  for (const issue of result.issues) {
    const baseConfidence = issue.confidence ?? DEFAULT_CONFIDENCE;
    let adjustedConfidence = baseConfidence;

    // Adjust confidence based on project context
    if (
      issue.type === 'missing-network-error' &&
      context.hasGlobalErrorHandler &&
      !context.hasGlobalLoadingInterceptor
    ) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 30);
    }

    if (
      (issue.type === 'missing-empty' || issue.type === 'missing-data-empty') &&
      context.hasGlobalEmptyConfig
    ) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 35);
    }

    if (
      issue.type === 'missing-skeleton' &&
      context.hasGlobalLoadingInterceptor
    ) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 25);
    }

    if (
      issue.type === 'missing-permission-error' &&
      context.hasGlobalPermissionHandling
    ) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 30);
    }

    if (
      issue.type === 'missing-timeout' &&
      context.hasGlobalTimeoutConfig
    ) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 30);
    }

    const filterThreshold = CONFIDENCE_FILTERS[issue.type] ?? DEFAULT_CONFIDENCE;

    validated.push({
      ...issue,
      confidence: adjustedConfidence,
      requiresConfirmation: adjustedConfidence < filterThreshold,
    });
  }

  return {
    ...result,
    issues: validated,
  };
}

/**
 * Filter issues by confidence threshold.
 * Issues below the threshold are excluded from the result.
 */
export function filterByConfidence(
  result: ScanResult,
  minConfidence: number = 50,
): ScanResult {
  return {
    ...result,
    issues: result.issues.filter((i: InteractionIssue) => (i.confidence ?? 0) >= minConfidence),
  };
}

/**
 * Scan .tsx files in a directory (limited for performance).
 */
function scanTsxFiles(rootPath: string, maxFiles: number): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    if (files.length >= maxFiles) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          // Skip node_modules, dist, etc.
          if (!/node_modules|dist|build|\.git/.test(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walk(rootPath);
  return files.slice(0, maxFiles);
}
