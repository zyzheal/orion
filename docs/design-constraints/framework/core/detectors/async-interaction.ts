/**
 * Async Interaction Detector — Single-pass AST analysis
 * Detects: missing-feedback, missing-loading, missing-network-error, missing-business-error
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

// Shared state for single-pass across all 4 detectors
interface AsyncPassState {
  componentLoadingVars: string[];
  asyncFuncs: Array<{ node: ts.FunctionLikeDeclaration; name: string; line: number; column: number }>;
  catchBlocks: Array<{ node: ts.CatchClause; line: number; column: number }>;
  onClickHandlers: Array<{ node: ts.FunctionLikeDeclaration; line: number; column: number }>;
  useRequests: Array<{ node: ts.CallExpression; line: number; column: number }>;
  reportedFeedback: Set<string>;
  reportedLoading: Set<number>;
  reportedNetwork: Set<number>;
}

export class MissingFeedbackDetector extends BaseDetector {
  private state: AsyncPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
    // Detection is done in getIssues() after full state gathered
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
    const s = this.state;
    const issues: InteractionIssue[] = [];

    // Check onClick handlers
    for (const h of s.onClickHandlers) {
      const hasMsg = this.hasMessageCall(h.node);
      const hasTry = this.hasTryCatch(h.node);
      const isAsync = h.node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      const key = `onClick-${h.line}-${h.column}`;
      if (isAsync && !hasMsg && !hasTry && !s.reportedFeedback.has(key)) {
        s.reportedFeedback.add(key);
        issues.push({
          file: this.filePath, line: h.line, column: h.column,
          type: 'missing-feedback', severity: 'P0',
          message: '异步操作缺少成功/失败提示',
          suggestion: '添加 message.success() 或 message.error() 反馈',
        });
      }
    }

    // Check async methods
    for (const f of s.asyncFuncs) {
      const hasMsg = this.hasMessageCall(f.node);
      const hasTry = this.hasTryCatch(f.node);
      const key = `method-${f.name}`;
      if (/^(handle|on|submit|save|delete|create|update|remove)/i.test(f.name) &&
          !hasMsg && !hasTry && !s.reportedFeedback.has(key)) {
        s.reportedFeedback.add(key);
        issues.push({
          file: this.filePath, line: f.line, column: f.column,
          type: 'missing-feedback', severity: 'P0',
          message: `方法 ${f.name} 缺少操作反馈`,
          suggestion: '添加 message.success() 或 message.error() 反馈',
        });
      }
    }

    // Check useRequest
    for (const r of s.useRequests) {
      const options = r.node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const hasSuccess = options.properties.some(
          p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'onSuccess'
        );
        const hasError = options.properties.some(
          p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'onError'
        );
        const key = `useRequest-${r.line}-${r.column}`;
        if (!hasSuccess && !hasError && !s.reportedFeedback.has(key)) {
          s.reportedFeedback.add(key);
          issues.push({
            file: this.filePath, line: r.line, column: r.column,
            type: 'missing-feedback', severity: 'P0',
            message: 'useRequest 缺少 onSuccess/onError 回调处理',
            suggestion: '添加 onSuccess: () => message.success("成功") 或 onError 回调',
          });
        }
      }
    }

    return issues;
  }

  analyze(): InteractionIssue[] {
    this.state = gatherAsyncState(this.sourceFile, this.content);
    return this.getIssues();
  }
}

export class MissingLoadingDetector extends BaseDetector {
  private state: AsyncPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
    const s = this.state;
    const issues: InteractionIssue[] = [];

    for (const h of s.onClickHandlers) {
      const isAsync = h.node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      const hasIndividual = hasIndividualLoading(h.node);
      const usesComponent = functionUsesLoading(h.node, s.componentLoadingVars);
      if (isAsync && !hasIndividual && !usesComponent && !s.reportedLoading.has(h.line)) {
        s.reportedLoading.add(h.line);
        issues.push({
          file: this.filePath, line: h.line, column: h.column,
          type: 'missing-loading', severity: 'P0',
          message: '异步操作缺少 loading 状态',
          suggestion: '添加 loading state 并在操作时设置按钮 disabled',
        });
      }
    }

    for (const f of s.asyncFuncs) {
      const hasLoading = hasLoadingInBody(f.node);
      const usesComponent = functionUsesLoading(f.node, s.componentLoadingVars);
      if (!hasLoading && !usesComponent && !s.reportedLoading.has(f.line) &&
          /^(handle|on|submit|save|delete|create|update|remove|fetch|load)/i.test(f.name)) {
        s.reportedLoading.add(f.line);
        issues.push({
          file: this.filePath, line: f.line, column: f.column,
          type: 'missing-loading', severity: 'P0',
          message: `方法 ${f.name} 缺少 loading 状态`,
          suggestion: '添加 loading state 并在操作前设置为 true，操作完成后设置为 false',
        });
      }
    }

    for (const r of s.useRequests) {
      const options = r.node.arguments[0] || r.node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const hasLoadingProp = options.properties.some(
          p => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'loading'
        );
        if (!hasLoadingProp && !s.reportedLoading.has(r.line)) {
          s.reportedLoading.add(r.line);
          issues.push({
            file: this.filePath, line: r.line, column: r.column,
            type: 'missing-loading', severity: 'P0',
            message: 'useRequest 未配置 loading 状态',
            suggestion: '配置 loading 状态: const { loading, run } = useRequest(...)',
          });
        }
      }
    }

    return issues;
  }

  analyze(): InteractionIssue[] {
    this.state = gatherAsyncState(this.sourceFile, this.content);
    return this.getIssues();
  }
}

export class MissingNetworkErrorDetector extends BaseDetector {
  private state: AsyncPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
    const s = this.state;
    const issues: InteractionIssue[] = [];

    for (const f of s.asyncFuncs) {
      if (/^(handle|load|fetch|save|submit|create|update|delete|remove)/i.test(f.name)) {
        const hasTryCatch = this.hasTryCatch(f.node);
        if (!hasTryCatch && !s.reportedNetwork.has(f.line)) {
          s.reportedNetwork.add(f.line);
          issues.push({
            file: this.filePath, line: f.line, column: f.column,
            type: 'missing-network-error', severity: 'P0',
            message: `方法 ${f.name} 缺少网络错误处理`,
            suggestion: '添加 try-catch 块处理网络错误',
          });
        }
      }
    }

    // Check for ErrorBoundary — independent of other issues
    const hasErrorBoundary = /ErrorBoundary|componentDidCatch|getDerivedStateFromError/i.test(this.content);
    if (!hasErrorBoundary) {
      const hasApiCalls = /await\s+\w+Api\.|await\s+request\(|await\s+axios/i.test(this.content);
      const hasAnyTryCatch = /try\s*\{[\s\S]*catch/i.test(this.content);
      if (hasApiCalls && !hasAnyTryCatch) {
        // Find the line of the first API call or async function for accurate issue location
        let targetLine = 1;
        let targetColumn = 1;
        if (s.asyncFuncs.length > 0) {
          targetLine = s.asyncFuncs[0].line;
          targetColumn = s.asyncFuncs[0].column;
        } else if (s.useRequests.length > 0) {
          targetLine = s.useRequests[0].line;
          targetColumn = s.useRequests[0].column;
        } else if (s.onClickHandlers.length > 0) {
          targetLine = s.onClickHandlers[0].line;
          targetColumn = s.onClickHandlers[0].column;
        }
        issues.push({
          file: this.filePath, line: targetLine, column: targetColumn,
          type: 'missing-network-error', severity: 'P0',
          message: '页面缺少 Error Boundary 组件',
          suggestion: '添加 Error Boundary 组件捕获渲染错误',
        });
      }
    }

    return issues;
  }

  analyze(): InteractionIssue[] {
    this.state = gatherAsyncState(this.sourceFile, this.content);
    return this.getIssues();
  }
}

export class MissingBusinessErrorDetector extends BaseDetector {
  private state: AsyncPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) {
      this.state = gatherAsyncState(this.sourceFile, this.content);
    }
    const issues: InteractionIssue[] = [];

    for (const cb of this.state.catchBlocks) {
      const catchBody = cb.node.block.getText(this.sourceFile);
      const hasMessage = /message\.error|notification\.error|Modal\.error|Modal\.warning/i.test(catchBody);
      const hasErrorHandling = hasMessage ||
        /setError|setApiError|setErrorMessage/i.test(catchBody) ||
        /throw\s+new\s+Error|throw\s+error/i.test(catchBody) ||
        /return\s+\{.*error|return\s+Promise\.reject/i.test(catchBody) ||
        /logger\.error|console\.error.*用户|reportError/i.test(catchBody) ||
        /handleError|showError|displayError/i.test(catchBody);

      const bodyClean = catchBody.replace(/\s+/g, '').replace(/\/\/.*/g, '').replace(/\/\*.*?\*\//g, '');
      const isEmpty = bodyClean === '{}' || bodyClean.length < 10;

      if (!hasErrorHandling || isEmpty) {
        issues.push({
          file: this.filePath, line: cb.line, column: cb.column,
          type: 'missing-business-error', severity: 'P0',
          message: isEmpty ? 'catch 块为空，缺少错误处理' : 'catch 块缺少用户可见的错误提示',
          suggestion: '在 catch 块中使用 message.error 显示错误信息，或设置错误状态',
        });
      }
    }

    return issues;
  }

  analyze(): InteractionIssue[] {
    this.state = gatherAsyncState(this.sourceFile, this.content);
    return this.getIssues();
  }
}

