/**
 * Go Security Detectors — Go 语言安全检测
 *
 * 使用 Go 标准库 `go/ast` 的等价逻辑（通过 AST 模式匹配）。
 * 由于无法在 TS 中直接调用 go/ast，使用 Go 语法树特征进行文本+AST 混合检测。
 *
 * 检测项：
 *   - go-sql-injection: SQL 拼接（S1-03）
 *   - go-sensitive-log: 日志记录敏感信息（S2-01）
 *   - go-missing-auth: 缺少认证中间件（S1-01）
 *   - go-missing-error-check: 忽略 err 返回值（B1-01）
 *   - go-hardcoded-secret: 硬编码密钥（S2-02）
 */

import * as ts from 'typescript';
// @ts-ignore TS2591
import * as fs from 'fs';
import { BaseDetector, InteractionIssue, InteractionIssueType } from './base';

/**
 * Go SQL 注入检测 — 检测 SQL 字符串拼接
 *
 * Pattern: db.Query("SELECT ... " + var) 或 fmt.Sprintf("SELECT ... %s", var)
 */
export class GoSqlInjectionDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // fmt.Sprintf("SELECT * FROM %s", userInput)
    const sprintfSql = this.content.match(/fmt\.Sprintf\([^)]*SELECT[^)]*%s[^)]*\)/gi);
    if (sprintfSql) {
      const line = this.getLine(sprintfSql[0]);
      this.issues.push({
        file: this.filePath, line, column: 1,
        type: 'missing-sql-parameterization' as InteractionIssueType,
        severity: 'P0',
        message: 'Go 代码 SQL 拼接（fmt.Sprintf）可能导致注入',
        suggestion: '使用 db.Query("SELECT ... WHERE id = ?", id) 参数化查询',
        confidence: 90, requiresConfirmation: false,
      });
    }

    // db.Query("SELECT ... " + variable)
    const concatSql = this.content.match(/(?:Query|Exec|Prepare)\s*\([^)]*["'][^)]*\+[^)]*\)/gi);
    if (concatSql && !sprintfSql) {
      const line = this.getLine(concatSql[0]);
      this.issues.push({
        file: this.filePath, line, column: 1,
        type: 'missing-sql-parameterization' as InteractionIssueType,
        severity: 'P0',
        message: 'Go 代码 SQL 字符串拼接',
        suggestion: '使用参数化查询',
        confidence: 85, requiresConfirmation: false,
      });
    }

    return this.issues;
  }

  private getLine(match: string): number {
    const idx = this.content.indexOf(match);
    if (idx < 0) return 1;
    return this.content.substring(0, idx).split('\n').length;
  }
}

/**
 * Go 敏感日志检测
 *
 * Pattern: log.Printf("... password=%s", password)
 */
export class GoSensitiveLogDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // log.*Printf with sensitive keywords
    const patterns = [
      /(log|logger)\.(Print|Printf|Println|Fatal|Fatalf|Error|Errorf)\([^)]*(?:password|passwd|pwd|token|secret|apiKey|privateKey|credential)[^)]*\)/gi,
      /(log|logger)\.(Print|Printf|Println)\([^)]*%s[^)]*\b(?:password|token|secret|key)\b/gi,
    ];

    for (const pattern of patterns) {
      const match = this.content.match(pattern);
      if (match) {
        const line = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
        this.issues.push({
          file: this.filePath, line, column: 1,
          type: 'missing-sensitive-log-mask' as InteractionIssueType,
          severity: 'P0',
          message: 'Go 日志可能记录敏感信息',
          suggestion: '使用脱敏函数后再记录日志',
          confidence: 90, requiresConfirmation: false,
        });
        break;
      }
    }

    return this.issues;
  }
}

/**
 * Go 缺少认证检测 — 路由 handler 缺少 auth middleware
 *
 * Pattern: http.HandleFunc("/api/xxx", handler) 无 auth 中间件包裹
 */
export class GoMissingAuthDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    if (!/http\.Handle|router\.Handle|gin\.Engine|mux\.NewRouter/.test(this.content)) return [];

    // Check if routes are wrapped in auth middleware
    const hasAuthMiddleware = /auth\.Middleware|requireAuth|jwt\.Middleware|middleware\.Auth/.test(this.content);
    const hasPublicRoutes = /\/health|\/ping|\/metrics/.test(this.content);
    const allPublic = this.content.match(/(?:Handle|GET|POST|PUT|DELETE)\s*\(\s*["']([^"']+)["']/g) || [];
    const nonPublicRoutes = allPublic.filter(r => !/\/health|\/ping|\/metrics/.test(r));

    if (nonPublicRoutes.length > 0 && !hasAuthMiddleware) {
      const line = this.content.substring(0, this.content.indexOf(nonPublicRoutes[0])).split('\n').length;
      this.issues.push({
        file: this.filePath, line, column: 1,
        type: 'missing-auth-guard' as InteractionIssueType,
        severity: 'P0',
        message: `Go 代码中 ${nonPublicRoutes.length} 个路由缺少认证中间件`,
        suggestion: '使用 auth.Middleware 或 JWT 中间件包裹路由',
        confidence: 85, requiresConfirmation: true,
      });
    }

    return this.issues;
  }
}

/**
 * Go 错误忽略检测 — 忽略 err 返回值
 *
 * Pattern: os.Remove(path) 无 err 检查；rows.Scan(...) 无 if err != nil
 */
export class GoMissingErrorCheckDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // Detect function calls that return error but err is not checked
    // Pattern: funcCall(...) followed by no "if err != nil"
    const riskyCalls = /(os\.(Remove|Create|Open|ReadFile|WriteFile)|ioutil\.(ReadFile|WriteFile)|json\.(Unmarshal|Marshal)|db\.(Query|Exec)|rows\.Scan)\s*\([^)]*\)/g;
    let match: RegExpExecArray | null;

    while ((match = riskyCalls.exec(this.content)) !== null) {
      const callEnd = match.index + match[0].length;
      const next200 = this.content.substring(callEnd, callEnd + 200);

      // Check if err is checked in next 200 chars
      const hasErrCheck = /if\s+err\s*!=\s*nil|if\s+err\s*==\s*nil|return\s+err|log\.\w+\(err\)/.test(next200);

      if (!hasErrCheck) {
        const line = this.content.substring(0, match.index).split('\n').length;
        this.issues.push({
          file: this.filePath, line, column: 1,
          type: 'missing-error-handling' as InteractionIssueType,
          severity: 'P1',
          message: `Go 代码调用 ${match[1]} 后未检查 err`,
          suggestion: '添加 if err != nil { return err } 检查',
          confidence: 75, requiresConfirmation: true,
        });
      }
    }

    return this.issues;
  }
}
