/**
 * Command Parser — 前端命令解析引擎
 *
 * F-5: 将用户输入解析为结构化命令对象
 * 支持: Slash 命令 (/deploy) + 自然语言 (部署 v1.2.3 到 staging)
 */

import Ajv, { ErrorObject as _AjvErrorObject } from 'ajv';
import type { ErrorObject } from 'ajv';

// Ajv 的 ErrorObject 类型缺少 instancePath 属性，添加类型声明
interface ExtendedErrorObject extends ErrorObject {
  instancePath?: string;
}

export interface ParsedCommand {
  command: string;
  params: Record<string, unknown>;
  rawInput: string;
}

export interface ParseResult {
  success: boolean;
  parsed?: ParsedCommand;
  error?: string;
}

// 关键词 → 命令映射
const KEYWORD_RULES: Array<{
  keywords: RegExp[];
  command: string;
  paramExtractor: (input: string) => Record<string, unknown>;
}> = [
  {
    keywords: [/部署|deploy/i],
    command: 'deploy',
    paramExtractor: (input) => {
      const versionMatch = input.match(/v?\d+\.\d+\.\d+/);
      const envMatch = input.match(/到|to|in\s+(staging|production|development|testing)/i);
      return {
        version: versionMatch?.[0] || '',
        environment: envMatch?.[1]?.toLowerCase() || '',
      };
    },
  },
  {
    keywords: [/查看.*日志|查看日志|日志|logs/i],
    command: 'logs',
    paramExtractor: (input) => {
      const resourceMatch = input.match(/(\S+)\s*(日志|错误)/);
      const envMatch = input.match(/(staging|production|development|testing)/i);
      return {
        resource: resourceMatch?.[1] || '',
        environment: envMatch?.[1]?.toLowerCase() || '',
      };
    },
  },
  {
    keywords: [/重启|restart/i],
    command: 'restart',
    paramExtractor: (input) => {
      const podMatch = input.match(/(\S+-\S+)/);
      const nsMatch = input.match(/namespace\s*[:=]\s*(\S+)/);
      return { pod: podMatch?.[1] || '', namespace: nsMatch?.[1] || 'default' };
    },
  },
  {
    keywords: [/状态|status|健康|health/i],
    command: 'status',
    paramExtractor: (input) => {
      const envMatch = input.match(/(staging|production|development|testing)/i);
      return { environment: envMatch?.[1]?.toLowerCase() || '' };
    },
  },
  {
    keywords: [/回滚|rollback|回退/i],
    command: 'rollback',
    paramExtractor: (input) => {
      const versionMatch = input.match(/v?\d+\.\d+\.\d+/);
      const envMatch = input.match(/(staging|production|development|testing)/i);
      return { version: versionMatch?.[0] || '', environment: envMatch?.[1]?.toLowerCase() || '' };
    },
  },
  {
    keywords: [/诊断|根因|diagnose/i],
    command: 'diagnose',
    paramExtractor: (input) => {
      const resourceMatch = input.match(/(\S+)\s*(诊断|根因)/);
      return { resource: resourceMatch?.[1] || '' };
    },
  },
];

// 安全校验 (与后端 B-2 InputValidator 对齐)
const DANGEROUS_CHARS = /[;|&$`(){}[\]<>\\!#~]/;
const PATH_TRAVERSAL = /\.\.[/\\]/;

export class CommandParser {
  private ajv: InstanceType<typeof Ajv>;
  private schemas: Map<string, Record<string, unknown>>;

  constructor() {
    this.ajv = new Ajv();
    this.schemas = new Map();
  }

  registerSchema(command: string, schema: Record<string, unknown>) {
    this.schemas.set(command, schema);
  }

  parse(input: string): ParseResult {
    // 1. 安全预检
    if (DANGEROUS_CHARS.test(input)) {
      return { success: false, error: '输入包含不允许的字符' };
    }
    if (PATH_TRAVERSAL.test(input)) {
      return { success: false, error: '不允许路径遍历' };
    }

    // 2. Slash 命令解析
    if (input.startsWith('/')) {
      return this.parseSlashCommand(input);
    }

    // 3. 自然语言解析 (关键词匹配)
    return this.parseNaturalLanguage(input);
  }

  private parseSlashCommand(input: string): ParseResult {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0].slice(1);
    const params: Record<string, unknown> = {};

    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(/^(\w+)=(.+)$/);
      if (match) params[match[1]] = match[2];
    }

    // Schema 校验
    const schema = this.schemas.get(commandName);
    if (schema) {
      const validate = this.ajv.compile(schema);
      if (!validate(params)) {
        return { success: false, error: this.formatAjvErrors(validate.errors ?? null) };
      }
    }

    return { success: true, parsed: { command: commandName, params, rawInput: input } };
  }

  private parseNaturalLanguage(input: string): ParseResult {
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some((re) => re.test(input))) {
        const params = rule.paramExtractor(input);
        return { success: true, parsed: { command: rule.command, params, rawInput: input } };
      }
    }
    return { success: false, error: '无法识别命令' };
  }

  private formatAjvErrors(errors: ExtendedErrorObject[] | null): string {
    if (!errors || errors.length === 0) return '参数校验失败';
    return errors.map((e) => `${e.instancePath || '参数'}: ${e.message}`).join('; ');
  }
}
