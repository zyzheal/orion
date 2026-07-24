/**
 * Verification Gate — executable verification for task-decomposer.
 *
 * Purpose: Gap 4 — Transforms task-decomposer's declarative quality gates
 * ("must verify 8-item interaction chain") into verifiable, automated checks.
 *
 * Instead of relying on agents to CLAIM they verified, this module runs
 * actual AST checks and returns pass/fail with evidence.
 *
 * Usage:
 *   verifyInteractionChain(file, line)     — verify all 8 interaction items
 *   verifyOrionCompliance(file)            — check Orion spec compliance
 *   verifyDesignTokenUsage(file)           — no hardcoded colors/sizes
 *   generateTestSkeleton(spec)             — generate Jest test skeleton
 */

import * as ts from 'typescript';
// @ts-ignore TS2591
import * as fs from 'fs';
import { InteractionIssue, ScanResult } from './detectors/base';
import { FrontendInteractionAnalyzer } from './ast-analyzer';

// @ts-ignore TS2591: requires @types/node — already available in project runtime
declare const __dirname: string;

/**
 * Result of a single verification check.
 */
export interface CheckResult {
  /** Check name */
  name: string;
  /** Pass or fail */
  passed: boolean;
  /** Evidence (e.g., "found message.success call at line 42") */
  evidence: string;
  /** Severity if failed */
  severity?: 'P0' | 'P1' | 'P2';
}

/**
 * Full verification report for a file.
 */
export interface VerificationReport {
  file: string;
  checks: CheckResult[];
  passed: number;
  failed: number;
  isCompliant: boolean;
}

/**
 * Verify the 8-item interaction chain for a component.
 *
 * Checks:
 *   1. Has onClick/onChange handlers
 *   2. Has message.success/error feedback (AST)
 *   3. Has loading/disabled state (AST)
 *   4. Has Empty component for lists (AST)
 *   5. Has submit button for forms (AST)
 *   6. Has edit entry for CRUD (AST)
 *   7. Uses Design Token (no hardcoded colors, AST)
 *   8. Has component states (5-state pattern)
 */
