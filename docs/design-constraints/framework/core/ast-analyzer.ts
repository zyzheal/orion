/**
 * AST 增强型前端交互检测器 — Orchestrator
 *
 * Thin coordinator that imports all focused detectors, runs analysis,
 * and re-exports the public API for backwards compatibility.
 */

import * as ts from 'typescript';
// @ts-ignore TS2591: requires @types/node — already available in project runtime
import * as fs from 'fs';
// @ts-ignore TS2591: requires @types/node — already available in project runtime
import * as path from 'path';
import { getTsxFiles } from './file-utils';
import { gatherProjectContext, validateWithContext, ProjectContext } from './cross-validator';
import { aggregateResults, AggregatedIssue, AggregationResult, formatAggregationSummary } from './issue-aggregator';
import { logScanResults } from './false-positive-logger';

// ── Re-export types and base from the base module ──
export { InteractionIssueType, InteractionIssue, ScanResult } from './detectors/base';

// ── Import all detectors ──
import { BaseDetector, InteractionIssue, ScanResult } from './detectors/base';

// Async interaction detectors
import { MissingFeedbackDetector, MissingLoadingDetector, MissingNetworkErrorDetector, MissingBusinessErrorDetector } from './detectors/async-interaction';

// Form interaction detectors
import { MissingSubmitDetector, MissingEditDetector, MissingEmptyDetector, MissingTruncateDetector } from './detectors/form-interaction';

// State flow detectors
import { MissingStateMachineDetector, MissingAnimationDetector, MissingUndoDetector, MissingOptimisticLockDetector, MissingConcurrentEditDetector } from './detectors/state-flow';

// List interaction detectors
import { MissingBatchDetector, MissingPaginationDetector, MissingSkeletonDetector, MissingDataEmptyDetector } from './detectors/list-interaction';

// Safety detectors
import { MissingDangerConfirmDetector, MissingPermissionErrorDetector, MissingTimeoutDetector } from './detectors/safety';

// Security detectors (S1-S5)
import { MissingAuthGuardDetector, MissingSensitiveLogMaskDetector, MissingSqlParameterizationDetector, MissingCorsConfigDetector, MissingTenantIsolationDetector } from './detectors/security';

// B2 optimization detectors
import { MissingLazyLoadDetector, MissingRequestCancelDetector, MissingRequestMergeDetector } from './detectors/b2-optimization';

// Search detector
import { MissingEmptySearchDetector } from './detectors/search';

// NEW detectors
import { TokenViolationDetector } from './detectors/token-violation';
import { MissingErrorBoundaryDetector } from './detectors/error-boundary';
import { MissingPropsTypeDetector } from './detectors/props-type';

// ── Orchestrator class (wraps all detectors, preserves original API) ──

