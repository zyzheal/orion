/**
 * Base detector class and shared interfaces for AST-based interaction analysis.
 * All concrete detectors extend this class to reuse common helpers.
 */

import * as ts from 'typescript';
// @ts-ignore TS2591: requires @types/node — already available in project runtime
import * as fs from 'fs';

// ── Shared types ──

/** Unified issue type for cross-scanner aggregation (AST + C/D/S/B analysis) */
export type UnifiedIssueType = string;

/** Issue dimension identifier */
export type IssueDimension = 'A' | 'B1' | 'B2' | 'C' | 'D' | 'S';

/** Issue source scanner */
export type IssueSource = 'ast' | 'security' | 'operations' | 'experience' | 'fix' | 'optimize' | 'data-structure' | 'flow';

export interface UnifiedIssue {
  file: string;
  line: number;
  column: number;
  type: UnifiedIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  dimension: IssueDimension;
  checkId?: string;          // Original checkId (e.g. C4-01, S3-02)
  confidence?: number;
  source: IssueSource;
  requiresConfirmation?: boolean;
}

/** Convert any scanner-specific issue to UnifiedIssue */
export function toUnifiedIssue(issue: {
  file: string;
  line: number;
  column?: number;
  type: string;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion?: string;
  dimension?: IssueDimension;
  checkId?: string;
  confidence?: number;
  source?: IssueSource;
  requiresConfirmation?: boolean;
}): UnifiedIssue {
  return {
    file: issue.file,
    line: issue.line,
    column: issue.column ?? 1,
    type: issue.type,
    severity: issue.severity,
    message: issue.message,
    suggestion: issue.suggestion ?? '待修复',
    dimension: issue.dimension ?? 'A',
    checkId: issue.checkId,
    confidence: issue.confidence ?? 80,
    source: issue.source ?? 'ast',
    requiresConfirmation: issue.requiresConfirmation ?? false,
  };
}

export type InteractionIssueType =
  // 基础检测（5项）
  | 'missing-feedback' | 'missing-loading' | 'missing-empty' | 'missing-submit' | 'missing-edit'
  // 新增检测（10项）
  | 'missing-network-error' | 'missing-business-error' | 'missing-permission-error'
  | 'missing-timeout' | 'missing-optimistic-lock' | 'missing-concurrent-edit'
  | 'missing-undo' | 'missing-skeleton' | 'missing-state-machine'
  | 'missing-animation' | 'missing-empty-search'
  // 补充检测（5项）
  | 'missing-truncate' | 'missing-pagination' | 'missing-batch' | 'missing-danger-confirm' | 'missing-data-empty'
  // NEW detectors — existing（3项）
  | 'token-violation' | 'missing-error-boundary' | 'missing-props-type'
  // NEW detectors — responsive/a11y/state/style（4项）
  | 'missing-responsive' | 'missing-a11y' | 'missing-state-transition' | 'style-improvement'
  // Security detectors（5项）
  | 'missing-auth-guard' | 'missing-sensitive-log-mask' | 'missing-sql-parameterization'
  | 'missing-cors-config' | 'missing-tenant-isolation'
  // B2 optimization detectors（3项）
  | 'missing-lazy-load' | 'missing-request-cancel' | 'missing-request-merge'
  // B1 fix standard detectors（5项）
  | 'missing-test-coverage' | 'missing-rollback' | 'missing-fallback'
  | 'missing-circuit-breaker' | 'missing-degrade-notice'
  // SOLID + Anti-patterns（3项）
  | 'god-object' | 'controller-bloat' | 'fat-interface'
  // Security deep（3项）
  | 'secret-hardcode' | 'sql-injection-risk' | 'xss-risk'
  // Observability（4项）
  | 'unstructured-log' | 'missing-traceId-injection' | 'missing-metrics' | 'missing-health-check';

export interface InteractionIssue {
  file: string;
  line: number;
  column: number;
  type: InteractionIssueType;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
  /**
   * Confidence score (0-100). Issues with confidence < 50 are flagged for review.
   * AST-based detectors default to 90, regex-based to 60.
   * Auto-filled by finalizeIssues() if not provided.
   */
  confidence?: number;
  /**
   * Whether this issue requires manual confirmation before acting on it.
   * Set by the CrossValidator when global config may invalidate the finding.
   * Auto-filled by finalizeIssues() if not provided.
   */
  requiresConfirmation?: boolean;
}

export interface ScanResult {
  file: string;
  issues: InteractionIssue[];
  stats: {
    functions: number;
    handlers: number;
    apis: number;
  };
}

// ── Shared constants (reduces duplication across detectors) ──