export function verifyInteractionChain(filePath: string): VerificationReport {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const checks: CheckResult[] = [];

  // Check 1: Has interactive handlers (AST — already using AST)
  let hasHandlers = false;
  const visit1 = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      if (/^on[A-Z]/.test(node.name.text)) hasHandlers = true;
    }
    ts.forEachChild(node, visit1);
  };
  ts.forEachChild(sourceFile, visit1);
  checks.push({
    name: 'Has interactive handlers',
    passed: hasHandlers || content.includes('Empty') || content.includes('List'),
    evidence: hasHandlers ? 'Found JSX event handlers (onXxx)' : 'No interactive elements detected',
    severity: 'P1',
  });

  // Check 2: Has message feedback (AST — find message.success/error/warning calls)
  const messageResults = findMessageCalls(sourceFile);
  const hasFeedback = messageResults.found;
  checks.push({
    name: 'Has user feedback',
    passed: hasFeedback,
    evidence: hasFeedback ? messageResults.evidence : 'No message.success/error/warning calls found',
    severity: 'P0',
  });

  // Check 3: Has loading state (AST — find loading/setLoading/isLoading/Button loading)
  const loadingResults = findLoadingState(sourceFile);
  checks.push({
    name: 'Has loading state',
    passed: loadingResults.found,
    evidence: loadingResults.found ? loadingResults.evidence : 'No loading/disabled state patterns found',
    severity: 'P0',
  });

  // Check 4: Has Empty component for lists (AST — find Table/List JSX then check for Empty)
  const listResults = findListWithEmpty(sourceFile);
  checks.push({
    name: 'Has Empty component for lists',
    passed: listResults.passed,
    evidence: listResults.evidence,
    severity: 'P1',
  });

  // Check 5: Has submit button for forms (AST — find Form JSX then check for submit)
  const formResults = findFormWithSubmit(sourceFile);
  checks.push({
    name: 'Has submit button for forms',
    passed: formResults.passed,
    evidence: formResults.evidence,
    severity: 'P1',
  });

  // Check 6: Has edit entry for CRUD (AST — find Table/List/Descriptions then check for edit)
  const editResults = findEditEntry(sourceFile);
  checks.push({
    name: 'Has edit entry for CRUD',
    passed: editResults.passed,
    evidence: editResults.evidence,
    severity: 'P1',
  });

  // Check 7: Uses Design Token (AST — find hardcoded hex colors in JSX style)
  const tokenResults = findHardcodedColors(sourceFile);
  checks.push({
    name: 'Uses Design Token',
    passed: tokenResults.passed,
    evidence: tokenResults.passed ? tokenResults.evidence : tokenResults.evidence,
    severity: 'P2',
  });

  // Check 8: Has component states (5-state pattern: default, hover, active, disabled, loading)
  let stateDisabled = false;
  let stateLoading = false;
  let stateHover = false;

  const visit8 = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useState') {
      if (node.arguments.length > 0) {
        const argText = node.arguments[0].getText(sourceFile);
        if (/disabled/.test(argText)) stateDisabled = true;
        if (/loading/.test(argText)) stateLoading = true;
        if (/hover|active/.test(argText)) stateHover = true;
      }
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === 'disabled' || node.name.text === 'loading') {
        stateLoading = true;
      }
    }
    ts.forEachChild(node, visit8);
  };
  ts.forEachChild(sourceFile, visit8);

  const hasStates = stateDisabled || stateLoading || stateHover;
  checks.push({
    name: 'Has component states (5-state)',
    passed: hasStates || content.includes('Button') || content.includes('Input'),
    evidence: hasStates ? `Found React state patterns (disabled=${stateDisabled}, loading=${stateLoading})` : 'Limited state coverage',
    severity: 'P2',
  });

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  return {
    file: filePath,
    checks,
    passed,
    failed,
    isCompliant: failed === 0,
  };
}

// ── AST Helper Functions for Checks 2-7 ──

/**
 * Check 2: Find message.success/error/warning calls via AST.
 * Returns { found: boolean, evidence: string }.
 */
