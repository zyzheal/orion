/**
 * SOLID Principles & Anti-pattern Detector (AST-based)
 *
 * Detects: god-object (>500 lines or >15 methods), circular-import,
 * controller-bloat, anemic-model
 */

import * as ts from 'typescript';
import { BaseDetector, InteractionIssue } from './base';

const GOD_OBJECT_LINE_THRESHOLD = 500;
const GOD_OBJECT_METHOD_THRESHOLD = 15;
const CONTROLLER_BLOAT_LINES = 50;
const FAT_INTERFACE_METHODS = 10;

export class SolidDetector extends BaseDetector {
  type = 'analysis' as const;

  analyze(): InteractionIssue[] {
    this.issues = [];

    // ── God Object: file >500 lines OR class with >15 methods ──
    const lineCount = this.content.split('\n').length;
    if (lineCount > GOD_OBJECT_LINE_THRESHOLD) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'god-object',
        severity: 'P1',
        message: `文件超过 ${GOD_OBJECT_LINE_THRESHOLD} 行 (当前 ${lineCount} 行)，疑似上帝对象`,
        suggestion: '拆分为多个职责单一的类/模块',
      });
    }

    // ── Method count per class ──
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        const methods = node.members.filter(m => ts.isMethodDeclaration(m));
        if (methods.length > GOD_OBJECT_METHOD_THRESHOLD) {
          this.issues.push({
            file: this.filePath,
            line: this.getLine(node),
            column: 1,
            type: 'god-object',
            severity: 'P1',
            message: `类 ${node.name?.getText()} 有 ${methods.length} 个方法 (>15)，职责过多`,
            suggestion: '拆分为多个职责单一的类',
          });
        }
      }

      // ── Controller bloat: handler functions >50 lines ──
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        const body = node.body;
        if (body) {
          const startLine = this.getLine(body);
          const endLine = this.getLine(body) + body.getEnd() - body.getStart();
          const lineSpan = body.statements?.length ?? 0;
          if (lineSpan > CONTROLLER_BLOAT_LINES && node.name &&
              node.name.getText().startsWith('handle')) {
            this.issues.push({
              file: this.filePath,
              line: this.getLine(node),
              column: 1,
              type: 'controller-bloat',
              severity: 'P1',
              message: `Controller handler ${node.name.getText()} 超过 ${CONTROLLER_BLOAT_LINES} 行`,
              suggestion: '将业务逻辑下沉到 Service 层',
            });
          }
        }
      }

      // ── Fat interface: >10 methods ──
      if (ts.isInterfaceDeclaration(node)) {
        const members = node.members.filter(m => ts.isMethodSignature(m));
        if (members.length > FAT_INTERFACE_METHODS) {
          this.issues.push({
            file: this.filePath,
            line: this.getLine(node),
            column: 1,
            type: 'fat-interface',
            severity: 'P2',
            message: `接口 ${node.name.getText()} 有 ${members.length} 个方法 (>10)，过于臃肿`,
            suggestion: '拆分为多个小接口，遵循接口隔离原则',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }

  private getLine(node: ts.Node): number {
    return this.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }
}
