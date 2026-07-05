/**
 * Search Detector — Single-pass AST analysis
 * Detects: missing-empty-search
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

export class MissingEmptySearchDetector extends BaseDetector {
  private searchLine = 1;
  private searchColumn = 1;
  private hasSearch = false;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (this.hasSearch) return;

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Input.Search' || tagName === 'Search') {
        this.hasSearch = true;
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.searchLine = loc.line + 1;
        this.searchColumn = loc.character + 1;
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'onSearch') {
      this.hasSearch = true;
      const pos = node.getStart(this.sourceFile);
      const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
      this.searchLine = loc.line + 1;
      this.searchColumn = loc.character + 1;
    }

    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      if (/^(handleSearch|onSearch|doSearch|performSearch)$/i.test(node.name.text)) {
        this.hasSearch = true;
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.searchLine = loc.line + 1;
        this.searchColumn = loc.character + 1;
      }
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (/^(searchValue|searchText|keyword|searchQuery)$/i.test(node.name.text)) {
        this.hasSearch = true;
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.searchLine = loc.line + 1;
        this.searchColumn = loc.character + 1;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    // Fall back to regex if AST didn't find it
    if (!this.hasSearch) {
      const code = this.content
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/onSearch|handleSearch|searchValue|searchText|keyword/i.test(code)) {
        this.hasSearch = true;
      }
    }

    if (!this.hasSearch) return [];

    const hasEmptySearch =
      /no result|无结果|未找到|empty.*search|search.*empty/i.test(this.content.toLowerCase()) ||
      /data(Source)?\.length\s*===?\s*0|<Empty|emptyText|locale\s*=\s*\{\s*empty/i.test(this.content) ||
      /searchResults\.length\s*===?\s*0|filteredData\.length\s*===?\s*0/i.test(this.content);

    if (hasEmptySearch) return [];

    return [{
      file: this.filePath, line: this.searchLine, column: this.searchColumn,
      type: 'missing-empty-search', severity: 'P1',
      message: '搜索功能缺少空结果提示',
      suggestion: '在搜索结果为空时显示友好提示，如"未找到相关结果"',
    }];
  }

  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}
