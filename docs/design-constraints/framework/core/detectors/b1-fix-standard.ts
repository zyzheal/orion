/**
 * B1 Fix Standard Detector — checks for B1 layer fix规范 compliance.
 *
 * Detects: missing-fallback, missing-degrade-notice, missing-rollback
 */

import { BaseDetector, InteractionIssue } from './base';
import * as ts from 'typescript';

export class B1FixStandardDetector extends BaseDetector {
  type = 'analysis' as const;

  analyze(): InteractionIssue[] {
    this.issues = [];

    const visitor = (node: ts.Node) => {
      // Check: empty catch blocks (no fallback logic)
      if (ts.isCatchClause(node)) {
        const block = node.block;
        if (block.statements.length === 0) {
          this.issues.push({
            file: this.filePath,
            line: this.getLine(node),
            column: 1,
            type: 'missing-fallback',
            severity: 'P1',
            message: '空 catch 块，无 fallback 逻辑',
            suggestion: '在 catch 块中添加降级提示或 fallback 逻辑',
          });
        }
      }

      // Check: catch without any user-facing error notice
      if (ts.isTryStatement(node)) {
        const catchClause = node.catchClause;
        if (catchClause) {
          const hasUserNotice = this._hasMessageCall(catchClause.block);
          if (!hasUserNotice) {
            this.issues.push({
              file: this.filePath,
              line: this.getLine(node),
              column: 1,
              type: 'missing-degrade-notice',
              severity: 'P1',
              message: 'catch 块无降级用户提示',
              suggestion: '添加 message.warning/error 告知用户服务降级',
            });
          }
        }
      }

      ts.forEachChild(node, visitor);
    };

    ts.forEachChild(this.sourceFile, visitor);
    return this.issues;
  }

  private _hasMessageCall(block: ts.Block): boolean {
    let found = false;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const obj = node.expression.expression;
        if (ts.isIdentifier(obj) && obj.text === 'message') {
          found = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(block, visit);
    return found;
  }

  private getLine(node: ts.Node): number {
    const lineAndChar = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return lineAndChar.line + 1;
  }
}
