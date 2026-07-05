/**
 * Form Interaction Detector — Single-pass AST analysis
 * Detects: missing-submit, missing-edit, missing-empty, missing-truncate
 */

import * as ts from 'typescript';
// @ts-ignore TS2591
import * as path from 'path';
import { BaseDetector, InteractionIssue, SUBMIT_HANDLER_PATTERNS } from './base';

interface FormPassState {
  hasForm: boolean;
  hasSubmit: boolean;
  hasEditButton: boolean;
  hasEditableFields: boolean;
  hasEmptyComponent: boolean;
  hasLocaleEmpty: boolean;
  hasDataProp: boolean;
  hasTableOrList: boolean;
  hasEllipsis: boolean;
  hasTextContent: boolean;
  firstTableLine: number;
}

export class MissingSubmitDetector extends BaseDetector {
  private state: FormPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    const s = this.state;
    if (s.hasForm && !s.hasSubmit) {
      return [{
        file: this.filePath, line: s.firstTableLine, column: 1,
        type: 'missing-submit', severity: 'P1',
        message: '表单缺少提交按钮',
        suggestion: '添加 <Button htmlType="submit">提交</Button> 或 Modal onOk 处理',
      }];
    }
    return [];
  }

  analyze(): InteractionIssue[] {
    this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    return this.getIssues();
  }
}

export class MissingEditDetector extends BaseDetector {
  private state: FormPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    const s = this.state;
    const isDetailPage = /\/Detail\//.test(this.filePath) || /Detail\.tsx$/.test(this.filePath) || /-detail\.tsx$/.test(this.filePath);
    const isReadOnlyPage = !s.hasForm && !s.hasEditableFields;
    const isDrawerContent = this.content.includes('<Drawer');

    if (isDetailPage && !s.hasEditButton && s.hasEditableFields && !isReadOnlyPage && !isDrawerContent) {
      return [{
        file: this.filePath, line: s.firstTableLine, column: 1,
        type: 'missing-edit', severity: 'P1',
        message: '详情页缺少编辑入口',
        suggestion: '添加编辑按钮或启用编辑模式切换',
      }];
    }
    return [];
  }

  analyze(): InteractionIssue[] {
    this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    return this.getIssues();
  }
}

export class MissingEmptyDetector extends BaseDetector {
  private state: FormPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    const s = this.state;
    if (s.hasTableOrList && s.hasDataProp && !s.hasEmptyComponent && !s.hasLocaleEmpty) {
      return [{
        file: this.filePath, line: s.firstTableLine, column: 1,
        type: 'missing-empty', severity: 'P1',
        message: '列表数据可能为空但缺少 Empty 组件',
        suggestion: '添加 <Empty description="暂无数据" /> 或使用 locale={{ emptyText: <Empty /> }}',
      }];
    }
    return [];
  }

  analyze(): InteractionIssue[] {
    this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    return this.getIssues();
  }
}

export class MissingTruncateDetector extends BaseDetector {
  private state: FormPassState | null = null;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
  }

  getIssues(): InteractionIssue[] {
    if (!this.state) this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    const s = this.state;
    if ((s.hasTableOrList || s.hasDataProp) && s.hasTextContent && !s.hasEllipsis) {
      return [{
        file: this.filePath, line: s.firstTableLine, column: 1,
        type: 'missing-truncate', severity: 'P1',
        message: '表格/描述列缺少文本截断处理',
        suggestion: '为 columns 添加 ellipsis: true 或使用 <Text ellipsis>',
      }];
    }
    return [];
  }

  analyze(): InteractionIssue[] {
    this.state = gatherFormState(this.sourceFile, this.content, this.filePath);
    return this.getIssues();
  }
}

// ── Shared state gathering ──

function gatherFormState(sourceFile: ts.SourceFile, content: string, filePath: string): FormPassState {
  const state: FormPassState = {
    hasForm: false, hasSubmit: false, hasEditButton: false,
    hasEditableFields: false, hasEmptyComponent: false, hasLocaleEmpty: false,
    hasDataProp: false, hasTableOrList: false, hasEllipsis: false,
    hasTextContent: false, firstTableLine: 1,
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (tagName === 'Form') state.hasForm = true;
      if (tagName === 'Table' || tagName === 'List') {
        state.hasTableOrList = true;
        if (state.firstTableLine === 1) {
          const pos = node.getStart(sourceFile);
          const loc = sourceFile.getLineAndCharacterOfPosition(pos);
          state.firstTableLine = loc.line + 1;
        }
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) &&
              (attr.name.text === 'dataSource' || attr.name.text === 'data')) {
            state.hasDataProp = true;
          }
        }
      }
      if (tagName === 'Empty') state.hasEmptyComponent = true;
      if (tagName === 'Button' || tagName === 'input') {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
            if (attr.name.text === 'htmlType' && ts.isStringLiteral(attr.initializer!)) {
              if (/submit/.test(attr.initializer.text)) state.hasSubmit = true;
            }
            if (attr.name.text === 'onClick') state.hasSubmit = true;
          }
        }
      }
      if (tagName === 'Input' || tagName === 'Select' || tagName === 'TextArea') {
        state.hasEditableFields = true;
      }
    }

    // Check for onOk={ (Modal/Drawer submit)
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'onOk') {
      state.hasSubmit = true;
    }

    // Check for onFinish={
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'onFinish') {
      state.hasSubmit = true;
    }

    // locale={{ emptyText: ... }}
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'locale') {
      if (/emptyText/.test(node.initializer.getText(sourceFile))) state.hasLocaleEmpty = true;
    }

    // Edit button patterns
    if (ts.isIdentifier(node) && node.text === 'EditOutlined') state.hasEditButton = true;
    if (ts.isCallExpression(node)) {
      const text = node.getText(sourceFile);
      if (/setEdit|editing\s*=/.test(text)) state.hasEditButton = true;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  // Fallback regex for patterns hard to detect via AST
  if (!state.hasSubmit) {
    state.hasSubmit = /htmlType\s*=\s*["']submit["']/i.test(content) ||
      /<Button[^>]*onClick=\{[^}]+\}[^>]*>(提交|保存|确定|Submit)<\/Button>/.test(content) ||
      /onOk\s*=\s*\{/.test(content) || /onFinish\s*=\s*\{/.test(content);
  }
  if (!state.hasEditButton) {
    state.hasEditButton = /EditOutlined/.test(content) || /setEdit/.test(content) || /editing\s*=/.test(content);
  }
  if (!state.hasEllipsis) {
    state.hasEllipsis = /ellipsis\s*:?\s*true|ellipsis\s*=|textOverflow\s*:\s*['"]ellipsis/i.test(content);
  }
  if (!state.hasDataProp) {
    state.hasDataProp = /\b(dataSource|data)\b/.test(content);
  }
  if (!state.hasTextContent) {
    state.hasTextContent = /description|remark|comment|content|note|desc/i.test(content);
  }

  return state;
}
