/**
 * Responsive Detector — 检测响应式适配缺失
 * Detects: missing-responsive
 *
 * Uses AST to find:
 * - Fixed width values (e.g., width: '1200px') instead of responsive layouts
 * - Missing Ant Design Row/Col responsive breakpoints
 * - Table components without scroll={{ x: true }} for mobile adaptation
 * - Modal/Drawer with fixed width not adjusted responsively
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

// Responsive patterns in Ant Design / CSS
const RESPONSIVE_PATTERNS: RegExp[] = [
  /xs=|sm=|md=|lg=|xl=|xxl=/,
  /\{[\s]*xs[\s]*:|[\s]*sm[\s]*:|[\s]*md[\s]*:/,
  /useMediaQuery|useBreakpoint|useWindowSize/,
  /@media/,
  /matchMedia/,
  /window\.innerWidth/,
  /responsive/,
];

export class MissingResponsiveDetector extends BaseDetector {
  private reported = new Set<string>();
  private hasResponsiveUsage = false;
  private fixedWidthIssues: { line: number; column: number; detail: string }[] = [];

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    // ── Detect responsive patterns anywhere in the file ──
    const text = node.getText(this.sourceFile);
    if (RESPONSIVE_PATTERNS.some(p => p.test(text))) {
      this.hasResponsiveUsage = true;
    }

    // ── Detect fixed px width in style objects ──
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const propName = node.name.text;
      if (propName === 'width' || propName === 'minWidth' || propName === 'maxWidth') {
        const init = node.initializer;
        if (ts.isStringLiteral(init) && /^\d+px$/.test(init.text)) {
          const px = parseInt(init.text, 10);
          if (px > 600) {
            const { line, column } = this.getLineColumn(node);
            const key = `fixed-${propName}-${line}-${column}`;
            if (!this.reported.has(key)) {
              this.reported.add(key);
              this.fixedWidthIssues.push({ line, column, detail: `${propName}: '${init.text}'` });
            }
          }
        }
      }
    }

    // ── Table without scroll={{ x: true }} ──
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Table' || tagName.endsWith('.Table')) {
        const attrs = node.attributes;
        let hasScrollX = false;
        if (ts.isArray(attrs)) {
          for (const attr of attrs) {
            if (ts.isJsxAttribute(attr) && attr.name.getText(this.sourceFile) === 'scroll') {
              hasScrollX = true;
              break;
            }
          }
        }
        if (!hasScrollX) {
          const { line, column } = this.getLineColumn(node);
          const key = `table-no-scroll-x-${line}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.reportIssue({
              file: this.filePath, line, column,
              type: 'missing-responsive', severity: 'P2',
              message: 'Table 组件缺少 scroll 属性，小屏时可能溢出',
              suggestion: '添加 scroll={{ x: true }} 使表格在小屏时可横向滚动',
            });
          }
        }
      }

      // ── Modal/Drawer with fixed px width ──
      if (tagName === 'Modal' || tagName === 'Drawer') {
        const attrs = node.attributes;
        if (ts.isArray(attrs)) {
          for (const attr of attrs) {
            if (ts.isJsxAttribute(attr) && attr.name.getText(this.sourceFile) === 'width') {
              if (attr.initializer && ts.isStringLiteral(attr.initializer) && /^\d+px$/.test(attr.initializer.text)) {
                const { line, column } = this.getLineColumn(node);
                const key = `modal-fixed-width-${line}`;
                if (!this.reported.has(key)) {
                  this.reported.add(key);
                  this.reportIssue({
                    file: this.filePath, line, column,
                    type: 'missing-responsive', severity: 'P2',
                    message: `${tagName} 使用固定宽度 ${attr.initializer.text}，未响应式适配`,
                    suggestion: '使用百分比宽度（如 "80%"）或根据屏幕宽度动态设置 width',
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  getIssues(): InteractionIssue[] {
    // File-level report if no responsive patterns found
    if (!this.hasResponsiveUsage && this.fixedWidthIssues.length > 0) {
      const first = this.fixedWidthIssues[0];
      this.reportIssue({
        file: this.filePath, line: first.line, column: first.column,
        type: 'missing-responsive', severity: 'P1',
        message: `页面使用固定宽度布局（${first.detail}）但缺少响应式适配`,
        suggestion: '使用 Ant Design Row/Col 的 xs/sm/md/lg 断点或 CSS @media 查询实现响应式布局',
      });
    }
    return this.issues;
  }

  analyze(): InteractionIssue[] {
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.getIssues();
  }
}