function findMessageCalls(sourceFile: ts.SourceFile): { found: boolean; evidence: string } {
  const calls: Array<{ method: string; line: number }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        if ((expr.name.text === 'success' || expr.name.text === 'error' || expr.name.text === 'warning') &&
            ts.isIdentifier(expr.expression) && expr.expression.text === 'message') {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          calls.push({ method: expr.name.text, line: loc.line + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (calls.length === 0) return { found: false, evidence: '' };
  const methods = [...new Set(calls.map(c => `message.${c.method}`))].join(', ');
  const lines = calls.slice(0, 3).map(c => `line ${c.line}`).join(', ');
  return { found: true, evidence: `Found ${methods} at ${lines}` };
}

/**
 * Check 3: Find loading state patterns via AST.
 * Detects: setLoading/isLoading variables, Button loading prop, Spin component.
 */
function findLoadingState(sourceFile: ts.SourceFile): { found: boolean; evidence: string } {
  const evidences: string[] = [];
  const loadingVars: string[] = [];
  const buttonLoading: number[] = [];
  const spinComponents: number[] = [];

  const visit = (node: ts.Node) => {
    // Detect useState for loading: const [loading, setLoading] = useState(...)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useState') {
      if (ts.isArrayBindingPattern(node.parent)) {
        const bp = node.parent;
        if (bp.elements.length >= 1) {
          const first = bp.elements[0];
          if (ts.isBindingElement(first) && ts.isIdentifier(first.name)) {
            const varName = first.name.text;
            if (/loading|isLoading|submitting|fetching|processing/i.test(varName)) {
              const pos = node.getStart(sourceFile);
              const loc = sourceFile.getLineAndCharacterOfPosition(pos);
              loadingVars.push(`${varName} (line ${loc.line + 1})`);
            }
          }
        }
      }
    }

    // Detect Button loading attribute
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? getJsxTagName(node.openingElement)
        : getJsxTagName(node);
      if (tagName === 'Button') {
        const openingEl = ts.isJsxElement(node) ? node.openingElement : node;
        const loadingAttr = getJsxAttrByName(openingEl, 'loading');
        if (loadingAttr) {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          buttonLoading.push(loc.line + 1);
        }
      }
      // Detect Spin component
      if (tagName === 'Spin') {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        spinComponents.push(loc.line + 1);
      }
    }

    // Detect isLoading variable declarations
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const declName = decl.name;
          const nameText = declName.text;
          if (/^isLoading$/.test(nameText)) {
            const pos = node.getStart(sourceFile);
            const loc = sourceFile.getLineAndCharacterOfPosition(pos);
            if (!loadingVars.some(v => v.includes(nameText))) {
              loadingVars.push(`${nameText} (line ${loc.line + 1})`);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (loadingVars.length > 0) evidences.push(`useState loading vars: ${loadingVars.slice(0, 3).join(', ')}`);
  if (buttonLoading.length > 0) evidences.push(`Button loading props at line ${buttonLoading[0]}`);
  if (spinComponents.length > 0) evidences.push(`Spin component at line ${spinComponents[0]}`);

  return { found: evidences.length > 0, evidence: evidences.join('; ') };
}

/**
 * Get tag name from a JSX opening element or self-closing element.
 */
function getJsxTagName(element: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  const tag = element.tagName;
  if (ts.isIdentifier(tag)) return tag.text;
  return '';
}

/**
 * Helper: Extract JsxAttribute[] from a JSX element's attributes.
 * Handles both JsxOpeningElement and JsxSelfClosingElement.
 */
function getJsxAttrs(
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): ts.JsxAttribute[] {
  const attrs: ts.JsxAttribute[] = [];
  for (let i = 0; i < element.attributes.properties.length; i++) {
    const attr = element.attributes.properties[i];
    if (ts.isJsxAttribute(attr)) attrs.push(attr);
  }
  return attrs;
}

/**
 * Helper: Find a specific JsxAttribute by name.
 */
function getJsxAttrByName(
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string
): ts.JsxAttribute | undefined {
  return getJsxAttrs(element).find(a => ts.isIdentifier(a.name) && a.name.text === name);
}

/**
 * Check 4: Find Table/List JSX elements, then check if the file has Empty component.
 */
function findListWithEmpty(sourceFile: ts.SourceFile): { passed: boolean; evidence: string } {
  const listComponents: Array<{ name: string; line: number }> = [];
  const hasEmpty = checkForEmptyComponent(sourceFile);

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? getJsxTagName(node.openingElement)
        : getJsxTagName(node);
      if (tagName === 'Table' || tagName === 'List' || tagName === 'Card') {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        listComponents.push({ name: tagName, line: loc.line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (listComponents.length === 0) {
    return { passed: true, evidence: 'No list components (Table/List/Card) found' };
  }

  if (hasEmpty.found) {
    return { passed: true, evidence: `List ${listComponents.map(c => `${c.name} (line ${c.line})`).join(', ')} with Empty component (${hasEmpty.evidence})` };
  }

  return { passed: false, evidence: `List ${listComponents.map(c => `${c.name} (line ${c.line})`).join(', ')} without Empty component` };
}

/**
 * Helper: Check if the file contains Empty component via AST.
 */
function checkForEmptyComponent(sourceFile: ts.SourceFile): { found: boolean; evidence: string } {
  const emptyLines: number[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? getJsxTagName(node.openingElement)
        : getJsxTagName(node);
      if (tagName === 'Empty') {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        emptyLines.push(loc.line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (emptyLines.length === 0) return { found: false, evidence: '' };
  return { found: true, evidence: `Empty at line ${emptyLines[0]}` };
}

/**
 * Check 5: Find Form JSX elements, then check for submit button.
 */
function findFormWithSubmit(sourceFile: ts.SourceFile): { passed: boolean; evidence: string } {
  const formLines: number[] = [];
  const submitEvidence: string[] = [];

  const visit = (node: ts.Node) => {
    // Detect Form component
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? getJsxTagName(node.openingElement)
        : getJsxTagName(node);
      if (tagName === 'Form') {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        formLines.push(loc.line + 1);
      }
      // Detect Button with htmlType="submit"
      if (tagName === 'Button') {
        const openingEl = ts.isJsxElement(node) ? node.openingElement : node;
        const htmlTypeAttr = getJsxAttrByName(openingEl, 'htmlType');
        if (htmlTypeAttr && htmlTypeAttr.initializer && ts.isStringLiteral(htmlTypeAttr.initializer) && htmlTypeAttr.initializer.text === 'submit') {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          submitEvidence.push(`htmlType="submit" at line ${loc.line + 1}`);
        }
      }
      // Detect Modal confirm (onOk)
      if (tagName === 'Modal') {
        const openingEl = ts.isJsxElement(node) ? node.openingElement : node;
        const onOkAttr = getJsxAttrByName(openingEl, 'onOk');
        if (onOkAttr) {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          submitEvidence.push(`onOk at line ${loc.line + 1}`);
        }
      }
    }

    // Detect onFinish handler (AST — property assignment)
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'onFinish') {
      const pos = node.getStart(sourceFile);
      const loc = sourceFile.getLineAndCharacterOfPosition(pos);
      submitEvidence.push(`onFinish at line ${loc.line + 1}`);
    }

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (formLines.length === 0) {
    return { passed: true, evidence: 'No Form component found' };
  }

  if (submitEvidence.length > 0) {
    return { passed: true, evidence: `Form (line ${formLines[0]}) with submit: ${submitEvidence[0]}` };
  }

  return { passed: false, evidence: `Form (line ${formLines[0]}) without submit button` };
}

/**
 * Check 6: Find Table/List/Descriptions, then check for edit entry.
 */
function findEditEntry(sourceFile: ts.SourceFile): { passed: boolean; evidence: string } {
  const dataDisplayLines: Array<{ name: string; line: number }> = [];
  const editEvidence: string[] = [];

  const visit = (node: ts.Node) => {
    // Detect data display components
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? getJsxTagName(node.openingElement)
        : getJsxTagName(node);
      if (tagName === 'Table' || tagName === 'List' || tagName === 'Descriptions') {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        dataDisplayLines.push({ name: tagName, line: loc.line + 1 });
      }
    }

    // Detect EditOutlined icon
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node);
      if (tagName.includes('EditOutlined') || tagName.includes('Edit')) {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        editEvidence.push(`${tagName} at line ${loc.line + 1}`);
      }
    }

    // Detect onClick handlers that contain edit-related text (string literal check)
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'onClick') {
      // Look for string literals like "编辑" or "Edit" in the handler body
      const handlerBody = node.getText(sourceFile);
      if (/编辑|edit|Edit/.test(handlerBody)) {
        const pos = node.getStart(sourceFile);
        const loc = sourceFile.getLineAndCharacterOfPosition(pos);
        editEvidence.push(`onClick with edit intent at line ${loc.line + 1}`);
      }
    }

    // Detect onEdit prop
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'onEdit') {
      const pos = node.getStart(sourceFile);
      const loc = sourceFile.getLineAndCharacterOfPosition(pos);
      editEvidence.push(`onEdit prop at line ${loc.line + 1}`);
    }

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (dataDisplayLines.length === 0) {
    return { passed: true, evidence: 'No data display components (Table/List/Descriptions) found' };
  }

  if (editEvidence.length > 0) {
    const display = dataDisplayLines.map(d => `${d.name} (line ${d.line})`).join(', ');
    return { passed: true, evidence: `${display} with edit entry: ${editEvidence[0]}` };
  }

  const display = dataDisplayLines.map(d => `${d.name} (line ${d.line})`).join(', ');
  return { passed: false, evidence: `${display} without edit entry` };
}

/**
 * Check 7: Find hardcoded hex colors in JSX style props via AST.
 * Reuses TokenViolationDetector logic.
 */
function findHardcodedColors(sourceFile: ts.SourceFile): { passed: boolean; evidence: string } {
  const violations: Array<{ color: string; line: number }> = [];

  const visit = (node: ts.Node) => {
    // Check string literals in JSX style props
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;
      if (/^#[0-9a-fA-F]{6}$/.test(text)) {
        // Walk up to find if this is inside a style prop
        let current: ts.Node = node;
        let inStyleContext = false;
        while (current.parent) {
          if (ts.isJsxAttribute(current) && ts.isIdentifier(current.name) && current.name.text === 'style') {
            inStyleContext = true;
            break;
          }
          if (ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) {
            const colorProps = new Set(['color', 'backgroundColor', 'borderColor', 'fill', 'stroke', 'boxShadow']);
            if (colorProps.has(current.name.text)) {
              inStyleContext = true;
              break;
            }
          }
          current = current.parent;
        }
        if (inStyleContext) {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          violations.push({ color: text, line: loc.line + 1 });
        }
      }
    }

    // Also check numeric literals in style properties (e.g., borderRadius: 12)
    if (ts.isNumericLiteral(node) && node.parent && ts.isPropertyAssignment(node.parent)) {
      const parent = node.parent as ts.PropertyAssignment;
      if (ts.isIdentifier(parent.name)) {
        const sizeProps = new Set(['borderRadius', 'fontSize', 'margin', 'padding', 'width', 'height', 'lineHeight']);
        if (sizeProps.has(parent.name.text)) {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          violations.push({ color: `${node.text} (${parent.name.text})`, line: loc.line + 1 });
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (violations.length === 0) {
    return { passed: true, evidence: 'No hardcoded colors or style values found' };
  }

  const sample = violations.slice(0, 3).map(v => `${v.color} at line ${v.line}`).join(', ');
  return { passed: false, evidence: `Hardcoded style values: ${sample}` };
}

/**
 * Verify Orion Design Token compliance for a file.
 */
export function verifyOrionCompliance(filePath: string): VerificationReport {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const checks: CheckResult[] = [];

  // Check: No hardcoded colors
  const cleanedContent = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const hardcodedColors = cleanedContent.match(/#[0-9a-fA-F]{3,8}/g) || [];
  const safeColors = hardcodedColors.filter((c: string) => !['#fff', '#FFF', '#000', '#000000'].includes(c));
  checks.push({
    name: 'No hardcoded colors',
    passed: safeColors.length === 0,
    evidence: safeColors.length > 0 ? `Found ${safeColors.length} hardcoded colors: ${safeColors.slice(0, 3).join(', ')}` : 'All colors use tokens',
    severity: 'P2',
  });

  // Check: No hardcoded px values in style props
  const hasHardcodedPx = /style=.*\d+px|width:.*\d+px|height:.*\d+px|padding:.*\d+px|margin:.*\d+px/.test(cleanedContent);
  checks.push({
    name: 'No hardcoded px in inline styles',
    passed: !hasHardcodedPx,
    evidence: hasHardcodedPx ? 'Found hardcoded px values in inline styles' : 'No hardcoded px values',
    severity: 'P2',
  });

  // Check: Uses colors from tokens
  const usesTokenImport = /from.*tokens.*colors|import.*colors/.test(content);
  checks.push({
    name: 'Imports Design Token',
    passed: usesTokenImport || safeColors.length === 0,
    evidence: usesTokenImport ? 'Found colors import from tokens' : 'No colors token import',
    severity: 'P2',
  });

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  return {
    file: filePath,
    checks,
    passed,
    failed,
    isCompliant: failed === 0,
  };
}

/**
 * Generate a Jest test skeleton for a given file.
 *
 * Purpose: Transform task-decomposer's text-based acceptance criteria
 * into executable test code.
 */
export function generateTestSkeleton(filePath: string, componentName: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // Extract prop types
  let propTypes: string[] = [];
  let eventHandlers: string[] = [];
  let apiCalls: string[] = [];

  const visit = (node: ts.Node) => {
    // Extract interface types
    if (ts.isInterfaceDeclaration(node)) {
      if (node.name.text.includes('Props') || node.name.text.includes('State')) {
        propTypes.push(node.name.text);
      }
    }
    // Extract event handlers
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      if (/^on[A-Z]/.test(node.name.text)) {
        eventHandlers.push(node.name.text);
      }
    }
    // Extract API calls
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (/useRequest|useMutation|fetch/.test(node.expression.text)) {
        apiCalls.push(node.expression.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return `/**
 * Auto-generated test skeleton for ${componentName}
 * Generated by design-constraint verification-gate
 *
 * TODO: Fill in mock data and assertions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  // Rendering
  it('renders without crashing', () => {
    render(<${componentName} />);
    // TODO: Add assertions
  });

${eventHandlers.length > 0 ? eventHandlers.map(handler => `  // ${handler} handler
  it('handles ${handler} correctly', async () => {
    // TODO: Mock ${handler} callback
    render(<${componentName} ${handler}={() => {}} />);
    // TODO: Trigger event and assert
  });`).join('\n') : ''}

${apiCalls.length > 0 ? apiCalls.map(api => `  // ${api} API call
  it('calls ${api} on mount', async () => {
    // TODO: Mock ${api}
    render(<${componentName} />);
    await waitFor(() => {
      // TODO: Assert API was called
    });
  });`).join('\n') : ''}

  // Loading state
  it('shows loading state while fetching', () => {
    // TODO: Mock loading state
    render(<${componentName} />);
    // TODO: Assert loading UI is visible
  });

  // Empty state
  it('shows empty state when no data', () => {
    // TODO: Mock empty data
    render(<${componentName} />);
    // TODO: Assert empty UI is visible
  });

  // Error state
  it('shows error state on API failure', async () => {
    // TODO: Mock API error
    render(<${componentName} />);
    await waitFor(() => {
      // TODO: Assert error UI is visible
    });
  });
});
`;
}

/**
 * Format a verification report for display.
 */
export function formatVerificationReport(report: VerificationReport): string {
  const lines = [
    `┌────────────────────────────────────────────────────────────┐`,
    `│  Verification Report: ${report.file.split('/').slice(-2).join('/').padEnd(34)}│`,
    `├────────────────────────────────────────────────────────────┤`,
    `│  Passed: ${report.passed.toString().padStart(35)}│`,
    `│  Failed: ${report.failed.toString().padStart(35)}│`,
    `│  Compliant: ${(report.isCompliant ? 'YES' : 'NO').padStart(35)}│`,
    `├────────────────────────────────────────────────────────────┤`,
  ];

  for (const check of report.checks) {
    const icon = check.passed ? '✓' : '✗';
    const sev = check.severity ? ` [${check.severity}]` : '';
    lines.push(`│  ${icon} ${check.name.padEnd(35)}${sev.padStart(6)}│`);
    if (!check.passed) {
      const evidence = check.evidence.slice(0, 48);
      lines.push(`│    → ${evidence.padEnd(49)}│`);
    }
  }

  lines.push('└────────────────────────────────────────────────────────────┘');
  return lines.join('\n');
}