export const API_CALL_PATTERNS: RegExp[] = [
  /await\s+\w+Api\./, /await\s+request\(/, /await\s+axios/,
  /useRequest\(|useMutation\(/, /fetch\(/,
];

export const ERROR_BOUNDARY_PATTERNS: RegExp[] = [
  /ErrorBoundary/, /<ErrorBoundary/, /import.*ErrorBoundary/,
  /withErrorBoundary/, /errorBoundary/,
];

export const SUBMIT_HANDLER_PATTERNS: RegExp[] = [
  /htmlType\s*=\s*["']submit["']/,
  /onOk\s*=\s*\{/,
  /form\.onFinish|onFinish\s*=\s*\{/,
];

// ── Base detector ──

export abstract class BaseDetector {
  protected sourceFile: ts.SourceFile;
  protected filePath: string;
  protected content: string;
  protected issues: InteractionIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  /** Legacy: Run full analysis (for backwards compatibility). */
  abstract analyze(): InteractionIssue[];

  /**
   * Single-pass visitor: called once per AST node by the orchestrator.
   * Override this method to implement single-pass detection.
   * Default: falls back to legacy analyze() on first call.
   */
  visitNode(_node: ts.Node): void {
    // Default: no-op. Concrete detectors override.
  }

  /**
   * Called after the AST traversal is complete.
   * Override to return accumulated issues.
   */
  getIssues(): InteractionIssue[] {
    return this.issues;
  }

  /** Whether this detector supports single-pass mode. */
  supportsSinglePass(): boolean {
    return false;
  }

  /**
   * Helper to create an issue with confidence score.
   * AST-based detection defaults to 90, regex-based to 60.
   */
  protected reportIssue(issue: Omit<InteractionIssue, 'confidence' | 'requiresConfirmation'> & { confidence?: number }): void {
    this.issues.push(finalizeIssue(issue, this.isAstBased()));
  }

  /** Whether this detector primarily uses AST analysis (not regex). */
  protected isAstBased(): boolean {
    return false;
  }

  // ── Common helpers ──

  /** Get 1-based line/column for a TS node. */
  protected getLineColumn(node: ts.Node): { line: number; column: number } {
    const pos = node.getStart(this.sourceFile);
    const info = this.sourceFile.getLineAndCharacterOfPosition(pos);
    return { line: info.line + 1, column: info.character + 1 };
  }

  /** Check whether a node (or its subtree) contains message.success/error/warning calls. */
  protected hasMessageCall(node: ts.Node): boolean {
    let found = false;
    const check = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const expr = n.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          if (expr.name.text === 'success' || expr.name.text === 'error' || expr.name.text === 'warning') {
            const obj = expr.expression;
            if (ts.isIdentifier(obj) && obj.text === 'message') {
              found = true;
            }
          }
        }
      }
      ts.forEachChild(n, check);
    };
    check(node);
    return found;
  }

  /** Check whether a function-like declaration has the `async` modifier. */
  protected isAsyncFunction(node: ts.FunctionLikeDeclaration): boolean {
    return node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  }

  /** Check whether a node contains a try-catch block (stopping at nested function boundaries). */
  protected hasTryCatch(node: ts.Node): boolean {
    return this.hasTryCatchInNode(node);
  }

  private hasTryCatchInNode(node: ts.Node): boolean {
    let found = false;
    const check = (n: ts.Node) => {
      if (ts.isTryStatement(n)) {
        found = true;
        return;
      }
      if (n !== node && ts.isFunctionLike(n)) {
        return;
      }
      if (!found) ts.forEachChild(n, check);
    };
    check(node);
    return found;
  }

  /**
   * Check whether an async function has a catch block with a user-visible error message
   * (message.error, notification.error, etc.).
   */
  protected hasCatchWithErrorMessage(func: ts.FunctionLikeDeclaration): boolean {
    let found = false;
    const check = (n: ts.Node) => {
      if (ts.isTryStatement(n) && n.catchClause) {
        const catchBody = n.catchClause.block.getText(this.sourceFile);
        if (/message\.(error|warning)|notification\.error/i.test(catchBody)) {
          found = true;
          return;
        }
      }
      if (!found) ts.forEachChild(n, check);
    };
    check(func);
    return found;
  }
}

/**
 * Finalize an issue by filling in confidence and requiresConfirmation.
 * AST-based detectors get confidence=90, regex-based get 60.
 */
export function finalizeIssue(
  issue: Omit<InteractionIssue, 'confidence' | 'requiresConfirmation'> & { confidence?: number; requiresConfirmation?: boolean },
  isAstBased: boolean,
): InteractionIssue {
  const confidence = issue.confidence ?? (isAstBased ? 90 : 60);
  return {
    ...issue,
    confidence,
    requiresConfirmation: issue.requiresConfirmation ?? confidence < 50,
  };
}
