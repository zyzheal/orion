/**
 * State Transition Detector — 检测状态转换完整性
 * Detects: missing-state-transition
 *
 * Checks:
 * - Has loading state but no error state handling
 * - Has success message but no error message in catch
 * - Delete operation without post-delete state update
 * - State variables defined but not used in JSX
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

export class MissingStateTransitionDetector extends BaseDetector {
  private reported = new Set<string>();

  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    // ── 1. Loading state without error state in same component ──
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isVariableDeclaration(decl) && decl.initializer && ts.isCallExpression(decl.initializer)) {
          const callee = decl.initializer.expression;
          if (ts.isIdentifier(callee) && callee.text === 'useState') {
            const loadingNames: string[] = [];
            if (ts.isArrayBindingPattern(decl.name)) {
              for (const el of decl.name.elements) {
                if (ts.isIdentifier(el) && /loading/i.test(el.text)) {
                  loadingNames.push(el.text);
                }
              }
            }
            if (loadingNames.length > 0) {
              // Check if there's an error state nearby
              const siblingText = node.parent?.getText(this.sourceFile) || '';
              const hasErrorState = /useState\s*\(\s*(false|null)/.test(siblingText) &&
                /error|Error/.test(siblingText);

              if (!hasErrorState) {
                // Wider search: check the enclosing function
                let funcNode: ts.Node | undefined = node.parent;
                while (funcNode && !ts.isFunctionDeclaration(funcNode) &&
                  !ts.isArrowFunction(funcNode) &&
                  !ts.isFunctionExpression(funcNode)) {
                  funcNode = funcNode.parent;
                }
                if (funcNode) {
                  const funcText = funcNode.getText(this.sourceFile);
                  const hasErrorInFunc = /setError|error.*useState/i.test(funcText);
                  if (!hasErrorInFunc) {
                    const { line, column } = this.getLineColumn(node);
                    const key = `loading-no-error-${line}`;
                    if (!this.reported.has(key)) {
                      this.reported.add(key);
                      this.reportIssue({
                        file: this.filePath, line, column,
                        type: 'missing-state-transition', severity: 'P1',
                        message: '定义了 loading 状态但未定义对应的 error 状态',
                        suggestion: '同时定义 error 状态变量，在 catch 块中设置 setError(true)',
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // ── 2. Success message without error message in try-catch ──
    if (ts.isTryStatement(node) && node.catchClause) {
      const tryBody = node.block.getText(this.sourceFile);
      const catchBody = node.catchClause.block.getText(this.sourceFile);

      const hasSuccessInTry = /message\.success|notification\.success/i.test(tryBody);
      const hasErrorInCatch = /message\.error|notification\.error/i.test(catchBody);

      if (hasSuccessInTry && !hasErrorInCatch) {
        const { line, column } = this.getLineColumn(node);
        const key = `success-no-error-${line}`;
        if (!this.reported.has(key)) {
          this.reported.add(key);
          this.reportIssue({
            file: this.filePath, line, column,
            type: 'missing-state-transition', severity: 'P1',
            message: 'try 块有成功提示但 catch 块缺少错误提示',
            suggestion: '在 catch 块中添加 message.error 告知用户操作失败原因',
          });
        }
      }
    }

    // ── 3. Delete call without subsequent refresh ──
    if (ts.isExpressionStatement(node)) {
      const expr = node.expression;
      if (ts.isAwaitExpression(expr) && ts.isCallExpression(expr.expression)) {
        const callee = expr.expression.expression;
        if (ts.isPropertyAccessExpression(callee)) {
          const methodName = callee.name.text;
          if (/delete|remove/i.test(methodName)) {
            // Check if the surrounding code has a refresh call
            const parentBlock = node.parent;
            if (parentBlock) {
              const blockText = parentBlock.getText(this.sourceFile);
              const hasRefresh = /fetchList|loadList|refresh|reload|setList|getList/i.test(blockText);
              if (!hasRefresh) {
                const { line, column } = this.getLineColumn(node);
                const key = `delete-no-refresh-${line}`;
                if (!this.reported.has(key)) {
                  this.reported.add(key);
                  this.reportIssue({
                    file: this.filePath, line, column,
                    type: 'missing-state-transition', severity: 'P1',
                    message: '删除操作后缺少列表刷新或状态更新',
                    suggestion: '删除成功后调用 fetchList() 或更新本地状态以保持 UI 同步',
                  });
                }
              }
            }
          }
        }
      }
    }

    // ── 4. Unused state variables ──
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)) {
      const init = node.initializer;
      if (init && ts.isCallExpression(init)) {
        const callee = init.expression;
        if (ts.isIdentifier(callee) && callee.text === 'useState') {
          const elements = node.name.elements;
          if (elements.length >= 2 && ts.isIdentifier(elements[0])) {
            const stateName = elements[0].text;
            // Check if the state variable is used anywhere besides declaration
            const pattern = new RegExp(`\\b${stateName}\\b`);
            const matches = this.content.match(pattern);
            const count = matches ? matches.length : 0;
            if (count <= 2) { // Declaration + maybe setter = 2
              const { line, column } = this.getLineColumn(node);
              const key = `unused-state-${stateName}-${line}`;
              if (!this.reported.has(key)) {
                this.reported.add(key);
                this.reportIssue({
                  file: this.filePath, line, column,
                  type: 'missing-state-transition', severity: 'P2',
                  message: `状态变量 ${stateName} 声明后未在 JSX 或逻辑中使用`,
                  suggestion: '移除未使用的状态变量，或在渲染中添加对应的状态展示',
                });
              }
            }
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
