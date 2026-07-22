/**
 * List Interaction Detector — Single-pass AST analysis
 * Detects: missing-batch, missing-pagination, missing-skeleton, missing-data-empty
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

export class MissingBatchDetector extends BaseDetector {
  private reported = false;
  supportsSinglePass(): boolean { return true; }
  visitNode(node: ts.Node): void {
    if (this.reported) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Table') {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && attr.name.text === 'rowSelection') {
            if (!/批量操作|batchAction|批量删除|batchDelete|selectedRowKeys|handleBatch|handleDeleteSelected/i.test(this.content)) {
              const { line, column } = this.getLineColumn(node);
              this.issues.push({ file: this.filePath, line, column, type: 'missing-batch', severity: 'P1', message: '表格支持行选择但缺少批量操作功能', suggestion: '添加批量操作按钮、进度提示和失败处理' });
              this.reported = true;
            }
            break;
          }
        }
      }
    }
  }
  analyze(): InteractionIssue[] { this.issues = []; this.reported = false; const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.issues; }
}

export class MissingPaginationDetector extends BaseDetector {
  private hasPaginationOrTable = false;
  private firstLine = 1;
  supportsSinglePass(): boolean { return true; }
  visitNode(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Pagination' || tagName === 'Table') {
        this.hasPaginationOrTable = true;
        if (this.firstLine === 1) {
          const { line } = this.getLineColumn(node);
          this.firstLine = line;
        }
      }
    }
  }
  getIssues(): InteractionIssue[] {
    if (!this.hasPaginationOrTable) {
      this.hasPaginationOrTable = /<Pagination\b/.test(this.content) || /pagination\s*:\s*\{/.test(this.content);
    }
    if (!this.hasPaginationOrTable) return [];
    if (!/showQuickJumper|showSizeChanger|pageSizeOptions/i.test(this.content)) {
      return [{ file: this.filePath, line: this.firstLine || 1, column: 1, type: 'missing-pagination', severity: 'P1', message: '分页组件缺少边界处理', suggestion: '添加 showQuickJumper、showSizeChanger 和 pageSizeOptions' }];
    }
    return [];
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}

export class MissingSkeletonDetector extends BaseDetector {
  private hasDataLoading = false;
  private hasSkeleton = false;
  private firstLoadingLine = 1;
  supportsSinglePass(): boolean { return true; }
  visitNode(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && /^(useEffect|useRequest|fetch)$/.test(callee.text)) {
        this.hasDataLoading = true;
        if (this.firstLoadingLine === 1) {
          const { line } = this.getLineColumn(node);
          this.firstLoadingLine = line;
        }
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(this.sourceFile) === 'Skeleton') this.hasSkeleton = true;
    }
  }
  getIssues(): InteractionIssue[] {
    // Fallback to regex for loading detection
    if (!this.hasDataLoading) {
      this.hasDataLoading = /loading\s*=/.test(this.content);
      if (this.hasDataLoading && this.firstLoadingLine === 1) {
        const match = this.content.match(/useEffect|useRequest|loading\s*=/i);
        if (match) {
          this.firstLoadingLine = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
        }
      }
    }
    if (!this.hasSkeleton) this.hasSkeleton = /<Skeleton\b|Skeleton\.|placeholder|Placeholder/i.test(this.content);
    const hasLoadingState = /loading\s*[=?]|setLoading/i.test(this.content);
    if (this.hasDataLoading && !this.hasSkeleton && !hasLoadingState) {
      return [{ file: this.filePath, line: this.firstLoadingLine || 1, column: 1, type: 'missing-skeleton', severity: 'P1', message: '数据加载缺少骨架屏或占位符', suggestion: '添加 <Skeleton> 组件提升加载体验' }];
    }
    return [];
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}

export class MissingDataEmptyDetector extends BaseDetector {
  private hasTableOrList = false;
  private hasEmptyComponent = false;
  private hasLocaleEmpty = false;
  private firstTableLine = 1;
  supportsSinglePass(): boolean { return true; }
  visitNode(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Table' || tagName === 'List') {
        this.hasTableOrList = true;
        if (this.firstTableLine === 1) {
          const { line } = this.getLineColumn(node);
          this.firstTableLine = line;
        }
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && attr.name.text === 'locale' && attr.initializer) {
            if (/emptyText/.test(attr.initializer.getText(this.sourceFile))) this.hasLocaleEmpty = true;
          }
        }
      }
      if (tagName === 'Empty') this.hasEmptyComponent = true;
    }
  }
  getIssues(): InteractionIssue[] {
    if (this.hasTableOrList && /dataSource=|data=/.test(this.content) && !this.hasEmptyComponent && !this.hasLocaleEmpty) {
      return [{ file: this.filePath, line: this.firstTableLine || 1, column: 1, type: 'missing-data-empty', severity: 'P1', message: '表格/列表缺少空数据展示', suggestion: '添加 locale={{ emptyText: <Empty /> }} 或 empty 属性' }];
    }
    return [];
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}
