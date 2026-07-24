/**
 * Accessibility (a11y) Detector — 检测可访问性缺失
 * Detects: missing-a11y
 *
 * Checks:
 * - Button with icon but no aria-label
 * - img without alt attribute
 * - Form.Item with label but no htmlFor
 * - Low color contrast pairs
 * - Input without aria-label or placeholder
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

// Known low-contrast color pairs (fg on white or near-white bg)
const LOW_CONTRAST_HEX = new Set([
  '#bfbfbf', '#d9d9d9', '#e8e8e8',
]);

export class MissingA11yDetector extends BaseDetector {
  private reported = new Set<string>();

  supportsSinglePass(): boolean { return true; }

  /** Check a JsxAttribute array for a specific attribute name. */
  private hasAttr(attributes: ts.NodeArray<ts.JsxAttributeLike>, name: string): boolean {
    for (const attr of attributes) {
      if (ts.isJsxAttribute(attr) && attr.name.getText(this.sourceFile) === name) {
        return true;
      }
    }
    return false;
  }

  visitNode(node: ts.Node): void {
    if (!ts.isJsxSelfClosingElement(node)) return;

    const tagName = node.tagName.getText(this.sourceFile);
    const attrs = node.attributes;

    if (!ts.isArray(attrs)) return;

    // ── 1. Icon-only Button without aria-label ──
    if (tagName === 'Button' || tagName.endsWith('.Button')) {
      const hasIcon = this.hasAttr(attrs, 'icon');
      const hasAria = this.hasAttr(attrs, 'aria-label');
      if (hasIcon && !hasAria) {
        const { line, column } = this.getLineColumn(node);
        const key = `btn-icon-no-aria-${line}-${column}`;
        if (!this.reported.has(key)) {
          this.reported.add(key);
          this.reportIssue({
            file: this.filePath, line, column,
            type: 'missing-a11y', severity: 'P2',
            message: 'Icon Button 缺少 aria-label，屏幕阅读器无法识别按钮用途',
            suggestion: '为仅有图标的按钮添加 aria-label 属性',
          });
        }
      }
    }

    // ── 2. img without alt ──
    if (tagName === 'img') {
      const hasAlt = this.hasAttr(attrs, 'alt');
      if (!hasAlt) {
        const { line, column } = this.getLineColumn(node);
        const key = `img-no-alt-${line}-${column}`;
        if (!this.reported.has(key)) {
          this.reported.add(key);
          this.reportIssue({
            file: this.filePath, line, column,
            type: 'missing-a11y', severity: 'P2',
            message: 'img 标签缺少 alt 属性',
            suggestion: '为图片添加 alt 属性，装饰性图片使用 alt=""',
          });
        }
      }
    }

    // ── 3. Form.Item with label but no htmlFor ──
    if (tagName === 'Form.Item' || tagName === 'FormItem') {
      const hasLabel = this.hasAttr(attrs, 'label');
      const hasHtmlFor = this.hasAttr(attrs, 'htmlFor');
      const hasAriaLabelledBy = this.hasAttr(attrs, 'aria-labelledby');
      if (hasLabel && !hasHtmlFor && !hasAriaLabelledBy) {
        const { line, column } = this.getLineColumn(node);
        const key = `form-no-htmlfor-${line}-${column}`;
        if (!this.reported.has(key)) {
          this.reported.add(key);
          this.reportIssue({
            file: this.filePath, line, column,
            type: 'missing-a11y', severity: 'P2',
            message: 'Form.Item 有 label 但缺少 htmlFor 属性',
            suggestion: '添加 htmlFor 属性关联 Input 的 id，或使用 aria-labelledby',
          });
        }
      }
    }

    // ── 4. Input without any accessibility hint ──
    if (tagName === 'Input' || tagName === 'input' || tagName.endsWith('.Input')) {
      const hasAria = this.hasAttr(attrs, 'aria-label');
      const hasId = this.hasAttr(attrs, 'id');
      const hasPlaceholder = this.hasAttr(attrs, 'placeholder');
      const hasName = this.hasAttr(attrs, 'name');
      if (!hasAria && !hasId && !hasPlaceholder && !hasName) {
        const { line, column } = this.getLineColumn(node);
        const key = `input-no-a11y-${line}-${column}`;
        if (!this.reported.has(key)) {
          this.reported.add(key);
          this.reportIssue({
            file: this.filePath, line, column,
            type: 'missing-a11y', severity: 'P2',
            message: 'Input 组件缺少 aria-label、id、name 和 placeholder',
            suggestion: '至少提供 aria-label 或 placeholder 之一，帮助屏幕阅读器识别',
          });
        }
      }
    }

    // ── 5. Low contrast color values ──
    for (const attr of attrs) {
      if (ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer)) {
        const attrName = attr.name.getText(this.sourceFile);
        const val = attr.initializer.text.toLowerCase();
        if (
          (attrName === 'color' || attrName === 'bgColor' || attrName === 'backgroundColor') &&
          LOW_CONTRAST_HEX.has(val)
        ) {
          const { line, column } = this.getLineColumn(node);
          const key = `low-contrast-${line}-${column}-${attrName}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.reportIssue({
              file: this.filePath, line, column,
              type: 'missing-a11y', severity: 'P2',
              message: `颜色 ${attr.initializer.text} 对比度可能不足（WCAG AA 要求 ≥4.5:1）`,
              suggestion: '确保文本与背景的颜色对比度符合 WCAG AA 标准',
            });
          }
        }
      }
    }
  }

  analyze(): InteractionIssue[] {
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }
}
