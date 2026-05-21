/**
 * 验证工具
 * 用于验证检测结果的有效性，确保报告准确
 */

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * 代码上下文
 */
export interface CodeContext {
  before: string[];
  current: string;
  after: string[];
  fullContext: string;
}

/**
 * 验证检测结果是否有效
 * @param content - 待验证的代码内容
 * @param line - 行号
 * @param type - 检测类型
 * @returns 验证结果
 */
export function validateDetection(
  content: string,
  line: number,
  type: string
): ValidationResult {
  // 空内容检查
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      reason: '代码内容为空',
      severity: 'error',
    };
  }

  // 行号有效性检查
  if (line <= 0) {
    return {
      valid: false,
      reason: '无效的行号',
      severity: 'error',
    };
  }

  // 检测类型有效性检查
  if (!type || type.trim().length === 0) {
    return {
      valid: false,
      reason: '检测类型不能为空',
      severity: 'error',
    };
  }

  // 仅包含注释的行（可能是误报）
  const trimmedContent = content.trim();
  if (trimmedContent.startsWith('//') || trimmedContent.startsWith('/*') || trimmedContent.startsWith('*')) {
    return {
      valid: false,
      reason: '仅包含注释，可能是误报',
      severity: 'warning',
    };
  }

  // 空字符串检查
  if (trimmedContent === '' || trimmedContent === '""' || trimmedContent === "''") {
    return {
      valid: false,
      reason: '空字符串，没有实际内容',
      severity: 'warning',
    };
  }

  return { valid: true };
}

/**
 * 验证文件路径
 * @param filePath - 文件路径
 * @returns 验证结果
 */
export function validateFilePath(filePath: string): ValidationResult {
  if (!filePath) {
    return {
      valid: false,
      reason: '文件路径为空',
      severity: 'error',
    };
  }

  // 检查路径长度
  if (filePath.length > 500) {
    return {
      valid: false,
      reason: '文件路径过长',
      severity: 'error',
    };
  }

  // 检查无效字符
  const invalidChars = /[<>"|?*\x00-\x1F]/;
  if (invalidChars.test(filePath)) {
    return {
      valid: false,
      reason: '文件路径包含无效字符',
      severity: 'error',
    };
  }

  return { valid: true };
}

/**
 * 验证代码语法（基础检查）
 * @param code - 代码内容
 * @returns 验证结果
 */
export function validateCodeSyntax(code: string): ValidationResult {
  if (!code) {
    return {
      valid: false,
      reason: '代码为空',
      severity: 'error',
    };
  }

  // 括号匹配检查
  const brackets: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
  };

  const stack: string[] = [];
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : '';

    // 跳过转义字符
    if (prevChar === '\\') continue;

    // 字符串处理
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString && char === stringChar) {
      inString = false;
      continue;
    }

    if (inString) continue;

    // 括号处理
    if (brackets[char]) {
      stack.push(brackets[char]);
    } else if (Object.values(brackets).includes(char)) {
      if (stack.length === 0 || stack.pop() !== char) {
        return {
          valid: false,
          reason: `括号不匹配: 期望 '${char}'`,
          severity: 'warning',
        };
      }
    }
  }

  if (stack.length > 0) {
    return {
      valid: false,
      reason: `括号未闭合: 缺少 ${stack.length} 个括号`,
      severity: 'warning',
    };
  }

  return { valid: true };
}

/**
 * 获取代码上下文
 * @param content - 完整文件内容（按行分割）
 * @param line - 目标行号（1-based）
 * @param linesBefore - 目标行前的行数，默认为 2
 * @param linesAfter - 目标行后的行数，默认为 2
 * @returns 代码上下文对象
 */