export class FrontendInteractionAnalyzer {
  private filePath: string;
  private content: string;
  private sourceFile: ts.SourceFile;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  }

  /**
   * Run all detectors on the current file and aggregate results.
   * Uses single-pass AST traversal for detectors that support it,
   * falls back to legacy analyze() for detectors that don't.
   */
  analyze(): ScanResult {
    const detectors = this.createDetectors();
    const issues: InteractionIssue[] = [];

    // Separate single-pass and legacy detectors
    const singlePass = detectors.filter(d => d.supportsSinglePass());
    const legacy = detectors.filter(d => !d.supportsSinglePass());

    // Legacy detectors run their own full traversal
    for (const detector of legacy) {
      issues.push(...detector.analyze());
    }

    // Single-pass detectors share one AST traversal
    if (singlePass.length > 0) {
      const visit = (node: ts.Node) => {
        for (const detector of singlePass) {
          detector.visitNode(node);
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(this.sourceFile, visit);

      for (const detector of singlePass) {
        issues.push(...detector.getIssues());
      }
    }

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues,
      stats,
    };
  }

  /**
   * Instantiate one detector of each type for the current file.
   */
  private createDetectors(): BaseDetector[] {
    return [
      // 原始检测（5项）
      new MissingFeedbackDetector(this.filePath),
      new MissingLoadingDetector(this.filePath),
      new MissingEmptyDetector(this.filePath),
      new MissingSubmitDetector(this.filePath),
      new MissingEditDetector(this.filePath),
      // 新增检测（10项）
      new MissingStateMachineDetector(this.filePath),
      new MissingAnimationDetector(this.filePath),
      new MissingNetworkErrorDetector(this.filePath),
      new MissingBusinessErrorDetector(this.filePath),
      new MissingPermissionErrorDetector(this.filePath),
      new MissingTimeoutDetector(this.filePath),
      new MissingOptimisticLockDetector(this.filePath),
      new MissingConcurrentEditDetector(this.filePath),
      new MissingUndoDetector(this.filePath),
      new MissingSkeletonDetector(this.filePath),
      new MissingEmptySearchDetector(this.filePath),
      // 补充检测（5项）
      new MissingTruncateDetector(this.filePath),
      new MissingPaginationDetector(this.filePath),
      new MissingBatchDetector(this.filePath),
      new MissingDangerConfirmDetector(this.filePath),
      new MissingDataEmptyDetector(this.filePath),
      // NEW detectors（3项）
      new TokenViolationDetector(this.filePath),
      new MissingErrorBoundaryDetector(this.filePath),
      new MissingPropsTypeDetector(this.filePath),
      // Security detectors（5项）
      new MissingAuthGuardDetector(this.filePath),
      new MissingSensitiveLogMaskDetector(this.filePath),
      new MissingSqlParameterizationDetector(this.filePath),
      new MissingCorsConfigDetector(this.filePath),
      new MissingTenantIsolationDetector(this.filePath),
      // B2 optimization detectors（3项）
      new MissingLazyLoadDetector(this.filePath),
      new MissingRequestCancelDetector(this.filePath),
      new MissingRequestMergeDetector(this.filePath),
    ];
  }

  /**
   * Collect statistics about the file using AST traversal.
   */
  private collectStats(): ScanResult['stats'] {
    let functions = 0;
    let handlers = 0;
    let apis = 0;

    const visit = (node: ts.Node) => {
      // Count function declarations
      if (ts.isFunctionDeclaration(node)) {
        functions++;
      }
      // Count JSX event handlers (onXxx={...})
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
        if (/^on[A-Z]/.test(node.name.text)) {
          handlers++;
        }
      }
      // Count API calls (await xxxApi.xxx())
      if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
        const callee = node.expression.expression;
        if (ts.isPropertyAccessExpression(callee)) {
          const obj = callee.expression.getText(this.sourceFile);
          if (/Api$/.test(obj) || obj === 'request' || obj === 'axios') {
            apis++;
          }
        }
      }
      // Count useRequest/useMutation hook calls
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee) && /^(useRequest|useMutation|useAsyncRequest)$/.test(callee.text)) {
          apis++;
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(this.sourceFile, visit);

    return { functions, handlers, apis };
  }
}

// ── InteractionScanner (batch scanning utility, unchanged) ──

export class InteractionScanner {
  private rootPath: string;

  constructor(rootPath: string = 'orion-frontend/src/pages/') {
    this.rootPath = rootPath;
  }