// ── Shared state gathering (single-pass) ──

function gatherAsyncState(sourceFile: ts.SourceFile, content: string): AsyncPassState {
  const state: AsyncPassState = {
    componentLoadingVars: [],
    asyncFuncs: [],
    catchBlocks: [],
    onClickHandlers: [],
    useRequests: [],
    reportedFeedback: new Set(),
    reportedLoading: new Set(),
    reportedNetwork: new Set(),
  };

  // Pre-scan loading states from content (regex is faster for this)
  const useStatePattern = /const\s+\[(\w*(?:loading|submitting|saving|fetching|executing|processing|running|working|actioning|deleting|creating|updating|exporting|generating|uploading|downloading|importing|applying|refreshing|searching|validating|checking|sending|building)\w*)\s*,\s*\w+\]\s*=\s*useState/gi;
  for (const match of content.matchAll(useStatePattern)) {
    if (match[1] && !state.componentLoadingVars.includes(match[1])) state.componentLoadingVars.push(match[1]);
  }
  const patterns2 = [
    /const\s+\[(loading|submitting|saving|fetching|executing|processing|exporting|generating|actionLoading|detailLoading|modalLoading|tableLoading|listLoading|isProcessing|isSubmitting|isSaving|isLoading|isExecuting|isFetching|isExporting|isGenerating)\s*,/gi,
    /const\s+\[(\w+Loading)\s*,/gi,
    /const\s+\[(is\w+)\s*,\s*set\1\]\s*=\s*useState\((?:true|false)\)/gi,
  ];
  for (const p of patterns2) {
    for (const match of content.matchAll(p)) {
      if (match[1] && !state.componentLoadingVars.includes(match[1])) state.componentLoadingVars.push(match[1]);
    }
  }

  // Semantic keyword matching: catch custom loading names like isSavingData, fetchInProgress, requestActive
  const SEMANTIC_LOADING_KEYWORDS = [
    'InProgress', 'Active', 'Busy', 'Pending', 'Working',
    'Processing', 'Executing', 'Running', 'Handling',
  ];
  const semanticPattern = /const\s+\[(\w+)\s*,\s*\w+\]\s*=\s*useState\s*\(\s*(?:true|false)\s*\)/g;
  for (const match of content.matchAll(semanticPattern)) {
    const varName = match[1];
    if (!varName || state.componentLoadingVars.includes(varName)) continue;
    const isSemanticallyLoading = SEMANTIC_LOADING_KEYWORDS.some(kw => varName.includes(kw));
    if (isSemanticallyLoading) {
      state.componentLoadingVars.push(varName);
    }
  }

  const visit = (node: ts.Node) => {
    // onClick handlers
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'onClick') {
      const handler = node.initializer;
      if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
        const pos = handler.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        state.onClickHandlers.push({ node: handler, line: loc.line + 1, column: loc.character + 1 });
      }
    }

    // Async functions/methods
    let funcNode: ts.FunctionLikeDeclaration | null = null;
    let funcName = '';
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
      const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      if (isAsync && node.body) {
        funcNode = node;
        funcName = ts.isIdentifier(node.name) ? node.name.text : 'anonymous';
      }
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isVariableDeclaration(decl) && decl.initializer) {
          const init = decl.initializer;
          if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && init.body) {
            const isAsync = init.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
            if (isAsync) {
              funcNode = init;
              funcName = decl.name.getText(sourceFile);
            }
          }
        }
      }
    }
    if (funcNode) {
      const pos = funcNode.getStart(sourceFile);
      const loc = sourceFile.getLineAndCharacterOfPosition(pos);
      state.asyncFuncs.push({ node: funcNode, name: funcName, line: loc.line + 1, column: loc.character + 1 });
    }

    // useRequest/useMutation
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && /^use(Request|Mutation|Async)$/.test(expr.text)) {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        state.useRequests.push({ node, line: loc.line + 1, column: loc.character + 1 });
      }
    }

    // Catch clauses
    if (ts.isCatchClause(node)) {
      const pos = node.getStart(sourceFile);
      const loc = sourceFile.getLineAndCharacterOfPosition(pos);
      state.catchBlocks.push({ node, line: loc.line + 1, column: loc.character + 1 });
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return state;
}

