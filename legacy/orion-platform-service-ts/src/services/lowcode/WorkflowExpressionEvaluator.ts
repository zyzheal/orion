/**
 * WorkflowExpressionEvaluator - 表达式求值与变量渲染
 *
 * 纯工具类，负责：
 * - 条件表达式安全求值（safeEval）
 * - 变量模板渲染（renderString / renderVariables）
 * - 嵌套对象访问（getNestedValue / setNestedValue）
 * - 变量映射（applyVariableMappings）
 *
 * 无外部状态依赖，可直接实例化使用。
 */

import { createLogger } from '../../utils/logger';
import type { ConditionEvalResult, VariableMapping } from './types';

const logger = createLogger('workflow-expression-evaluator');

export class WorkflowExpressionEvaluator {
  // ==================== 条件表达式求值 ====================

  /**
   * 评估条件表达式 — 安全实现
   *
   * 支持简单比较表达式，如:
   * - ${amount} > 10000
   * - ${status} === 'approved'
   * - ${count} >= 5
   *
   * 不支持任意 JS 代码执行，使用词法分析 + 安全求值
   */
  evaluateCondition(expression: string, variables: Record<string, any>): ConditionEvalResult {
    try {
      // 先将 ${var} 替换为实际值
      const parsedExpr = this.renderString(expression, variables);

      // 安全表达式解析：只允许简单的比较运算
      const result = this.safeEval(parsedExpr);

      return {
        passed: Boolean(result),
        evaluatedValue: result,
        matchedBranch: 'default',
      };
    } catch (error) {
      logger.error({ error, expression }, 'Failed to evaluate condition');
      return {
        passed: false,
      };
    }
  }

  /**
   * 安全求值 — 白名单方案
   *
   * 只允许简单比较运算，使用词法分析 + 白名单校验，
   * 不执行任何 JS 代码。
   *
   * 支持的运算符：>, <, >=, <=, ===, !==, ==, !=
   * 支持的值类型：数字、字符串（单/双引号包裹）、布尔值
   */
  safeEval(expression: string): boolean {
    const trimmed = expression.trim();

    // 输入长度限制 — 防止 ReDoS 和超大输入
    const MAX_EXPR_LEN = 512;
    if (trimmed.length > MAX_EXPR_LEN) {
      logger.warn({ length: trimmed.length }, 'Condition expression exceeds max length');
      return false;
    }

    // 白名单：只允许安全的字符
    // 数字、字母、空格、比较运算符、引号、小数点、下划线、连字符
    const whitelistPattern = /^[0-9a-zA-Z_\s."'=<>\-!]+$/;
    if (!whitelistPattern.test(trimmed)) {
      logger.warn({ expression: trimmed }, 'Expression contains disallowed characters');
      return false;
    }

    // 禁止任何类似函数调用或对象访问的模式
    const dangerousPattern = /[()\[\]{};\\`$@#%&+*/|~?:]/;
    if (dangerousPattern.test(trimmed)) {
      logger.warn({ expression: trimmed }, 'Expression contains dangerous pattern');
      return false;
    }

    // 解析比较表达式：值 运算符 值
    const comparisonPattern = /^\s*(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)\s*$/;
    const match = trimmed.match(comparisonPattern);

    if (!match) {
      // 不是比较表达式，尝试作为布尔字面量
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      return false;
    }

    const [, leftStr, operator, rightStr] = match;
    const left = this.parseValue(leftStr.trim());
    const right = this.parseValue(rightStr.trim());

    switch (operator) {
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      default: return false;
    }
  }

  /**
   * 解析字符串值为适当的类型
   */
  parseValue(str: string): string | number | boolean {
    // 布尔值
    if (str === 'true') return true;
    if (str === 'false') return false;

    // 数字
    const num = Number(str);
    if (!isNaN(num) && str !== '') return num;

    // 去除引号的字符串
    if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }

    return str;
  }

  // ==================== 变量渲染 ====================

  /**
   * 渲染字符串变量
   * 将模板中的 ${var} 替换为实际值
   */
  renderString(template: string, variables: Record<string, any>): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 渲染变量对象
   * 对对象中所有字符串值进行变量替换
   */
  renderVariables(
    vars: Record<string, any>,
    context: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        result[key] = this.renderString(value, context);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // ==================== 嵌套对象访问 ====================

  /**
   * 获取嵌套属性值
   * 支持路径如: user.name, data.items.0.name
   */
  getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * 设置嵌套属性值
   * 自动创建中间对象
   */
  setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  // ==================== 变量映射 ====================

  /**
   * 应用变量映射
   *
   * 将源变量映射到目标变量，用于子流程的输入/输出映射
   */
  applyVariableMappings(
    mappings: VariableMapping[],
    sourceVariables: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const mapping of mappings) {
      const sourceValue = this.getNestedValue(sourceVariables, mapping.source);
      if (sourceValue !== undefined) {
        // 设置目标变量（支持嵌套路径）
        this.setNestedValue(result, mapping.target, sourceValue);
      }
    }

    return result;
  }
}
