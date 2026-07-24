/**
 * Style Improvement Detector — 样式改进建议（非违规检测）
 * Detects: style-improvement
 *
 * Suggests:
 * - Inconsistent margin/padding → use spacing system
 * - Missing card shadows → use shadows.card/shadows.elevated
 * - Inconsistent button styles → use Ant Design type attribute
 * - Mixed font sizes → use Typography system
 * - Missing hover/focus visual feedback → add transitions
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

// Known design token references (acceptable)
const TOKEN_REFS = new Set([
  'spacing', 'radius', 'shadows', 'colors', 'tokens',
  'componentRadius', 'componentSpacing', 'componentSize',
]);

export class StyleImprovementDetector extends BaseDetector {
  private reported = new Set<string>();
  private fontSizeValues: number[] = [];

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    // ── 1. Hardcoded spacing values that should use tokens ──
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const propName = node.name.text;
      const spacingProps = new Set([
        'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
        'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
        'gap', 'rowGap', 'columnGap',
      ]);

      if (spacingProps.has(propName)) {
        const init = node.initializer;
        // Check for string value like '20px' (non-standard spacing)
        if (ts.isStringLiteral(init)) {
          const match = init.text.match(/^(\d+)px$/);
          if (match) {
            const val = parseInt(match[1], 10);
            // Orion uses 4px grid: 4, 8, 12, 16, 24, 32
            const standardSpacing = [4, 8, 12, 16, 20, 24, 32, 40, 48];
            if (!standardSpacing.includes(val)) {
              const { line, column } = this.getLineColumn(node);
              const key = `non-standard-spacing-${line}-${column}`;
              if (!this.reported.has(key)) {
                this.reported.add(key);
                this.reportIssue({
                  file: this.filePath, line, column,
                  type: 'style-improvement', severity: 'P2',
                  message: `非标准间距值 ${init.text}，建议使用 Design Token`,
                  suggestion: `使用 spacing.ts 中的 token（如 spacing.${val <= 8 ? 'sm' : val <= 16 ? 'md' : 'lg'}）`,
                });
              }
            }
          }
        }
        // Check for numeric literal in style object
        if (ts.isNumericLiteral(init)) {
          const { line, column } = this.getLineColumn(node);
          const key = `numeric-spacing-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.reportIssue({
              file: this.filePath, line, column,
              type: 'style-improvement', severity: 'P2',
              message: `间距使用数字 ${init.text} 而非 token 引用`,
              suggestion: '使用 tokens/spacing.ts 中的 token 替代裸数字',
            });
          }
        }
      }

      // ── 2. Hardcoded borderRadius that should use tokens ──
      if (propName === 'borderRadius' || propName.includes('Radius')) {
        const init = node.initializer;
        if (ts.isNumericLiteral(init) || (ts.isStringLiteral(init) && /^\d+px$/.test(init.text))) {
          const { line, column } = this.getLineColumn(node);
          const key = `hardcoded-radius-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.reportIssue({
              file: this.filePath, line, column,
              type: 'style-improvement', severity: 'P2',
              message: '硬编码 borderRadius，建议使用 Design Token',
              suggestion: '使用 tokens/radius.ts 中的 token（如 componentRadius.card）',
            });
          }
        }
      }

      // ── 3. Collect font sizes for consistency check ──
      if (propName === 'fontSize') {
        const init = node.initializer;
        if (ts.isNumericLiteral(init)) {
          this.fontSizeValues.push(parseInt(init.text, 10));
        }
        if (ts.isStringLiteral(init)) {
          const match = init.text.match(/^(\d+)px$/);
          if (match) this.fontSizeValues.push(parseInt(match[1], 10));
        }
      }
    }

    // ── 4. Missing shadow on Card-like elements ──
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Card' || tagName.endsWith('.Card')) {
        const attrs = node.attributes;
        let hasBoxShadow = false;
        if (ts.isArray(attrs)) {
          for (const attr of attrs) {
            if (ts.isJsxAttribute(attr) && attr.name.getText(this.sourceFile) === 'style') {
              // Check if style object contains boxShadow
              if (attr.initializer && /boxShadow/i.test(attr.initializer.getText(this.sourceFile))) {
                hasBoxShadow = true;
              }
            }
          }
        }
        // Don't flag if Card has built-in bordered or hoverable
        if (!hasBoxShadow) {
          const hasBordered = ts.isArray(attrs) && attrs.some(attr =>
            ts.isJsxAttribute(attr) && attr.name.getText(this.sourceFile) === 'bordered'
          );
          if (!hasBordered) {
            const { line, column } = this.getLineColumn(node);
            const key = `card-no-shadow-${line}`;
            if (!this.reported.has(key)) {
              this.reported.add(key);
              this.reportIssue({
                file: this.filePath, line, column,
                type: 'style-improvement', severity: 'P2',
                message: 'Card 组件未使用阴影层次，视觉层级不够清晰',
                suggestion: '添加 bordered={false} 并使用 shadows.card 增加立体感',
              });
            }
          }
        }
      }
    }

    // ── 5. Button without type attribute (defaults to 'default' instead of 'primary') ──
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Button' || tagName.endsWith('.Button')) {
        const attrs = node.attributes;
        let hasType = false;
        let hasDanger = false;
        if (ts.isArray(attrs)) {
          for (const attr of attrs) {
            if (ts.isJsxAttribute(attr)) {
              const name = attr.name.getText(this.sourceFile);
              if (name === 'type') hasType = true;
              if (name === 'danger') hasDanger = true;
            }
          }
        }
        if (!hasType && !hasDanger) {
          const { line, column } = this.getLineColumn(node);
          const key = `btn-no-type-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.reportIssue({
              file: this.filePath, line, column,
              type: 'style-improvement', severity: 'P2',
              message: 'Button 未指定 type 属性，默认样式可能不够醒目',
              suggestion: '主操作按钮使用 type="primary"，危险操作使用 danger 属性',
            });
          }
        }
      }
    }

    // ── 6. Missing transition/hover feedback on interactive elements ──
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      const interactiveTags = ['Button', 'a', 'Link'];
      if (interactiveTags.includes(tagName) || tagName.endsWith('.Button')) {
        const attrs = node.attributes;
        let hasTransition = false;
        if (ts.isArray(attrs)) {
          for (const attr of attrs) {
            if (ts.isJsxAttribute(attr) && attr.name.getText(this.sourceFile) === 'style') {
              if (attr.initializer && /transition/i.test(attr.initializer.getText(this.sourceFile))) {
                hasTransition = true;
              }
            }
          }
        }
        if (!hasTransition) {
          const { line, column } = this.getLineColumn(node);
          const key = `no-transition-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.reportIssue({
              file: this.filePath, line, column,
              type: 'style-improvement', severity: 'P2',
              message: '交互元素缺少 transition 过渡效果',
              suggestion: '添加 transition: all 200ms 使 hover/focus 状态切换更平滑',
            });
          }
        }
      }
    }
  }

  getIssues(): InteractionIssue[] {
    // ── Font size consistency check ──
    if (this.fontSizeValues.length >= 3) {
      const uniqueSizes = [...new Set(this.fontSizeValues)].sort((a, b) => a - b);
      // If more than 4 different font sizes, suggest Typography system
      if (uniqueSizes.length > 4) {
        this.reportIssue({
          file: this.filePath, line: 1, column: 1,
          type: 'style-improvement', severity: 'P2',
          message: `页面使用了 ${uniqueSizes.length} 种不同字号 (${uniqueSizes.join(', ')}px)，字号不够统一`,
          suggestion: '统一使用 Typography 层级（12/14/16/20px），避免自定义字号',
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
