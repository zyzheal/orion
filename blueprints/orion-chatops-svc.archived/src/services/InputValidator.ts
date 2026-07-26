/**
 * Input Validator — 输入安全校验服务
 *
 * 功能:
 * 1. 危险字符检查 (命令注入防护)
 * 2. 路径遍历检查
 * 3. 命令白名单校验
 * 4. JSON Schema 参数校验
 * 5. 敏感参数拦截
 * 6. 脱敏处理 (用于审计日志存储)
 */

import Ajv, { ErrorObject } from 'ajv';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParsedCommand {
  command: string;
  params: Record<string, unknown>;
}

const DANGEROUS_CHARS = /[;|&$`(){}[\]<>\\!#~]/;
const PATH_TRAVERSAL = /\.\.[/\\]/;
const SENSITIVE_KEYS = ['password', 'secret', 'token', 'key', 'credential', 'access_key', 'api_key', 'private_key', 'certificate', 'private_key_path'];

export class InputValidator {
  private ajv: Ajv;
  private commandSchemas: Map<string, Record<string, unknown>>;
  private validateFnCache: Map<string, (data: unknown) => boolean> = new Map();

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.commandSchemas = new Map();
  }

  /** 注册命令 Schema */
  registerSchema(commandName: string, schema: Record<string, unknown>): void {
    this.commandSchemas.set(commandName, schema);
    // Q-3: 预编译 validateFn 并缓存
    try {
      const validateFn = this.ajv.compile(schema);
      this.validateFnCache.set(commandName, validateFn as (data: unknown) => boolean);
    } catch {
      // Schema 编译失败时忽略，运行时再处理
    }
  }

  /**
   * 完整校验流程
   * @param input 原始输入字符串
   * @param parsed 解析后的命令对象
   */
  validate(input: string, parsed: ParsedCommand): ValidationResult {
    // S-3: 命令白名单检查放在第一位
    const commandName = parsed.command.startsWith('/') ? parsed.command.slice(1) : parsed.command;
    if (!this.commandSchemas.has(commandName)) {
      return { valid: false, error: `未知命令: ${commandName}` };
    }

    // 1. 危险字符检查 (仅对 /command 模式严格检查)
    if (parsed.command.startsWith('/')) {
      if (DANGEROUS_CHARS.test(input)) {
        return { valid: false, error: '输入包含不允许的字符' };
      }
    }

    // 2. 路径遍历检查 (所有模式)
    if (PATH_TRAVERSAL.test(input)) {
      return { valid: false, error: '不允许路径遍历' };
    }

    // 4. JSON Schema 校验 (使用缓存的 validateFn)
    const validateFn = this.validateFnCache.get(commandName);
    if (validateFn && !validateFn(parsed.params)) {
      return { valid: false, error: this.formatAjvErrors(this.ajv.errors ?? null) };
    } else if (!validateFn) {
      // 未缓存时动态编译
      const schema = this.commandSchemas.get(commandName)!;
      const dynamicFn = this.ajv.compile(schema);
      if (!dynamicFn(parsed.params)) {
        return { valid: false, error: this.formatAjvErrors(this.ajv.errors ?? null) };
      }
    }

    // 5. 敏感参数拦截 (S-4: 扩展白名单)
    for (const key of SENSITIVE_KEYS) {
      if (key in parsed.params) {
        return { valid: false, error: `不允许使用敏感参数: ${key}` };
      }
    }

    return { valid: true };
  }

  /**
   * 脱敏处理 (用于审计日志存储)
   * SE-1: 存储前必须调用此方法
   */
  static sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...obj };
    for (const key of SENSITIVE_KEYS) {
      if (key in result) {
        result[key] = '***REDACTED***';
      }
    }
    return result;
  }

  private formatAjvErrors(errors: ErrorObject[] | null): string {
    if (!errors || errors.length === 0) return '参数校验失败';
    return errors.map(e => `${e.instancePath || '根参数'}: ${e.message}`).join('; ');
  }
}
