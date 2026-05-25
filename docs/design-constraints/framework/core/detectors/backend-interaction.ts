/**
 * Backend Interaction Detectors — Go/Python 后端交互检测
 *
 * 将前端交互概念映射到后端等价检测：
 *   missing-feedback  → API 无响应体/状态码
 *   missing-loading   → HTTP 客户端无超时
 *   missing-empty     → 查询无空结果处理
 *   missing-pagination→ 列表无分页
 *   missing-error     → 错误被吞/无返回
 *   missing-validate  → 输入无校验
 *
 * 使用 ast-grep 模式匹配。
 */

// @ts-ignore TS2591
import * as child_process from 'child_process';
import { InteractionIssue, InteractionIssueType } from './base';

/**
 * Go 后端交互检测规则
 */
export const GO_INTERACTION_RULES = [
  // missing-feedback: API handler 返回空响应
  {
    name: 'go-empty-response',
    pattern: 'c.JSON($CODE, nil)',
    language: 'go' as const,
    issueType: 'missing-feedback' as InteractionIssueType,
    severity: 'P1' as const,
    message: 'Go API 返回空响应体 (nil)',
    suggestion: '返回明确的响应体，如 c.JSON(200, gin.H{"status": "ok"})',
    confidence: 85,
  },
  // missing-loading: HTTP 客户端无超时
  {
    name: 'go-no-timeout',
    pattern: '&http.Client{}',
    language: 'go' as const,
    issueType: 'missing-loading' as InteractionIssueType,
    severity: 'P1' as const,
    message: 'Go HTTP 客户端无超时配置',
    suggestion: '配置 Timeout: 30 * time.Second',
    confidence: 90,
  },
  // missing-pagination: 数据库查询无 LIMIT
  {
    name: 'go-no-limit',
    pattern: 'db.Find($RESULT)',
    language: 'go' as const,
    issueType: 'missing-pagination' as InteractionIssueType,
    severity: 'P1' as const,
    message: 'Go 数据库查询无 LIMIT 限制',
    suggestion: '使用 db.Limit(100).Find(&results) 或 db.Offset(offset).Limit(limit)',
    confidence: 80,
  },
  // missing-validate: 结构体无校验标签 (仅检测 json tag 但无 validate tag 的字段)
  // 注意: 此规则较宽泛，需人工确认
  // {
  //   name: 'go-no-validate',
  //   pattern: '`json:"$FIELD"`',
  //   language: 'go',
  //   issueType: 'missing-validate',
  //   severity: 'P1',
  //   message: 'Go 结构体字段无 validate 标签',
  //   suggestion: '添加 `validate:"required"` 标签',
  //   confidence: 60,
  //   excludePattern: 'validate:',
  // },
  // missing-empty: 查询结果无空检查
  // (通过检查是否有 len(xxx) == 0 或 len(xxx) > 0 判断)
];

/**
 * Python 后端交互检测规则
 */
export const PYTHON_INTERACTION_RULES = [
  // missing-loading: requests 无 timeout
  {
    name: 'py-no-timeout',
    pattern: 'requests.$METHOD($URL)',
    language: 'python' as const,
    issueType: 'missing-loading' as InteractionIssueType,
    severity: 'P1' as const,
    message: 'Python requests 调用无 timeout 参数',
    suggestion: '添加 timeout=30 参数',
    confidence: 85,
    excludePattern: 'timeout',
  },
  // missing-pagination: 数据库查询无 skip/limit
  {
    name: 'py-no-pagination',
    pattern: 'db.query($MODEL).all()',
    language: 'python' as const,
    issueType: 'missing-pagination' as InteractionIssueType,
    severity: 'P1' as const,
    message: 'Python 数据库查询无分页',
    suggestion: '使用 query.offset(skip).limit(limit).all()',
    confidence: 85,
  },
  // missing-error: 空 except 块
  {
    name: 'py-empty-except',
    pattern: 'except $E:\n    pass',
    language: 'python' as const,
    issueType: 'missing-error' as InteractionIssueType,
    severity: 'P0' as const,
    message: 'Python except 块吞掉异常 (pass)',
    suggestion: '记录日志并 raise，或返回错误响应',
    confidence: 95,
  },
  // missing-feedback: 路由无 response_model
  {
    name: 'py-no-response-model',
    pattern: '@$DECORATOR($PATH)',
    language: 'python' as const,
    issueType: 'missing-feedback' as InteractionIssueType,
    severity: 'P2' as const,
    message: 'Python 路由无 response_model 定义',
    suggestion: '添加 response_model=XXXResponse 明确响应结构',
    confidence: 50,
  },
];

/**
 * 扫描后端交互问题
 */
export function scanBackendInteraction(
  rootPaths: { go?: string; python?: string },
): InteractionIssue[] {
  const allIssues: InteractionIssue[] = [];

  // Go scan
  if (rootPaths.go) {
    for (const rule of GO_INTERACTION_RULES) {
      try {
        const output = child_process.execSync(
          `sg -p '${rule.pattern}' -l ${rule.language} ${rootPaths.go} --json 2>/dev/null`,
          { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
        );

        const matches = JSON.parse(output);
        for (const match of matches) {
          if ('excludePattern' in rule && rule.excludePattern && new RegExp(rule.excludePattern).test(match.text)) continue;

          allIssues.push({
            file: match.file,
            line: match.range.start.line,
            column: match.range.start.column,
            type: rule.issueType,
            severity: rule.severity,
            message: `[交互检测] ${rule.message}: ${match.text.slice(0, 80)}`,
            suggestion: rule.suggestion,
            confidence: rule.confidence,
            requiresConfirmation: true,
          });
        }
      } catch { /* no matches */ }
    }
  }

  // Python scan
  if (rootPaths.python) {
    for (const rule of PYTHON_INTERACTION_RULES) {
      try {
        const output = child_process.execSync(
          `sg -p '${rule.pattern}' -l ${rule.language} ${rootPaths.python} --json 2>/dev/null`,
          { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
        );

        const matches = JSON.parse(output);
        for (const match of matches) {
          if ('excludePattern' in rule && rule.excludePattern && new RegExp(rule.excludePattern).test(match.text)) continue;

          allIssues.push({
            file: match.file,
            line: match.range.start.line,
            column: match.range.start.column,
            type: rule.issueType,
            severity: rule.severity,
            message: `[交互检测] ${rule.message}: ${match.text.slice(0, 80)}`,
            suggestion: rule.suggestion,
            confidence: rule.confidence,
            requiresConfirmation: true,
          });
        }
      } catch { /* no matches */ }
    }
  }

  return allIssues;
}

/**
 * 格式化后端交互检测结果
 */
export function formatBackendInteractionResult(issues: InteractionIssue[]): string {
  const byType: Record<string, number> = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }

  const lines = [
    '┌────────────────────────────────────────────────────────────┐',
    '│  后端交互检测结果                                          │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Total issues:         ${issues.length.toString().padStart(32)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  By type:                                                    │',
  ];

  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    lines.push(`│    ${type.padEnd(32)} ${count.toString().padStart(10)}│`);
  }

  lines.push('└────────────────────────────────────────────────────────────┘');
  return lines.join('\n');
}
