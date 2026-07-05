/**
 * Safety Detector — upgraded with AST analysis and precise line numbers.
 *
 * Detects: missing-danger-confirm, missing-permission-error, missing-timeout
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

/**
 * Detects delete/danger operations lacking Popconfirm or Modal.confirm.
 */
export class MissingDangerConfirmDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  private hasDeleteCall = false;
  private hasConfirm = false;
  private deleteLocations: { line: number; column: number; name: string }[] = [];

  visitNode(node: ts.Node): void {
    // Track delete-related function calls
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const callText = node.getText(this.sourceFile);

      // Check for delete function calls
      if (/handleDelete|handleRemove|deleteApi|removeApi/.test(callText)) {
        this.hasDeleteCall = true;
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.deleteLocations.push({
          line: loc.line + 1,
          column: loc.character + 1,
          name: callText.slice(0, 50),
        });
      }

      // Check for confirm dialogs
      if (ts.isPropertyAccessExpression(expr)) {
        if (/Popconfirm|confirm/.test(expr.name.text)) {
          this.hasConfirm = true;
        }
      }
      if (ts.isIdentifier(expr) && expr.text === 'confirm') {
        this.hasConfirm = true;
      }
    }

    // Check for Popconfirm JSX component
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(this.sourceFile);
      if (tagName === 'Popconfirm') {
        this.hasConfirm = true;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    if (this.hasDeleteCall && !this.hasConfirm) {
      for (const loc of this.deleteLocations) {
        this.issues.push({
          file: this.filePath, line: loc.line, column: loc.column,
          type: 'missing-danger-confirm', severity: 'P0',
          message: `删除操作 "${loc.name}" 缺少二次确认`,
          suggestion: '使用 Popconfirm 或 Modal.confirm 进行二次确认',
          confidence: 90, requiresConfirmation: false,
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

/**
 * Detects write API calls lacking 403 permission error handling.
 */
export class MissingPermissionErrorDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  private writeApiCalls: { line: number; column: number; method: string }[] = [];
  private hasPermissionHandling = false;
  private hasPermissionMessage = false;

  visitNode(node: ts.Node): void {
    // Track write API calls
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      const callee = node.expression.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const methodName = callee.name.text;
        if (/post|put|delete|patch|mutate/.test(methodName)) {
          const pos = node.getStart(this.sourceFile);
          const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
          this.writeApiCalls.push({
            line: loc.line + 1,
            column: loc.character + 1,
            method: methodName,
          });
        }
      }
    }

    // Track 403 handling
    if (ts.isBinaryExpression(node)) {
      const text = node.getText(this.sourceFile);
      if (/403/.test(text)) {
        this.hasPermissionHandling = true;
      }
    }

    // Track permission error messages
    if (ts.isCallExpression(node)) {
      const callText = node.getText(this.sourceFile);
      if (/message\.error.*权限|notification\.error.*权限|403/.test(callText)) {
        this.hasPermissionMessage = true;
      }
    }

    // Track catch blocks for 403
    if (ts.isCatchClause(node)) {
      const catchText = node.block.getText(this.sourceFile);
      if (/403|forbidden|permission/i.test(catchText)) {
        this.hasPermissionHandling = true;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    if (this.writeApiCalls.length === 0) return this.issues;

    if (!this.hasPermissionHandling && !this.hasPermissionMessage) {
      this.issues.push({
        file: this.filePath,
        line: this.writeApiCalls[0].line,
        column: this.writeApiCalls[0].column,
        type: 'missing-permission-error', severity: 'P0',
        message: `写操作 API（${this.writeApiCalls.map(c => c.method).join(', ')}）缺少 403 权限错误处理`,
        suggestion: '在 catch 中添加 403 状态码检测，显示"无权限"提示并引导用户',
        confidence: 90, requiresConfirmation: false,
      });
    } else if (this.hasPermissionHandling && !this.hasPermissionMessage) {
      this.issues.push({
        file: this.filePath,
        line: this.writeApiCalls[0].line,
        column: this.writeApiCalls[0].column,
        type: 'missing-permission-error', severity: 'P1',
        message: '权限错误缺少用户提示',
        suggestion: '检测到 403 后使用 message.error 显示明确的权限不足提示',
        confidence: 80, requiresConfirmation: true,
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

/**
 * Detects API clients lacking timeout configuration.
 */
export class MissingTimeoutDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  private apiClientLocations: { line: number; column: number; name: string }[] = [];
  private hasTimeout = false;
  private hasTimeoutError = false;

  visitNode(node: ts.Node): void {
    // Track API client creation
    if (ts.isCallExpression(node)) {
      const callText = node.getText(this.sourceFile);

      if (/createApi|request\s*=|axios\.create/.test(callText)) {
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);

        // Check for timeout config in the same call
        if (!/timeout/.test(callText)) {
          this.apiClientLocations.push({
            line: loc.line + 1,
            column: loc.character + 1,
            name: callText.slice(0, 40),
          });
        } else {
          this.hasTimeout = true;
        }
      }

      // Track AbortController/signal usage
      if (/AbortController|signal|timeout/.test(callText)) {
        this.hasTimeout = true;
      }

      // Track timeout error handling
      if (/ETIMEDOUT|ECONNABORTED|timeout/.test(callText) &&
          /catch|error|Error/.test(callText)) {
        this.hasTimeoutError = true;
      }
    }

    // Track config objects with timeout
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(this.sourceFile);
      if (name === 'timeout') {
        this.hasTimeout = true;
      }
    }
  }

  getIssues(): InteractionIssue[] {
    if (this.apiClientLocations.length === 0) return this.issues;

    for (const loc of this.apiClientLocations) {
      if (!this.hasTimeout) {
        this.issues.push({
          file: this.filePath, line: loc.line, column: loc.column,
          type: 'missing-timeout', severity: 'P1',
          message: `API 客户端 "${loc.name}" 缺少超时配置`,
          suggestion: '添加 timeout 配置或使用 AbortController 处理超时',
          confidence: 85, requiresConfirmation: true,
        });
      }

      if (!this.hasTimeoutError) {
        this.issues.push({
          file: this.filePath, line: loc.line, column: loc.column,
          type: 'missing-timeout', severity: 'P2',
          message: '缺少请求超时错误处理',
          suggestion: '在 catch 中添加超时错误提示，如"请求超时，请重试"',
          confidence: 70, requiresConfirmation: true,
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