  /**
   * 扫描目录下所有 TSX 文件，支持交叉验证和聚合去重。
   */
  async scan(
    maxFiles: number = 100,
    options: { minConfidence?: number; enableCrossValidation?: boolean; enableDedup?: boolean } = {},
  ): Promise<AggregatedIssue[]> {
    const { minConfidence = 50, enableCrossValidation = true, enableDedup = true } = options;
    const results: ScanResult[] = [];
    const files = getTsxFiles(this.rootPath).slice(0, maxFiles);

    // Gather project-wide context for cross-validation
    let projectContext: ProjectContext | undefined;
    if (enableCrossValidation) {
      console.log('🔍 收集项目上下文...');
      projectContext = gatherProjectContext(this.rootPath);
    }

    console.log(`📊 开始扫描 ${files.length} 个文件...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (i % 20 === 0) {
        console.log(`  进度: ${i}/${files.length}`);
      }

      try {
        const analyzer = new FrontendInteractionAnalyzer(file);
        let result = analyzer.analyze();

        // Apply cross-validation to adjust confidence scores
        if (enableCrossValidation && projectContext) {
          result = validateWithContext(result, projectContext);
        }

        results.push(result);
      } catch (e) {
        // 忽略解析错误
      }
    }

    // Aggregate: deduplicate, consensus scoring, skill routing
    const aggregation = aggregateResults(results, { minConfidence, enableDedup });

    // Auto-record scan results for true-positive tracking
    const allIssuesForTracking = results.flatMap(r => r.issues.map(i => ({ type: i.type, file: i.file, line: i.line })));
    logScanResults(allIssuesForTracking);

    console.log(`✅ 扫描完成，发现 ${aggregation.stats.totalAfterDedup} 个问题（去重率 ${(aggregation.stats.dedupRate * 100).toFixed(1)}%）`);
    console.log(formatAggregationSummary(aggregation));

    return aggregation.issues;
  }

  /**
   * 按严重程度分组
   */
  groupBySeverity(issues: AggregatedIssue[]): Record<string, AggregatedIssue[]> {
    return {
      P0: issues.filter(i => i.severity === 'P0'),
      P1: issues.filter(i => i.severity === 'P1'),
      P2: issues.filter(i => i.severity === 'P2'),
    };
  }

  /**
   * 按类型分组
   */
  groupByType(issues: AggregatedIssue[]): Record<string, AggregatedIssue[]> {
    const groups: Record<string, AggregatedIssue[]> = {};

    for (const issue of issues) {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
      groups[issue.type].push(issue);
    }

    return groups;
  }
}

// ── Scanning with cross-validation and aggregation ──

export async function runInteractiveScan(
  rootPath: string = 'orion-frontend/src/pages/',
  maxFiles: number = 100,
  options: { minConfidence?: number; enableCrossValidation?: boolean; enableDedup?: boolean } = {},
): Promise<AggregatedIssue[]> {
  const scanner = new InteractionScanner(rootPath);
  return scanner.scan(maxFiles, options);
}

// ── Cross-validation exports ──

export { gatherProjectContext, validateWithContext, filterByConfidence, ProjectContext } from './cross-validator';

// ── Issue Aggregator exports ──

export {
  aggregateResults,
  groupBySkill,
  groupByFile,
  formatAggregationSummary,
  AggregatedIssue,
  AggregationResult,
} from './issue-aggregator';

export {
  detectRegressions,
  formatRegressionReport,
  RegressionReport,
  RegressionOptions,
} from './regression-detector';

export {
  logFalsePositive,
  logScanResults,
  getAdjustedConfidence,
  getStatsForType,
  getTruePositiveCount,
  recalibrateConfidences,
  generateConfidenceFilters,
  getFPSummary,
  FalsePositiveReport,
  FPStats,
} from './false-positive-logger';

export {
  verifyInteractionChain,
  verifyOrionCompliance,
  generateTestSkeleton,
  formatVerificationReport,
  VerificationReport,
  CheckResult,
} from './verification-gate';

export {
  getSkillOwner,
  getConsumerSkills,
  isDuplicatedCheck,
  formatRoutingSummary,
  CLAUDE_MD_DUPLICATES,
} from './skill-routing-manifest';

// ── Multi-Language Scanner exports ──

export {
  MultiLangScanner,
  formatMultiLangSummary,
  MultiLangScanResult,
  GoScanResult,
  PyScanResult,
} from './multi-lang-scanner';

export {
  getTsFiles,
  getGoFiles,
  getPyFiles,
  getJavaFiles,
} from './file-utils';

// ── ast-grep Scanner exports ──

export {
  astGrepScan,
  formatAstGrepResult,
  BUILTIN_RULES,
  AstGrepRule,
  AstGrepResult,
} from './ast-grep-scanner';

// ── Backend Interaction Scanner exports ──

export {
  scanBackendInteraction,
  formatBackendInteractionResult,
  GO_INTERACTION_RULES,
  PYTHON_INTERACTION_RULES,
} from './detectors/backend-interaction';

// 使用示例
// runInteractiveScan('orion-frontend/src/pages/', 50).then(issues => {
//   console.log(JSON.stringify(issues, null, 2));
// });
