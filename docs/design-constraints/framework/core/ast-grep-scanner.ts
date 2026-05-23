/**
 * AST-Grep Scanner — 后端代码 AST 模式匹配
 *
 * 使用 ast-grep (sg) CLI 工具扫描 Go/Python/TSX 代码，
 * 输出统一 InteractionIssue 格式，与前端 AST 引擎结果聚合。
 *
 * 前置条件: npm install -g @ast-grep/cli
 */

// @ts-ignore TS2591
import * as child_process from 'child_process';
import { InteractionIssue, InteractionIssueType } from './detectors/base';

/**
 * ast-grep 规则定义
 */
export interface AstGrepRule {
  /** 规则名称 */
  name: string;
  /** AST 模式（ast-grep 语法） */
  pattern: string;
  /** 目标语言 */
  language: string;
  /** 输出 issue 类型 */
  issueType: InteractionIssueType;
  /** 严重度 */
  severity: 'P0' | 'P1' | 'P2';
  /** 消息模板 */
  message: string;
  /** 修复建议 */
  suggestion: string;
  /** 过滤条件（排除某些匹配） */
  excludePattern?: string;
}

/** 内置规则集 */
export const BUILTIN_RULES: AstGrepRule[] = [
  // ── Go ──
  {
    name: 'go-http-route',
    pattern: 'router.$METHOD($PATH, $HANDLER)',
    language: 'go',
    issueType: 'missing-auth-guard',
    severity: 'P0',
    message: 'Go HTTP 路由注册',
    suggestion: '检查是否有 auth middleware 包裹',
  },
  {
    name: 'go-sql-format',
    pattern: 'fmt.Sprintf($SQL, $ARGS)',
    language: 'go',
    issueType: 'missing-sql-parameterization',
    severity: 'P0',
    message: 'Go 代码使用 fmt.Sprintf（需手动确认是否用于 SQL）',
    suggestion: 'SQL 查询应使用参数化：db.Query("SELECT ... WHERE id = ?", id)',
  },
  // ── Python ──
  {
    name: 'py-sql-fstring',
    pattern: 'cursor.execute(f$SQL)',
    language: 'python',
    issueType: 'missing-sql-parameterization',
    severity: 'P0',
    message: 'Python f-string 拼接 SQL，存在注入风险',
    suggestion: '使用 cursor.execute("SELECT ... WHERE id = %s", (id,))',
  },
  {
    name: 'py-eval',
    pattern: 'eval($X)',
    language: 'python',
    issueType: 'missing-auth-guard',
    severity: 'P0',
    message: 'Python eval() 执行动态代码',
    suggestion: '使用 ast.literal_eval 替代',
  },
  {
    name: 'py-exec',
    pattern: 'exec($X)',
    language: 'python',
    issueType: 'missing-auth-guard',
    severity: 'P0',
    message: 'Python exec() 执行动态代码',
    suggestion: '避免动态执行用户输入代码',
  },
  // ── TSX ──
  {
    name: 'tsx-await-api',
    pattern: 'await $API.$METHOD($$$ARGS)',
    language: 'tsx',
    issueType: 'missing-feedback',
    severity: 'P1',
    message: 'API 调用（需确认是否有 error handling）',
    suggestion: '确保有 try-catch 和 message.error',
  },
  // ── Java ──
  {
    name: 'java-sql-format',
    pattern: 'String.format($SQL, $ARGS)',
    language: 'java',
    issueType: 'missing-sql-parameterization',
    severity: 'P0',
    message: 'Java SQL 拼接可能导致注入',
    suggestion: '使用 PreparedStatement 或参数化查询',
    confidence: 90,
  },
  {
    name: 'java-no-timeout',
    pattern: 'new OkHttpClient()',
    language: 'java',
    issueType: 'missing-loading',
    severity: 'P1',
    message: 'OkHttpClient 无超时配置',
    suggestion: '配置连接超时和读取超时',
    confidence: 85,
  },
  {
    name: 'java-no-tx',
    pattern: '@Transactional\npublic $TYPE $METHOD()',
    language: 'java',
    issueType: 'missing-auth-guard',
    severity: 'P1',
    message: '事务方法缺少权限校验注解',
    suggestion: '添加 @PreAuthorize 或 @Secured 注解',
    confidence: 60,
  },
  {
    name: 'java-empty-catch',
    pattern: 'catch ($E) { }',
    language: 'java',
    issueType: 'missing-error',
    severity: 'P0',
    message: 'Java 空 catch 块吞掉异常',
    suggestion: '记录日志并重新抛出，或返回错误响应',
    confidence: 95,
  },
];

/**
 * 扫描结果
 */
export interface AstGrepResult {
  rules: AstGrepRule[];
  issues: InteractionIssue[];
  stats: {
    totalMatches: number;
    byLanguage: Record<string, number>;
    bySeverity: Record<'P0' | 'P1' | 'P2', number>;
  };
}

/**
 * 执行 ast-grep 扫描
 */
export function astGrepScan(
  rules: AstGrepRule[],
  rootPath: string,
): AstGrepResult {
  const allIssues: InteractionIssue[] = [];
  const byLanguage: Record<string, number> = {};

  for (const rule of rules) {
    try {
      const output = child_process.execSync(
        `sg -p '${rule.pattern}' -l ${rule.language} ${rootPath} --json 2>/dev/null`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
      );

      const matches: Array<{
        text: string;
        range: { start: { line: number; column: number } };
        file: string;
      }> = JSON.parse(output);

      byLanguage[rule.language] = (byLanguage[rule.language] || 0) + matches.length;

      for (const match of matches) {
        // Apply exclude filter
        if (rule.excludePattern && new RegExp(rule.excludePattern).test(match.text)) {
          continue;
        }

        allIssues.push({
          file: match.file,
          line: match.range.start.line,
          column: match.range.start.column,
          type: rule.issueType,
          severity: rule.severity,
          message: `[ast-grep:${rule.name}] ${rule.message}: ${match.text.slice(0, 100)}`,
          suggestion: rule.suggestion,
          confidence: 85,
          requiresConfirmation: true, // ast-grep 是模式匹配，需人工确认
        });
      }
    } catch {
      // sg not found or no matches
    }
  }

  const p0 = allIssues.filter(i => i.severity === 'P0').length;
  const p1 = allIssues.filter(i => i.severity === 'P1').length;
  const p2 = allIssues.filter(i => i.severity === 'P2').length;

  return {
    rules,
    issues: allIssues,
    stats: {
      totalMatches: allIssues.length,
      byLanguage,
      bySeverity: { P0: p0, P1: p1, P2: p2 },
    },
  };
}

/**
 * 格式化 ast-grep 扫描结果
 */
export function formatAstGrepResult(result: AstGrepResult): string {
  const lines = [
    '┌────────────────────────────────────────────────────────────┐',
    '│  ast-grep 扫描结果                                         │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Total matches:        ${result.stats.totalMatches.toString().padStart(32)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  P0 (Critical):        ${result.stats.bySeverity.P0.toString().padStart(32)}│`,
    `│  P1 (Warning):         ${result.stats.bySeverity.P1.toString().padStart(32)}│`,
    `│  P2 (Info):            ${result.stats.bySeverity.P2.toString().padStart(32)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  By language:                                                │',
  ];

  for (const [lang, count] of Object.entries(result.stats.byLanguage)) {
    lines.push(`│    ${lang.padEnd(32)} ${count.toString().padStart(10)}│`);
  }

  lines.push('└────────────────────────────────────────────────────────────┘');
  return lines.join('\n');
}
