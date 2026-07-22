/**
 * Error Boundary Detector — Single-pass AST analysis
 * Detects: missing-error-boundary
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue, API_CALL_PATTERNS, ERROR_BOUNDARY_PATTERNS } from './base';

export class MissingErrorBoundaryDetector extends BaseDetector {
  private hasApiCalls = false;
  private hasErrorBoundary = false;
  private componentsWithApi: { name: string; line: number; column: number }[] = [];

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    // API call detection
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      const callee = node.expression.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const obj = callee.expression.getText(this.sourceFile);
        if (/Api$/.test(obj) || obj === 'request' || obj === 'axios') this.hasApiCalls = true;
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && /^(useRequest|useMutation|fetch)$/.test(callee.text)) this.hasApiCalls = true;
    }

    // ErrorBoundary detection
    if (ts.isImportDeclaration(node) && ERROR_BOUNDARY_PATTERNS.some(p => p.test(node.getText(this.sourceFile)))) {
      this.hasErrorBoundary = true;
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(this.sourceFile).includes('ErrorBoundary')) {
      this.hasErrorBoundary = true;
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(this.sourceFile).includes('ErrorBoundary')) {
      this.hasErrorBoundary = true;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'withErrorBoundary') {
      this.hasErrorBoundary = true;
    }

    // Component-level API call detection
    if (ts.isFunctionDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (/^[A-Z]/.test(name) && node.body && API_CALL_PATTERNS.some(p => p.test(node.body!.getText(this.sourceFile)))) {
        const { line, column } = this.getLineColumn(node);
        this.componentsWithApi.push({ name, line, column });
      }
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && /^[A-Z]/.test(decl.name.text)) {
          const init = decl.initializer;
          if (init && init.getText(this.sourceFile).length > 10 &&
              API_CALL_PATTERNS.some(p => p.test(init.getText(this.sourceFile)))) {
            const { line, column } = this.getLineColumn(decl);
            this.componentsWithApi.push({ name: decl.name.text, line, column });
          }
        }
      }
    }
  }

  getIssues(): InteractionIssue[] {
    // Fallback for complex patterns
    if (!this.hasApiCalls) this.hasApiCalls = API_CALL_PATTERNS.some(p => p.test(this.content));
    if (!this.hasErrorBoundary) this.hasErrorBoundary = ERROR_BOUNDARY_PATTERNS.some(p => p.test(this.content));

    if (!this.hasApiCalls || this.hasErrorBoundary) return [];

    const issues: InteractionIssue[] = [];
    if (this.componentsWithApi.length > 0) {
      for (const comp of this.componentsWithApi) {
        issues.push({
          file: this.filePath, line: comp.line, column: comp.column,
          type: 'missing-error-boundary', severity: 'P1',
          message: `组件 ${comp.name} 包含 API 调用但缺少 ErrorBoundary 包裹`,
          suggestion: '使用 <ErrorBoundary> 组件包裹可能抛出错误的子组件',
        });
      }
    } else {
      issues.push({
        file: this.filePath, line: 1, column: 1,
        type: 'missing-error-boundary', severity: 'P1',
        message: '页面包含 API 调用但缺少 ErrorBoundary 包裹',
        suggestion: '在组件树顶层添加 <ErrorBoundary> 组件捕获渲染和异步错误',
      });
    }
    return issues;
  }

  analyze(): InteractionIssue[] {
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.getIssues();
  }
}
