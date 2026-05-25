/**
 * Python Security Detectors — Python 语言安全检测
 *
 * Python 检测通过 AST 模式匹配 + 正则特征识别。
 * 由于无法在 TS 中直接调用 Python ast 模块，使用 Python 语法特征进行检测。
 *
 * 检测项：
 *   - py-sql-injection: SQL 拼接（S1-03）
 *   - py-sensitive-log: 日志记录敏感信息（S2-01）
 *   - py-missing-auth: 路由缺少认证装饰器（S1-01）
 *   - py-hardcoded-secret: 硬编码密钥/密码（S2-02）
 *   - py-eval-injection: eval/exec 使用（S1-04）
 */

import { InteractionIssue, InteractionIssueType } from './base';
// @ts-ignore TS2591
import * as fs from 'fs';

/**
 * Python SQL 注入检测
 *
 * Pattern: cursor.execute(f"SELECT ... {user_input}")
 *          cursor.execute("SELECT ... " + user_input)
 *          cursor.execute("SELECT ... %s" % user_input)
 */
export class PySqlInjectionDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // f-string SQL: cursor.execute(f"SELECT ... {var}")
    if (/cursor\.execute\s*\(\s*f["'].*SELECT.*\{/.test(this.content)) {
      const match = this.content.match(/cursor\.execute\s*\(\s*f["']/);
      if (match) {
        const line = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
        this.issues.push({
          file: this.filePath, line, column: 1,
          type: 'missing-sql-parameterization' as InteractionIssueType,
          severity: 'P0',
          message: 'Python 代码使用 f-string 拼接 SQL，存在注入风险',
          suggestion: '使用 cursor.execute("SELECT ... WHERE id = %s", (id,)) 参数化查询',
          confidence: 90, requiresConfirmation: false,
        });
      }
    }

    // % formatting: cursor.execute("SELECT ... %s" % var)
    if (/cursor\.execute\s*\(\s*["'].*%s.*["']\s*%\s*/.test(this.content)) {
      const match = this.content.match(/cursor\.execute\s*\(\s*["']/);
      if (match) {
        const line = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
        this.issues.push({
          file: this.filePath, line, column: 1,
          type: 'missing-sql-parameterization' as InteractionIssueType,
          severity: 'P0',
          message: 'Python 代码使用 % 格式化拼接 SQL，存在注入风险',
          suggestion: '使用参数化查询：cursor.execute(sql, params)',
          confidence: 90, requiresConfirmation: false,
        });
      }
    }

    // String concatenation: cursor.execute("SELECT ... " + var)
    if (/cursor\.execute\s*\([^)]*["'][^)]*\+/.test(this.content)) {
      const match = this.content.match(/cursor\.execute\s*\(/);
      if (match) {
        const line = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
        this.issues.push({
          file: this.filePath, line, column: 1,
          type: 'missing-sql-parameterization' as InteractionIssueType,
          severity: 'P0',
          message: 'Python 代码字符串拼接 SQL，存在注入风险',
          suggestion: '使用参数化查询',
          confidence: 85, requiresConfirmation: false,
        });
      }
    }

    return this.issues;
  }
}

/**
 * Python 敏感日志检测
 *
 * Pattern: logger.info(f"password={password}")
 */
export class PySensitiveLogDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // logger.* with sensitive keywords
    const pattern = /logger\.(info|debug|warning|error|print)\s*\([^)]*(?:password|passwd|token|secret|api_key|private_key|credential)[^)]*\)/gi;
    const match = this.content.match(pattern);

    if (match) {
      const line = this.content.substring(0, this.content.indexOf(match[0])).split('\n').length;
      this.issues.push({
        file: this.filePath, line, column: 1,
        type: 'missing-sensitive-log-mask' as InteractionIssueType,
        severity: 'P0',
        message: 'Python 日志可能记录敏感信息',
        suggestion: '脱敏后再记录日志',
        confidence: 90, requiresConfirmation: false,
      });
    }

    return this.issues;
  }
}

/**
 * Python 路由缺少认证检测
 *
 * Pattern: @app.route("/api/xxx") 无 @login_required 装饰器
 */
export class PyMissingAuthDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // Check for Flask/FastAPI routes
    const hasRoutes = /@(?:app|router|api)\.route|@router\.(get|post|put|delete)/i.test(this.content);
    if (!hasRoutes) return [];

    const hasAuthDecorator = /@login_required|@auth\.required|@requires\(|Depends\(get_current_user\)/.test(this.content);
    const routeCount = (this.content.match(/@(?:app|router|api)\.route|@router\.(?:get|post|put|delete)/gi) || []).length;

    if (routeCount > 0 && !hasAuthDecorator) {
      const match = this.content.match(/@(?:app|router|api)\.route|@router\.(?:get|post|put|delete)/);
      const line = match ? this.content.substring(0, this.content.indexOf(match[0])).split('\n').length : 1;
      this.issues.push({
        file: this.filePath, line, column: 1,
        type: 'missing-auth-guard' as InteractionIssueType,
        severity: 'P0',
        message: `Python 代码中 ${routeCount} 个路由缺少认证装饰器`,
        suggestion: '添加 @login_required 或 Depends(get_current_user)',
        confidence: 85, requiresConfirmation: true,
      });
    }

    return this.issues;
  }
}

/**
 * Python eval/exec 注入检测
 *
 * Pattern: eval(user_input), exec(code_string)
 */
export class PyEvalInjectionDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    // eval() or exec() with variable (not string literal)
    const pattern = /\b(?:eval|exec)\s*\((?!\s*["'])/;
    if (pattern.test(this.content)) {
      const match = this.content.match(/\b(?:eval|exec)\s*\(/);
      const line = match ? this.content.substring(0, this.content.indexOf(match[0])).split('\n').length : 1;
      this.issues.push({
        file: this.filePath, line, column: 1,
        type: 'missing-input-validation' as InteractionIssueType,
        severity: 'P0',
        message: 'Python 代码使用 eval/exec 执行动态代码，存在注入风险',
        suggestion: '使用 ast.literal_eval 替代 eval，或重构避免动态执行',
        confidence: 90, requiresConfirmation: false,
      });
    }

    return this.issues;
  }
}

/**
 * Python 硬编码密钥检测
 *
 * Pattern: PASSWORD = "xxx", API_KEY = "sk-xxx", SECRET_KEY = "xxx"
 */
export class PyHardcodedSecretDetector {
  private issues: InteractionIssue[] = [];
  private content: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
  }

  analyze(): InteractionIssue[] {
    const pattern = /\b(?:PASSWORD|SECRET|API_KEY|SECRET_KEY|PRIVATE_KEY|TOKEN)\s*=\s*["'][^"']{8,}["']/gi;
    const match = this.content.match(pattern);

    if (match) {
      for (const m of match.slice(0, 3)) {
        const line = this.content.substring(0, this.content.indexOf(m)).split('\n').length;
        const varName = m.split('=')[0].trim();
        this.issues.push({
          file: this.filePath, line, column: 1,
          type: 'missing-secret-management' as InteractionIssueType,
          severity: 'P0',
          message: `Python 硬编码密钥: ${varName}`,
          suggestion: '使用环境变量 os.environ 或密钥管理服务',
          confidence: 95, requiresConfirmation: false,
        });
      }
    }

    return this.issues;
  }
}
