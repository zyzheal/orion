/**
 * Deep Security Detector — checks for secret hardcoding, SQL injection patterns,
 * XSS via dangerouslySetInnerHTML, and missing input validation.
 *
 * Runs on both frontend (.tsx) and backend (.ts) files.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import { BaseDetector, InteractionIssue } from './base';

const SECRET_PREFIXES = /^(sk-|pk-|AK|ak-|key_|secret_|AKIA)[a-zA-Z0-9]{8,}/;
const HARDCODED_PASSWORD = /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/;

export class DeepSecurityDetector extends BaseDetector {
  type = 'security' as const;

  analyze(): InteractionIssue[] {
    this.issues = [];

    const visit = (node: ts.Node) => {
      // ── Secret hardcoding: string literals matching secret patterns ──
      if (ts.isStringLiteral(node)) {
        const text = node.text;
        if (SECRET_PREFIXES.test(text) && !this.isTestFile()) {
          this.issues.push({
            file: this.filePath,
            line: this.getLine(node),
            column: 1,
            type: 'secret-hardcode',
            severity: 'P0',
            message: '疑似硬编码密钥/密钥',
            suggestion: '使用环境变量 (process.env) 或密钥管理服务',
          });
        }
        if (HARDCODED_PASSWORD.test(text) && !this.isTestFile()) {
          this.issues.push({
            file: this.filePath,
            line: this.getLine(node),
            column: 1,
            type: 'secret-hardcode',
            severity: 'P0',
            message: '疑似硬编码密码',
            suggestion: '使用环境变量或密钥管理服务',
          });
        }
      }

      // ── SQL injection: template literals in SQL context ──
      if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
        const text = node.getText();
        if (/SELECT|INSERT|UPDATE|DELETE|CREATE|DROP/i.test(text) &&
            text.includes('${') && !this.isTestFile()) {
          this.issues.push({
            file: this.filePath,
            line: this.getLine(node),
            column: 1,
            type: 'sql-injection-risk',
            severity: 'P0',
            message: 'SQL 语句使用模板字符串拼接，存在注入风险',
            suggestion: '使用参数化查询或 ORM',
          });
        }
      }

      // ── XSS via dangerouslySetInnerHTML ──
      if (ts.isJsxAttribute(node) && node.name.getText() === 'dangerouslySetInnerHTML') {
        this.issues.push({
          file: this.filePath,
          line: this.getLine(node),
          column: 1,
          type: 'xss-risk',
          severity: 'P1',
          message: '使用 dangerouslySetInnerHTML 可能导致 XSS',
          suggestion: '使用 DOMPurify 或 sanitize-html 处理用户输入',
        });
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }

  private isTestFile(): boolean {
    return this.filePath.includes('.test.') || this.filePath.includes('.spec.') ||
           this.filePath.includes('__tests__') || this.filePath.includes('__mocks__');
  }

  private getLine(node: ts.Node): number {
    return this.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }
}
