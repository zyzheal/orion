/**
 * AI Security Service - Stub
 * Provides AI security checking, sandbox execution, and audit logging.
 */

import { AuditRepository } from './audit/AuditRepository';

export interface AISecurityConfig {
  [key: string]: unknown;
}

export interface SecurityCheckResult {
  passed: boolean;
  riskScore: number;
  violations: string[];
  sanitizedInput?: string;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  request_body?: Record<string, unknown>;
  created_at: Date;
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * 白名单允许的操作 - 仅允许安全的数据转换和验证操作
 */
const ALLOWED_ACTIONS = [
  'calculate',
  'transform',
  'validate',
  'filter',
  'map',
  'reduce',
  'sort',
  'parse',
  'format',
];

/**
 * 可用的安全函数白名单 - 供 execute 使用
 */
const SAFE_FUNCTIONS = {
  // 数学运算
  calculate: (params: Record<string, unknown>) => {
    const { expression } = params;
    if (typeof expression !== 'string') {
      throw new SecurityError('expression must be a string');
    }
    // 仅允许数字和运算符的安全表达式
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      throw new SecurityError('Invalid expression: only numbers and operators allowed');
    }
    // 使用 Function 进行安全计算（限制作用域）
    const safeEval = new Function(`return ${expression}`);
    const result = safeEval();
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new SecurityError('Expression must evaluate to a finite number');
    }
    return { result };
  },

  // 数据转换
  transform: (params: Record<string, unknown>) => {
    const { data, operations } = params;
    if (!Array.isArray(data)) {
      throw new SecurityError('data must be an array');
    }
    if (!Array.isArray(operations)) {
      throw new SecurityError('operations must be an array');
    }

    let result: unknown[] = [...data];
    for (const op of operations) {
      if (typeof op !== 'object' || !op) {
        continue;
      }
      const operation = op as { type: string; value?: unknown };
      switch (operation.type) {
        case 'map':
          if (typeof operation.value === 'function') {
            const mapper = operation.value as (value: unknown, index: number, array: unknown[]) => unknown;
            result = result.map(mapper);
          }
          break;
        case 'filter':
          if (typeof operation.value === 'function') {
            const filterer = operation.value as (value: unknown, index: number, array: unknown[]) => unknown;
            result = result.filter(filterer);
          }
          break;
        case 'sort':
          result.sort(operation.value as ((a: unknown, b: unknown) => number) | undefined);
          break;
        default:
          break;
      }
    }
    return { result };
  },

  // 数据验证
  validate: (params: Record<string, unknown>) => {
    const { data, rules } = params;
    if (!Array.isArray(rules)) {
      throw new SecurityError('rules must be an array');
    }

    const violations: string[] = [];
    const dataObj = data as Record<string, unknown> | undefined;
    for (const rule of rules) {
      if (typeof rule !== 'object' || !rule) continue;
      const r = rule as { field: string; type: string; value?: unknown };
      const value = dataObj?.[r.field];

      switch (r.type) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            violations.push(`Field ${r.field} is required`);
          }
          break;
        case 'type':
          if (r.value && typeof value !== r.value) {
            violations.push(`Field ${r.field} must be of type ${r.value}`);
          }
          break;
        case 'min':
          if (typeof value === 'number' && value < (r.value as number)) {
            violations.push(`Field ${r.field} must be >= ${r.value}`);
          }
          break;
        case 'max':
          if (typeof value === 'number' && value > (r.value as number)) {
            violations.push(`Field ${r.field} must be <= ${r.value}`);
          }
          break;
        case 'pattern':
          if (typeof value === 'string' && r.value && !new RegExp(r.value as string).test(value)) {
            violations.push(`Field ${r.field} does not match pattern`);
          }
          break;
        default:
          break;
      }
    }

    return { valid: violations.length === 0, violations };
  },

  // 数组过滤
  filter: (params: Record<string, unknown>) => {
    const { data, predicate } = params;
    if (!Array.isArray(data)) {
      throw new SecurityError('data must be an array');
    }
    if (typeof predicate !== 'function') {
      throw new SecurityError('predicate must be a function');
    }
    const filterFn = predicate as (value: unknown, index: number, array: unknown[]) => unknown;
    return { result: data.filter(filterFn) };
  },

  // 数组映射
  map: (params: Record<string, unknown>) => {
    const { data, transformer } = params;
    if (!Array.isArray(data)) {
      throw new SecurityError('data must be an array');
    }
    if (typeof transformer !== 'function') {
      throw new SecurityError('transformer must be a function');
    }
    const mapFn = transformer as (value: unknown, index: number, array: unknown[]) => unknown;
    return { result: data.map(mapFn) };
  },

  // 数组归约
  reduce: (params: Record<string, unknown>) => {
    const { data, reducer, initialValue } = params;
    if (!Array.isArray(data)) {
      throw new SecurityError('data must be an array');
    }
    if (typeof reducer !== 'function') {
      throw new SecurityError('reducer must be a function');
    }
    const reduceFn = reducer as (previousValue: unknown, currentValue: unknown, currentIndex: number, array: unknown[]) => unknown;
    return { result: data.reduce(reduceFn, initialValue) };
  },

  // 数组排序
  sort: (params: Record<string, unknown>) => {
    const { data, comparator } = params;
    if (!Array.isArray(data)) {
      throw new SecurityError('data must be an array');
    }
    const result: unknown[] = [...data];
    if (typeof comparator === 'function') {
      const compareFn = comparator as (a: unknown, b: unknown) => number;
      result.sort(compareFn);
    } else {
      result.sort();
    }
    return { result };
  },

  // JSON 解析
  parse: (params: Record<string, unknown>) => {
    const { json, reviver } = params;
    if (typeof json !== 'string') {
      throw new SecurityError('json must be a string');
    }
    try {
      const reviverFn = reviver as ((key: string, value: unknown) => unknown) | undefined;
      const parsed = JSON.parse(json, reviverFn);
      return { result: parsed };
    } catch (e) {
      throw new SecurityError(`JSON parse error: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  },

  // JSON 格式化
  format: (params: Record<string, unknown>) => {
    const { data, space } = params;
    const spaceNum = typeof space === 'number' ? Math.min(space, 10) : 2;
    return { result: JSON.stringify(data, null, spaceNum) };
  },
};

export class ExecutionSandbox {
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = Math.min(timeout, 10000); // 最大 10 秒超时
  }

  /**
   * 安全执行代码 - 使用白名单机制
   * 替代方案: 使用 worker threads 或独立的 VM 进程进行真正隔离
   */
  async execute(code: string, context: Record<string, unknown>): Promise<unknown> {
    // 解析请求 - 支持两种格式:
    // 1. { action: 'calculate', params: { ... } }
    // 2. 直接传递代码字符串 (不推荐，已废弃)
    let action: string;
    let params: Record<string, unknown>;

    try {
      const parsed = typeof code === 'string' ? JSON.parse(code) : code;
      action = parsed.action;
      params = parsed.params || {};
    } catch {
      // 如果不是 JSON，尝试直接作为 action 处理（向后兼容）
      // 但这会被白名单过滤掉，因为不包含危险操作
      action = 'legacy';
      params = { code };
    }

    // 验证 action 在白名单中
    if (!ALLOWED_ACTIONS.includes(action)) {
      throw new SecurityError(
        `Action not allowed: ${action}. Allowed actions: ${ALLOWED_ACTIONS.join(', ')}`
      );
    }

    // 执行白名单中的安全函数
    const safeFn = SAFE_FUNCTIONS[action as keyof typeof SAFE_FUNCTIONS];
    if (!safeFn) {
      throw new SecurityError(`Action ${action} not implemented`);
    }

    // 合并 context 到 params，但过滤掉危险属性
    const safeParams = { ...params };
    if (context) {
      // 限制 context 大小防止 DoS
      if (Object.keys(context).length > 50) {
        throw new SecurityError('Context too large (max 50 keys)');
      }
      // 过滤潜在的危险 context 属性
      for (const key of Object.keys(context)) {
        if (key.startsWith('__') || key.startsWith('eval') || key === 'constructor') {
          throw new SecurityError(`Unsafe context key: ${key}`);
        }
      }
    }

    // 执行并添加超时保护
    return Promise.race([
      Promise.resolve(safeFn(safeParams)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new SecurityError('Execution timeout')), this.timeout)
      ),
    ]);
  }
}

export function sanitizeInput(input: string): SecurityCheckResult {
  return { passed: true, riskScore: 0, violations: [], sanitizedInput: input };
}

export function validateOutput(output: string): SecurityCheckResult {
  return { passed: true, riskScore: 0, violations: [] };
}

export class AISecurityService {
  private config: AISecurityConfig;
  private deps: { auditRepository?: AuditRepository };

  constructor(config: AISecurityConfig, deps: { auditRepository?: AuditRepository }) {
    this.config = config;
    this.deps = deps;
  }

  async processRequest(input: string, _userId: string): Promise<{ output: string; riskScore: number }> {
    return { output: input, riskScore: 0 };
  }

  async getAuditLogsAsync(_options: {
    action?: string;
    userId?: string;
    sessionId?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<AuditLogEntry[]> {
    return [];
  }

  async exportAuditLogsAsync(_format: 'json' | 'csv'): Promise<string> {
    return '[]';
  }
}
