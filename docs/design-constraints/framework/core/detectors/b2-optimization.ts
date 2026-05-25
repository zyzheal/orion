/**
 * B2 Optimization Layer Detectors — performance-related AST analysis.
 *
 * All detectors support single-pass AST traversal.
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

// ── B2-07/08: Missing Lazy Loading ──

export class MissingLazyLoadDetector extends BaseDetector {
  private syncImports: { name: string; line: number }[] = [];
  private hasLazy = false;
  private hasDynamicImport = false;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const importPath = node.moduleSpecifier.getText(this.sourceFile);
      if (/from ['"](\.|@)/.test(node.getText(this.sourceFile)) &&
          !/tokens|utils|hooks|api|types|config/.test(importPath)) {
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        const name = node.importClause.getText(this.sourceFile);
        if (/Page|Container|Layout|Dashboard|Table|Chart|Graph/.test(name)) {
          this.syncImports.push({ name, line: loc.line + 1 });
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.expression.getText(this.sourceFile) === 'React' &&
          node.expression.name.text === 'lazy') {
        this.hasLazy = true;
      }
    }

    // Track dynamic import(): import('...')
    // Dynamic import is: CallExpression where expression is the 'import' keyword
    // TypeScript doesn't expose isImportExpression, so we detect via parent check
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if ((expr as unknown as { kind: number }).kind === ts.SyntaxKind.ImportKeyword) {
        this.hasDynamicImport = true;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    if (!this.hasLazy && !this.hasDynamicImport && this.syncImports.length > 0) {
      for (const imp of this.syncImports) {
        this.issues.push({
          file: this.filePath, line: imp.line, column: 1,
          type: 'missing-lazy-load', severity: 'P2',
          message: `组件 "${imp.name}" 应使用懒加载优化首屏性能`,
          suggestion: '使用 React.lazy(() => import("./Component")) 或动态 import()',
          confidence: 60, requiresConfirmation: true,
        });
      }
    }
    return this.issues;
  }

  analyze(): InteractionIssue[] {
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.getIssues();
  }
}

// ── B2-15: Missing Request Cancellation ──

export class MissingRequestCancelDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
      if (!isAsync || !node.body) return;

      const bodyText = node.body.getText(this.sourceFile);
      const hasApiCall = /fetch\(|axios\.|useRequest\(|useMutation\(|\.get\(|\.post\(/.test(bodyText);
      if (!hasApiCall) return;

      const hasCancellation = /AbortController|AbortSignal|abort|cancelToken|useRequest.*{.*cancel/.test(bodyText) ||
        /return.*cleanup|return.*\(\).*=>|useEffect.*return/.test(bodyText);

      if (!hasCancellation) {
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.issues.push({
          file: this.filePath, line: loc.line + 1, column: loc.character + 1,
          type: 'missing-request-cancel', severity: 'P1',
          message: '异步请求缺少取消机制（组件卸载时可能造成内存泄漏）',
          suggestion: '使用 AbortController 或 useRequest({ cancel: true }) 在组件卸载时取消请求',
          confidence: 75, requiresConfirmation: true,
        });
      }
    }
  }

  analyze(): InteractionIssue[] {
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }
}

// ── B2-14: Missing Request Merge ──

export class MissingRequestMergeDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (!node.body) return;

      const bodyText = node.body.getText(this.sourceFile);
      const apiCalls = bodyText.match(/await\s+\w+Api\.\w+/g) || [];
      if (apiCalls.length < 2) return;

      const callCounts: Record<string, number> = {};
      for (const call of apiCalls) {
        callCounts[call] = (callCounts[call] || 0) + 1;
      }

      const duplicates = Object.entries(callCounts).filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.issues.push({
          file: this.filePath, line: loc.line + 1, column: loc.character + 1,
          type: 'missing-request-merge', severity: 'P2',
          message: `存在重复 API 调用：${duplicates.map(([c]) => c).join(', ')}，可合并为单次请求`,
          suggestion: '将重复调用合并为单次请求，或在组件级缓存结果',
          confidence: 70, requiresConfirmation: true,
        });
      }
    }
  }

  analyze(): InteractionIssue[] {
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }
}