// ── Loading helpers (pure functions, no `this` dependency) ──

function hasLoadingInBody(func: ts.FunctionLikeDeclaration): boolean {
  const visit = (node: ts.Node): boolean => {
    if (ts.isCallExpression(node)) {
      const text = node.getText();
      if (/setLoading|setSubmitting|setSaving/.test(text)) return true;
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) &&
        (node.name.text === 'loading' || node.name.text === 'disabled')) return true;
    return ts.forEachChild(node, visit) ?? false;
  };
  return func.body ? visit(func.body) : false;
}

function hasIndividualLoading(handler: ts.FunctionLikeDeclaration): boolean {
  const text = handler.getText();
  return /(?:loading|submitting|saving|fetching|processing)\s*[?=]|set(?:Loading|Submitting|Saving|Fetching|Processing|TableLoading|ModalLoading)|disabled\s*=\s*\{[^}]*loading/i.test(text);
}

function functionUsesLoading(func: ts.FunctionLikeDeclaration, loadingVars: string[]): boolean {
  if (loadingVars.length === 0) return false;
  const text = func.getText();
  for (const v of loadingVars) {
    const setter = 'set' + v.charAt(0).toUpperCase() + v.slice(1);
    if (new RegExp(`\\b${v}\\b|\\b${setter}\\b`).test(text)) return true;
  }
  return false;
}
