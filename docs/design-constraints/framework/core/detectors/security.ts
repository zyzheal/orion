/**
 * Security Detectors — S1-S5 safety layer AST analysis.
 *
 * Purpose: Gap 6 — Add automated detection for security-layer violations.
 * 5 dimensions, 25 check items total.
 *
 * All detectors support single-pass AST traversal.
 */

import * as ts from 'typescript';
// @ts-ignore TS2591
import * as fs from 'fs';
import { BaseDetector, InteractionIssue, InteractionIssueType } from './base';

/**
 * Check if a file path is a backend-only file that should be scanned
 * for security patterns (SQL, tenant isolation, CORS, etc.).
 *
 * Frontend component files (pages/, components/) or files without
 * backend indicators (api/, services/, middleware/, routes/) are skipped.
 */
function isBackendFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  // Skip frontend-only paths
  if (lower.includes('pages/') || lower.includes('components/')) {
    return false;
  }
  // Only scan files that look like backend code
  const backendIndicators = ['api/', 'services/', 'middleware/', 'routes/'];
  return backendIndicators.some(ind => lower.includes(ind));
}

// ── S1: 身份认证与访问控制 ──

export class MissingAuthGuardDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const body = node.body?.getText(this.sourceFile) || '';
      const isApiHandler = /handler|controller|route|get|post|put|delete|patch/i.test(body) ||
        /req\.(params|query|body|headers)/.test(body) ||
        /res\.send|res\.json|ctx\.body|reply/.test(body);

      if (isApiHandler) {
        const hasAuthGuard = /verifyToken|requireAuth|authenticate|isAuthenticated|useAuth|authMiddleware|jwt/.test(body);
        if (!hasAuthGuard) {
          const pos = node.getStart(this.sourceFile);
          const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
          this.issues.push({
            file: this.filePath, line: loc.line + 1, column: loc.character + 1,
            type: 'missing-auth-guard', severity: 'P0',
            message: 'API 路由缺少认证守卫',
            suggestion: '添加 verifyToken 中间件或 requireAuth 守卫',
            confidence: 85, requiresConfirmation: true,
          });
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

// ── S2: 数据安全 ──

export class MissingSensitiveLogMaskDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isLogCall = ts.isPropertyAccessExpression(callee) &&
        /^log|info|debug|warn|error$/.test(callee.name.text);

      if (isLogCall) {
        const callText = node.getText(this.sourceFile);
        if (/password|passwd|pwd|token|secret|apiKey|api_key|privateKey|private_key|credential|ssn|credit_card/i.test(callText)) {
          const pos = node.getStart(this.sourceFile);
          const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
          this.issues.push({
            file: this.filePath, line: loc.line + 1, column: loc.character + 1,
            type: 'missing-sensitive-log-mask', severity: 'P0',
            message: '日志可能记录敏感信息',
            suggestion: '脱敏后再记录日志，或使用 maskSensitive 工具函数',
            confidence: 90, requiresConfirmation: false,
          });
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

// ── S1: SQL Injection ──

export class MissingSqlParameterizationDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isTemplateLiteral(node)) {
      const text = node.getText(this.sourceFile);
      // Template literal with backticks and ${...} interpolation containing SQL keywords
      if (/`[^`]*\$\{/.test(text) && /SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|DROP|CREATE|ALTER/i.test(text)) {
        const pos = node.getStart(this.sourceFile);
        const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
        this.issues.push({
          file: this.filePath, line: loc.line + 1, column: loc.character + 1,
          type: 'missing-sql-parameterization', severity: 'P0',
          message: 'SQL 拼接可能导致注入攻击',
          suggestion: '使用参数化查询：repository.query("SELECT * FROM users WHERE id = $1", [id])',
          confidence: 95, requiresConfirmation: false,
        });
      }
    }
  }

  analyze(): InteractionIssue[] {
    if (!isBackendFile(this.filePath)) {
      return this.issues;
    }
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }
}

// ── S3: CORS ──

export class MissingCorsConfigDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === 'cors') {
        if (node.arguments.length === 0) {
          const pos = node.getStart(this.sourceFile);
          const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
          this.issues.push({
            file: this.filePath, line: loc.line + 1, column: loc.character + 1,
            type: 'missing-cors-config', severity: 'P1',
            message: 'CORS 配置使用默认值（允许所有来源）',
            suggestion: '配置 cors({ origin: ["https://your-domain.com"] })',
            confidence: 90, requiresConfirmation: false,
          });
        } else if (node.arguments.length === 1) {
          const argText = node.arguments[0].getText(this.sourceFile);
          if (/origin\s*:\s*['"]\*['"]|origin\s*:\s*true/.test(argText)) {
            const pos = node.getStart(this.sourceFile);
            const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
            this.issues.push({
              file: this.filePath, line: loc.line + 1, column: loc.character + 1,
              type: 'missing-cors-config', severity: 'P1',
              message: 'CORS origin 设置为通配符',
              suggestion: '限制 origin 为具体的域名列表',
              confidence: 90, requiresConfirmation: false,
            });
          }
        }
      }
    }
  }

  analyze(): InteractionIssue[] {
    if (!isBackendFile(this.filePath)) {
      return this.issues;
    }
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }
}

// ── S1: Tenant Isolation ──

export class MissingTenantIsolationDetector extends BaseDetector {
  supportsSinglePass(): boolean { return true; }

  visitNode(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const obj = callee.expression.getText(this.sourceFile);
        const method = callee.name.text;

        if (/Repository|repository|Model|model/.test(obj) && /^(find|query|getAll|list|select)/i.test(method)) {
          const argText = node.getText(this.sourceFile);
          if (!/tenant_id|tenantId/.test(argText)) {
            const pos = node.getStart(this.sourceFile);
            const loc = this.sourceFile.getLineAndCharacterOfPosition(pos);
            this.issues.push({
              file: this.filePath, line: loc.line + 1, column: loc.character + 1,
              type: 'missing-tenant-isolation', severity: 'P0',
              message: '数据库查询缺少租户隔离（tenant_id）',
              suggestion: '添加 WHERE tenant_id = ? 过滤条件',
              confidence: 80, requiresConfirmation: true,
            });
          }
        }
      }
    }
  }

  analyze(): InteractionIssue[] {
    if (!isBackendFile(this.filePath)) {
      return this.issues;
    }
    const visit = (node: ts.Node) => { this.visitNode(node); ts.forEachChild(node, visit); };
    ts.forEachChild(this.sourceFile, visit);
    return this.issues;
  }
}
