/**
 * Token Violation Detector (NEW)
 * Detects: token-violation
 *
 * Uses AST to find hardcoded hex colors (#3370E6, #1890ff, etc.) and hardcoded px values
 * (borderRadius: '4px', margin: '15px') that should use Orion Design Tokens.
 *
 * Context-aware: Only reports in JSX style props, CSS-in-JS objects, and style attribute values.
 * Ignores: URLs, IDs, non-style strings, and known token color values.
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

// Orion design token color values that are acceptable inline (already match tokens)
const DESIGN_TOKEN_COLOR_VALUES = new Set([
  '#3370E6', '#2B5DD6', '#1F4BB5', // primary
  '#52c41a', '#389e0d', // success
  '#faad14', // warning
  '#f5222d', '#cf1322', // error
  '#3a98f4', // info
  '#7C5CFC', // purple
  '#8c8c8c', '#bfbfbf', '#595959', // neutral
  '#1f1f1f', '#262626', // text
  '#ffffff', '#fff', // white
  '#F5F5F7', '#EBF0FB', // backgrounds
  '#d9d9d9', // disabled
]);

// Style property names that accept color values
const COLOR_PROPS = new Set([
  'color', 'backgroundColor', 'bgColor', 'borderColor',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'fill', 'stroke', 'outlineColor', 'boxShadow', 'textShadow',
  'caretColor', 'accentColor',
]);

// Style property names that accept numeric/size values
const SIZE_PROPS = new Set([
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'gap', 'rowGap', 'columnGap',
  'fontSize', 'lineHeight', 'letterSpacing', 'wordSpacing',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'top', 'right', 'bottom', 'left',
  'borderWidth', 'borderTopWidth', 'borderRightWidth',
  'borderBottomWidth', 'borderLeftWidth',
  'paddingInline', 'paddingBlock', 'marginInline', 'marginBlock',
]);

/**
 * Check if a string is a valid hex color (not a URL fragment or ID).
 */
function isHexColor(text: string): boolean {
  // Must be exactly 3, 4, 6, or 8 hex digits
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{4}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(text);
}

/**
 * Check if the string literal is inside a JSX style prop or CSS-in-JS object.
 * Returns: 'color' | 'size' | null
 */
function getStyleContext(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): 'color' | 'size' | null {
  // Walk up the AST to find the parent property assignment
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;

    // Case 1: { style: "..." } — style prop value
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      const propName = parent.name.text;
      if (propName === 'style') return null; // The whole style object, need more context
    }

    // Case 2: { color: "#xxx" } or { borderRadius: "4px" } — style object property
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      const propName = parent.name.text;
      if (COLOR_PROPS.has(propName)) return 'color';
      if (SIZE_PROPS.has(propName)) return 'size';
    }

    // Case 3: JSX attribute — check if it's a style-related prop
    if (ts.isJsxAttribute(parent) && ts.isIdentifier(parent.name)) {
      const attrName = parent.name.text;
      // Only check string values in style-related JSX attributes
      if (attrName === 'color' || attrName === 'bgColor' || attrName === 'borderColor') return 'color';
    }

    // Case 4: Template expression in style object: style={{ borderRadius: `${x}px` }}
    if (ts.isTemplateExpression(parent) || ts.isTemplateHead(parent) || ts.isTemplateTail(parent) || ts.isTemplateSpan(parent)) {
      // Look further up for the property context
      current = parent;
      continue;
    }

    // Case 5: Inside an object literal that's assigned to 'style'
    if (ts.isObjectLiteralExpression(parent)) {
      // Check if this object is assigned to a 'style' prop or 'style' key
      const obj = parent;
      for (const prop of obj.properties) {
        if (prop === current) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            const propName = prop.name.text;
            if (COLOR_PROPS.has(propName)) return 'color';
            if (SIZE_PROPS.has(propName)) return 'size';
          }
        }
        // Also check string literal values inside property assignments
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && ts.isStringLiteral(prop.initializer) && prop.initializer === node) {
          const propName = prop.name.text;
          if (COLOR_PROPS.has(propName)) return 'color';
          if (SIZE_PROPS.has(propName)) return 'size';
        }
      }
    }

    current = parent;
  }

  return null;
}

export class TokenViolationDetector extends BaseDetector {
  private reported = new Set<string>();

  /** This detector supports efficient single-pass AST traversal. */
  supportsSinglePass(): boolean {
    return true;
  }

  /** Legacy mode: fallback for backward compatibility. */
  analyze(): InteractionIssue[] {
    this.issues = [];
    this.reported = new Set<string>();
    const visit = (node: ts.Node) => {
      this.visitNode(node);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }

  visitNode(node: ts.Node): void {
    // ── 1. Detect hardcoded hex colors in style context ──
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;

      if (isHexColor(text) && !DESIGN_TOKEN_COLOR_VALUES.has(text.toUpperCase())) {
        const context = getStyleContext(node);
        if (context === 'color') {
          const { line, column } = this.getLineColumn(node);
          const key = `color-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.issues.push({
              file: this.filePath, line, column,
              type: 'token-violation', severity: 'P2',
              message: `硬编码色值 ${text}，应使用 Design Token`,
              suggestion: `使用 colors 对象替代硬编码色值，如 colors.primary[500]`,
            });
          }
        }
      }

      // Detect hardcoded px values in style context
      if (/^\d+px$/.test(text)) {
        const context = getStyleContext(node);
        if (context === 'size') {
          const { line, column } = this.getLineColumn(node);
          const key = `px-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.issues.push({
              file: this.filePath, line, column,
              type: 'token-violation', severity: 'P2',
              message: `硬编码像素值 ${text}，应使用 Design Token`,
              suggestion: `使用 spacing.ts / radius.ts 中的 token 替代硬编码像素值`,
            });
          }
        }
      }
    }

    // ── 2. Detect numeric literals in style object properties ──
    if (ts.isNumericLiteral(node)) {
      const parent = node.parent;
      if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
        const propName = parent.name.text;

        if (SIZE_PROPS.has(propName)) {
          const { line, column } = this.getLineColumn(node);
          const key = `style-${propName}-${line}-${column}`;
          if (!this.reported.has(key)) {
            this.reported.add(key);
            this.issues.push({
              file: this.filePath, line, column,
              type: 'token-violation', severity: 'P2',
              message: `硬编码数值 ${node.text} 用于样式属性 ${propName}，应使用 Design Token`,
              suggestion: `使用 tokens/${SIZE_PROPS.has(propName) && propName.includes('Radius') ? 'radius' : 'spacing'}.ts 中的 token`,
            });
          }
        }
      }
    }
  }
}
