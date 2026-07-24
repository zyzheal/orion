/**
 * State Flow Detector — Single-pass AST analysis
 * Detects: missing-state-machine, missing-animation, missing-undo,
 *           missing-optimistic-lock, missing-concurrent-edit
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

export class MissingStateMachineDetector extends BaseDetector {
  private hasStateMachine = false;
  private firstComplexLine = 1;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (this.hasStateMachine) return;
    // Track the first complex page indicator (Form/Modal/Drawer)
    if (this.firstComplexLine === 1 && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (/Form|Modal|Drawer|Step|Workflow|Approval|Pipeline/i.test(tagName)) {
        const { line } = this.getLineColumn(node);
        this.firstComplexLine = line;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    const isComplexPage = /Form|Modal|Drawer|Step|Workflow|Approval|Pipeline/i.test(this.filePath) ||
                          /form.*state|workflow|approval/i.test(this.content);
    if (!isComplexPage) return [];
    const hasStateMachine = /useMachine|from\(['"]xstate['"]\)|createMachine\(|xstate\b/i.test(this.content) ||
                           /const\s+\[state,\s*send\]/i.test(this.content) ||
                           /useReducer\b/.test(this.content);
    if (!hasStateMachine) {
      return [{
        file: this.filePath, line: this.firstComplexLine || 1, column: 1,
        type: 'missing-state-machine', severity: 'P1',
        message: '复杂交互页面缺少状态机定义',
        suggestion: '建议使用 XState 或 useReducer 定义清晰的状态转换逻辑',
      }];
    }
    return [];
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}

export class MissingAnimationDetector extends BaseDetector {
  private firstStateChangeLine = 1;
  private hasStateChange = false;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (this.hasStateChange) return;
    // Detect setVisible/setExpanded/setOpen/setActive/call expressions
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && /^(setVisible|setExpanded|setOpen|setActive|setCurrent)$/i.test(callee.text)) {
        this.hasStateChange = true;
        const { line } = this.getLineColumn(node);
        this.firstStateChangeLine = line;
      }
    }
    // Also detect JSX with visible/expanded/isOpen attributes
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
          if (/^(visible|expanded|isOpen|isActive)$/.test(attr.name.text)) {
            this.hasStateChange = true;
            const { line } = this.getLineColumn(node);
            this.firstStateChangeLine = line;
            break;
          }
        }
      }
    }
  }

  getIssues(): InteractionIssue[] {
    // Fallback to regex if AST didn't find state changes
    if (!this.hasStateChange) {
      this.hasStateChange = /setVisible|setExpanded|setOpen|setActive|setCurrent/i.test(this.content) ||
                           /visible\?|expanded|isOpen|isActive/i.test(this.content);
    }
    if (!this.hasStateChange) return [];
    const hasAnimation = /transition:|animation:|@keyframes|\.ant-.*transition|style=\{\{.*transition/i.test(this.content) ||
                        /animate:|framer-motion|react-spring/i.test(this.content) ||
                        /duration.*\d{3}|ease-/i.test(this.content);
    if (!hasAnimation) {
      return [{
        file: this.filePath, line: this.firstStateChangeLine || 1, column: 1,
        type: 'missing-animation', severity: 'P1',
        message: '状态变化缺少动画过渡效果',
        suggestion: '添加 CSS transition 或使用 Ant Design 自带动画',
      }];
    }
    return [];
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}

export class MissingUndoDetector extends BaseDetector {
  private firstDeleteLine = 1;
  private hasDeletableOperation = false;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (this.hasDeletableOperation) return;
    // Detect handleDelete/handleRemove function declarations
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.name && ts.isIdentifier(node.name)) {
      if (/^(handleDelete|handleRemove|handleCancel)$/i.test(node.name.text)) {
        this.hasDeletableOperation = true;
        const { line } = this.getLineColumn(node);
        this.firstDeleteLine = line;
      }
    }
    // Detect delete API calls
    if (ts.isCallExpression(node)) {
      const text = node.getText(this.sourceFile);
      if (/delete.*api|remove.*api/i.test(text)) {
        this.hasDeletableOperation = true;
        const { line } = this.getLineColumn(node);
        this.firstDeleteLine = line;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    // Fallback to regex
    if (!this.hasDeletableOperation) {
      this.hasDeletableOperation = /handleDelete|handleRemove|handleCancel|delete.*api|remove.*api/i.test(this.content);
    }
    if (!this.hasDeletableOperation) return [];
    const hasUndo = /undo|revert|rollback|撤销/i.test(this.content) ||
                   /setTimeout.*delete|clearTimeout/i.test(this.content);
    const hasConfirm = /confirm\(|Modal\.confirm|popconfirm/i.test(this.content);
    if (this.hasDeletableOperation && !hasUndo && !hasConfirm) {
      return [{
        file: this.filePath, line: this.firstDeleteLine || 1, column: 1,
        type: 'missing-undo', severity: 'P1',
        message: '删除/取消操作缺少确认机制',
        suggestion: '添加确认对话框或撤销功能',
      }];
    }
    return [];
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}

export class MissingOptimisticLockDetector extends BaseDetector {
  private firstUpdateLine = 1;
  private hasUpdateOperation = false;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (this.hasUpdateOperation) return;
    // Detect handleUpdate/handleSave function declarations
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      if (/^(handleUpdate|handleSave)$/i.test(node.name.text)) {
        this.hasUpdateOperation = true;
        const { line } = this.getLineColumn(node);
        this.firstUpdateLine = line;
      }
    }
    // Detect update API calls (but not delete)
    if (ts.isCallExpression(node)) {
      const text = node.getText(this.sourceFile);
      if (/update.*api|save.*api|put.*api|patch.*api/i.test(text)) {
        this.hasUpdateOperation = true;
        const { line } = this.getLineColumn(node);
        this.firstUpdateLine = line;
      }
    }
    // Detect JSX Edit components
    if (!this.hasUpdateOperation && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Edit' || tagName.includes('Edit')) {
        this.hasUpdateOperation = true;
        const { line } = this.getLineColumn(node);
        this.firstUpdateLine = line;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    const isEditPage = /\/Edit\//.test(this.filePath) ||
                      /Edit\.tsx$/.test(this.filePath) ||
                      /-edit\.tsx$/.test(this.filePath);
    // Fallback to regex for update operations
    if (!this.hasUpdateOperation) {
      this.hasUpdateOperation = isEditPage || /handleUpdate|handleSave/i.test(this.content);
    }
    if (!this.hasUpdateOperation) return [];
    const issues: InteractionIssue[] = [];
    const hasVersionField = /version\s*:|etag\s*:|\bversion\b|\betag\b/i.test(this.content);
    const hasConflictHandling = /409|conflict|Conflict/i.test(this.content);
    if (!hasVersionField) {
      issues.push({
        file: this.filePath, line: this.firstUpdateLine || 1, column: 1,
        type: 'missing-optimistic-lock', severity: 'P0',
        message: '更新操作缺少版本控制字段',
        suggestion: '添加 version 或 etag 字段实现乐观锁',
      });
    }
    if (!hasConflictHandling) {
      issues.push({
        file: this.filePath, line: this.firstUpdateLine || 1, column: 1,
        type: 'missing-optimistic-lock', severity: 'P0',
        message: '缺少 409 冲突错误处理',
        suggestion: '添加 409 状态码检测，处理数据并发冲突',
      });
    }
    return issues;
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}

export class MissingConcurrentEditDetector extends BaseDetector {
  private firstEditLine = 1;
  private hasEditPage = false;

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    // Track the first Edit-related component/function definition
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.name && ts.isIdentifier(node.name)) {
      if (/Edit/i.test(node.name.text)) {
        this.hasEditPage = true;
        if (this.firstEditLine === 1) {
          const { line } = this.getLineColumn(node);
          this.firstEditLine = line;
        }
      }
    }
  }

  getIssues(): InteractionIssue[] {
    const isEditPage = /\/Edit\//.test(this.filePath) ||
                      /Edit\.tsx$/.test(this.filePath) ||
                      /-edit\.tsx$/.test(this.filePath);
    if (!isEditPage) return [];
    if (this.firstEditLine === 1) {
      // Fallback: use regex to find first Edit-related line
      const match = this.content.match(/function\s+Edit|const\s+Edit|=>.*Edit/i);
      if (match) {
        const lineNum = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
        this.firstEditLine = lineNum;
      } else {
        this.firstEditLine = 1;
      }
    }
    const issues: InteractionIssue[] = [];
    const hasConcurrentCheck = /lock|unlock|editing|locked|isEditing/i.test(this.content) ||
                               /polling|interval.*check/i.test(this.content);
    const hasConflictMessage = /已被.*编辑|正在被编辑|多人编辑/i.test(this.content);
    if (!hasConcurrentCheck) {
      issues.push({
        file: this.filePath, line: this.firstEditLine,
        type: 'missing-concurrent-edit', severity: 'P0',
        message: '编辑页面缺少并发编辑检测',
        suggestion: '实现编辑锁机制或定时检测文档是否被他人修改',
      });
    }
    if (hasConcurrentCheck && !hasConflictMessage) {
      issues.push({
        file: this.filePath, line: this.firstEditLine,
        type: 'missing-concurrent-edit', severity: 'P0',
        message: '并发编辑缺少用户提示',
        suggestion: '检测到并发编辑时显示明确提示',
      });
    }
    return issues;
  }
  analyze(): InteractionIssue[] { const visit = (n: ts.Node) => { this.visitNode(n); ts.forEachChild(n, visit); }; ts.forEachChild(this.sourceFile, visit); return this.getIssues(); }
}