export function getCodeContext(
  content: string[],
  line: number,
  linesBefore: number = 2,
  linesAfter: number = 2
): CodeContext {
  const totalLines = content.length;
  const targetIndex = line - 1; // 转换为 0-based

  // 计算上下文范围
  const startIndex = Math.max(0, targetIndex - linesBefore);
  const endIndex = Math.min(totalLines - 1, targetIndex + linesAfter);

  // 获取上下文行
  const before: string[] = [];
  for (let i = startIndex; i < targetIndex; i++) {
    before.push(content[i]);
  }

  const current = content[targetIndex] || '';

  const after: string[] = [];
  for (let i = targetIndex + 1; i <= endIndex; i++) {
    after.push(content[i]);
  }

  // 构建完整上下文字符串
  const fullContext = [
    ...before.map((line, idx) => `${startIndex + idx + 1}: ${line}`),
    `> ${line}: ${current}`,
    ...after.map((line, idx) => `${targetIndex + idx + 2}: ${line}`),
  ].join('\n');

  return {
    before,
    current,
    after,
    fullContext,
  };
}

/**
 * 从字符串内容中获取上下文
 * @param content - 完整文件内容（字符串）
 * @param line - 目标行号
 * @param linesBefore - 目标行前的行数
 * @param linesAfter - 目标行后的行数
 * @returns 代码上下文
 */
export function getCodeContextFromString(
  content: string,
  line: number,
  linesBefore: number = 2,
  linesAfter: number = 2
): CodeContext {
  const lines = content.split('\n');
  return getCodeContext(lines, line, linesBefore, linesAfter);
}

/**
 * 检查代码是否有实际意义（不只是空白或注释）
 * @param line - 代码行
 * @returns 是否有效
 */
export function isMeaningfulCode(line: string): boolean {
  const trimmed = line.trim();

  // 空行
  if (!trimmed) return false;

  // 仅注释
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return false;
  }

  // HTML/XML 注释
  if (trimmed.startsWith('<!--') || trimmed.startsWith('-->')) {
    return false;
  }

  return true;
}

/**
 * 验证检测器配置
 * @param config - 检测器配置
 * @returns 验证结果
 */
export function validateDetectorConfig(config: {
  name: string;
  rules?: Array<{ pattern: RegExp; message: string }>;
}): ValidationResult {
  if (!config.name || config.name.trim().length === 0) {
    return {
      valid: false,
      reason: '检测器名称不能为空',
      severity: 'error',
    };
  }

  if (config.rules) {
    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i];

      if (!rule.pattern) {
        return {
          valid: false,
          reason: `规则 ${i + 1} 缺少 pattern`,
          severity: 'error',
        };
      }

      if (!rule.message || rule.message.trim().length === 0) {
        return {
          valid: false,
          reason: `规则 ${i + 1} 缺少 message`,
          severity: 'error',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * 合并多个验证结果
 * @param results - 验证结果数组
 * @returns 合并后的验证结果
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const errors = results.filter((r) => r.severity === 'error' && !r.valid);
  const warnings = results.filter((r) => r.severity === 'warning' && !r.valid);

  if (errors.length > 0) {
    return {
      valid: false,
      reason: errors.map((e) => e.reason).join('; '),
      severity: 'error',
    };
  }

  if (warnings.length > 0) {
    return {
      valid: false,
      reason: warnings.map((w) => w.reason).join('; '),
      severity: 'warning',
    };
  }

  return { valid: true };
}

/**
 * 创建验证报告
 * @param results - 验证结果数组
 * @returns 格式化的验证报告
 */
export function createValidationReport(results: ValidationResult[]): string {
  const errors = results.filter((r) => r.severity === 'error' && !r.valid);
  const warnings = results.filter((r) => r.severity === 'warning' && !r.valid);

  const report: string[] = [];

  if (errors.length > 0) {
    report.push(`❌ ${errors.length} 个错误:`);
    errors.forEach((e, i) => {
      report.push(`  ${i + 1}. ${e.reason}`);
    });
  }

  if (warnings.length > 0) {
    report.push(`⚠️ ${warnings.length} 个警告:`);
    warnings.forEach((w, i) => {
      report.push(`  ${i + 1}. ${w.reason}`);
    });
  }

  if (errors.length === 0 && warnings.length === 0) {
    report.push('✅ 所有验证通过');
  }

  return report.join('\n');
}