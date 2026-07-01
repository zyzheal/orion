/**
 * 审查规则引擎
 *
 * 基于规则的代码审查引擎，支持：
 * 1. 内置安全、性能、风格、最佳实践规则
 * 2. 自定义规则注册
 * 3. 对 diff 内容进行规则匹配
 * 4. 生成审查评论
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ReviewRule,
  ReviewComment,
  RuleCategory,
  Severity,
  DiffParseResult,
  ChangedLine,
} from './types';
import { DiffAnalyzer } from './DiffAnalyzer';
import { ReviewRuleRepository, ReviewRuleEntity } from '../../repositories/ReviewRuleRepository';
import pino from 'pino';

const logger = pino({ name: 'LReview-LRule-LEngine' });

/** 默认配置 */
const DEFAULT_RULES: ReviewRule[] = [
  // ===== 安全规则 =====
  {
    id: 'sec-001',
    name: '硬编码密码检测',
    category: RuleCategory.SECURITY,
    severity: Severity.CRITICAL,
    pattern: '(password|passwd|pwd)\\s*=\\s*[\'"][^\'"]{3,}[\'"]',
    description: '检测代码中的硬编码密码或密钥',
    suggestion: '请使用环境变量或密钥管理服务存储敏感信息',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['security', 'credentials'],
    },
  },
  {
    id: 'sec-002',
    name: 'API 密钥泄露',
    category: RuleCategory.SECURITY,
    severity: Severity.CRITICAL,
    pattern: '(api[_-]?key|apikey|access[_-]?key|secret[_-]?key)\\s*=\\s*[\'"][^\'"]{8,}[\'"]',
    description: '检测代码中的 API 密钥或 Access Key',
    suggestion: '请使用环境变量或密钥管理服务存储 API 密钥',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['security', 'api-key'],
    },
  },
  {
    id: 'sec-003',
    name: 'SQL 注入风险',
    category: RuleCategory.SECURITY,
    severity: Severity.CRITICAL,
    pattern: '(execute|query|raw)\\s*\\(\\s*[`\'"].*\\+',
    description: '检测可能的 SQL 注入风险 (字符串拼接 SQL)',
    suggestion: '请使用参数化查询或 ORM 构建查询',
    enabled: true,
    fileExtensions: ['ts', 'js', 'py', 'java', 'go'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['security', 'sql-injection'],
    },
  },
  {
    id: 'sec-004',
    name: 'eval() 使用',
    category: RuleCategory.SECURITY,
    severity: Severity.WARNING,
    pattern: '\\beval\\s*\\(',
    description: '使用 eval() 存在安全风险',
    suggestion: '避免使用 eval()，考虑使用 JSON.parse() 或其他安全替代方案',
    enabled: true,
    fileExtensions: ['ts', 'js', 'py'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['security', 'eval'],
    },
  },
  {
    id: 'sec-005',
    name: 'TLS 证书验证跳过',
    category: RuleCategory.SECURITY,
    severity: Severity.CRITICAL,
    pattern: '(rejectUnauthorized|verify_ssl|insecure|TLS_SKIP_VERIFY)\\s*[=:]+\\s*(false|0|true|1)',
    description: '检测跳过 TLS 证书验证的代码',
    suggestion: '生产环境不应跳过 TLS 证书验证',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['security', 'tls'],
    },
  },

  // ===== 性能规则 =====
  {
    id: 'perf-001',
    name: '循环中的数据库查询',
    category: RuleCategory.PERFORMANCE,
    severity: Severity.WARNING,
    pattern: '(for|while|forEach|map)\\s*.*\\.(query|find|select|execute)',
    description: '在循环中执行数据库查询可能导致 N+1 问题',
    suggestion: '使用批量查询或 JOIN 替代循环查询',
    enabled: true,
    fileExtensions: ['ts', 'js', 'py', 'java', 'go'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['performance', 'n-plus-1'],
    },
  },
  {
    id: 'perf-002',
    name: 'Console.log 在生产代码中',
    category: RuleCategory.PERFORMANCE,
    severity: Severity.INFO,
    pattern: 'console\\.(log|debug|info)\\s*\\(',
    description: 'console.log 在生产环境中可能影响性能',
    suggestion: '使用日志框架替代 console.log，或确保在生产环境中被移除',
    enabled: true,
    fileExtensions: ['ts', 'js'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['performance', 'logging'],
    },
  },
  {
    id: 'perf-003',
    name: '未使用 await 的 Promise',
    category: RuleCategory.PERFORMANCE,
    severity: Severity.WARNING,
    pattern: 'new\\s+Promise\\s*\\(',
    description: '创建了 Promise 但未看到 await 或 .then() 处理',
    suggestion: '确保 Promise 被正确 await 或 .then() 处理',
    enabled: true,
    fileExtensions: ['ts', 'js'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['performance', 'async'],
    },
  },

  // ===== 风格规则 =====
  {
    id: 'style-001',
    name: '过长的行',
    category: RuleCategory.STYLE,
    severity: Severity.SUGGESTION,
    pattern: '^.{121,}$',
    description: '行长度超过 120 字符',
    suggestion: '建议每行不超过 120 字符以提高可读性',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['style', 'line-length'],
    },
  },
  {
    id: 'style-002',
    name: 'TODO 注释',
    category: RuleCategory.STYLE,
    severity: Severity.INFO,
    pattern: '//\\s*TODO[:\\s]|/\\*\\s*TODO[:\\s]|#\\s*TODO[:\\s]',
    description: '发现 TODO 注释',
    suggestion: 'TODO 注释应在合并前处理或创建跟踪 issue',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['style', 'todo'],
    },
  },
  {
    id: 'style-003',
    name: 'FIXME 注释',
    category: RuleCategory.STYLE,
    severity: Severity.WARNING,
    pattern: '//\\s*FIXME[:\\s]|/\\*\\s*FIXME[:\\s]|#\\s*FIXME[:\\s]',
    description: '发现 FIXME 注释',
    suggestion: 'FIXME 注释应在合并前修复',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['style', 'fixme'],
    },
  },
  {
    id: 'style-004',
    name: 'HACK 注释',
    category: RuleCategory.STYLE,
    severity: Severity.INFO,
    pattern: '//\\s*HACK[:\\s]|/\\*\\s*HACK[:\\s]|#\\s*HACK[:\\s]',
    description: '发现 HACK 注释',
    suggestion: 'HACK 注释表示代码中有临时方案，应考虑长期改进',
    enabled: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['style', 'hack'],
    },
  },

  // ===== 最佳实践规则 =====
  {
    id: 'bp-001',
    name: 'any 类型使用',
    category: RuleCategory.BEST_PRACTICE,
    severity: Severity.WARNING,
    pattern: ':\\s*any\\b|as\\s+any\\b|<any>',
    description: '使用 any 类型会降低类型安全性',
    suggestion: '使用具体的类型定义或 unknown 替代 any',
    enabled: true,
    fileExtensions: ['ts', 'tsx'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['best-practice', 'typescript', 'type-safety'],
    },
  },
  {
    id: 'bp-002',
    name: '非空断言操作符',
    category: RuleCategory.BEST_PRACTICE,
    severity: Severity.INFO,
    pattern: '!\\.',
    description: '使用非空断言操作符 (!) 可能隐藏潜在的空值问题',
    suggestion: '考虑使用可选链 (?.) 或显式的空值检查',
    enabled: true,
    fileExtensions: ['ts', 'tsx'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['best-practice', 'typescript', 'null-safety'],
    },
  },
  {
    id: 'bp-003',
    name: 'var 声明',
    category: RuleCategory.BEST_PRACTICE,
    severity: Severity.SUGGESTION,
    pattern: '\\bvar\\s+\\w+',
    description: '使用 var 声明变量而不是 let 或 const',
    suggestion: '使用 const (默认) 或 let 替代 var',
    enabled: true,
    fileExtensions: ['ts', 'js'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['best-practice', 'variable-declaration'],
    },
  },
  {
    id: 'bp-004',
    name: 'catch 块中的空错误处理',
    category: RuleCategory.BEST_PRACTICE,
    severity: Severity.WARNING,
    pattern: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}',
    description: 'catch 块为空，错误被静默忽略',
    suggestion: '至少记录错误日志或重新抛出错误',
    enabled: true,
    fileExtensions: ['ts', 'js', 'py', 'java', 'go'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['best-practice', 'error-handling'],
    },
  },
];

/**
 * 审查规则引擎
 */
export class ReviewRuleEngine {
  private rules: Map<string, ReviewRule>;
  private diffAnalyzer: DiffAnalyzer;
  private repository?: ReviewRuleRepository;

  constructor(repository?: ReviewRuleRepository, customRules?: ReviewRule[]) {
    this.rules = new Map();
    this.diffAnalyzer = new DiffAnalyzer();
    this.repository = repository;

    // 加载内置规则
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.id, { ...rule });
    }

    // 从 Repository 加载持久化的自定义规则
    if (repository) {
      this.loadFromRepository().catch(() => {
        // Repository load failed, continue with default rules only
      });
    }

    // 加载传入的自定义规则
    if (customRules) {
      for (const rule of customRules) {
        this.rules.set(rule.id, { ...rule });
      }
    }
  }

  /**
   * 从 Repository 加载持久化的自定义规则
   */
  private async loadFromRepository(): Promise<void> {
    try {
      const entities = await this.repository!.findAll();
      for (const entity of entities.entities) {
        const rule = this.mapEntityToRule(entity);
        this.rules.set(rule.id, rule);
      }
    } catch {
      // Silently ignore load errors - default rules still available
    }
  }

  /**
   * 将 Repository entity 转换为 ReviewRule
   */
  private mapEntityToRule(entity: ReviewRuleEntity): ReviewRule {
    return {
      id: entity.id,
      name: entity.name,
      category: entity.category as RuleCategory,
      severity: entity.severity as Severity,
      pattern: entity.pattern,
      description: entity.description,
      suggestion: entity.suggestion ?? undefined,
      enabled: entity.enabled,
      fileExtensions: entity.fileExtensions,
      metadata: entity.metadata,
    };
  }

  /**
   * 将 ReviewRule 转换为 Repository entity
   */
  private mapRuleToEntity(rule: ReviewRule): Partial<ReviewRuleEntity> {
    return {
      id: rule.id,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      pattern: rule.pattern,
      description: rule.description,
      suggestion: rule.suggestion ?? null,
      enabled: rule.enabled,
      fileExtensions: rule.fileExtensions ?? [],
      metadata: rule.metadata ?? {},
    };
  }

  /**
   * 注册规则 (持久化到 Repository)
   */
  async registerRule(rule: ReviewRule): Promise<void> {
    this.rules.set(rule.id, { ...rule });

    if (this.repository) {
      try {
        await this.repository.upsert(this.mapRuleToEntity(rule));
      } catch {
        // Persistence failed, but rule is registered in memory
      }
    }
  }

  /**
   * 移除规则 (从 Repository 删除)
   */
  async removeRule(ruleId: string): Promise<boolean> {
    const removed = this.rules.delete(ruleId);

    if (removed && this.repository) {
      try {
        await this.repository.delete(ruleId);
      } catch {
        // Deletion from repository failed, but removed from memory
      }
    }

    return removed;
  }

  /**
   * 更新规则 (持久化到 Repository)
   */
  async updateRule(ruleId: string, updates: Partial<ReviewRule>): Promise<ReviewRule | undefined> {
    const existing = this.rules.get(ruleId);
    if (!existing) return undefined;

    const updated: ReviewRule = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        createdAt: existing.metadata?.createdAt ?? new Date(),
        updatedAt: new Date(),
      },
    };

    this.rules.set(ruleId, updated);

    if (this.repository) {
      try {
        await this.repository.upsert(this.mapRuleToEntity(updated));
      } catch {
        // Update failed in repository, but memory is updated
      }
    }

    return updated;
  }

  /**
   * 获取规则
   */
  getRule(ruleId: string): ReviewRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): ReviewRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取启用的规则
   */
  getEnabledRules(): ReviewRule[] {
    return this.getAllRules().filter((r) => r.enabled);
  }

  /**
   * 评估单行代码与规则的匹配
   */
  evaluateLine(line: ChangedLine, rules?: ReviewRule[]): ReviewComment[] {
    const targetRules = rules || this.getEnabledRules();
    const comments: ReviewComment[] = [];

    for (const rule of targetRules) {
      if (!rule.enabled) continue;

      // 检查文件扩展名过滤
      if (rule.fileExtensions && rule.fileExtensions.length > 0) {
        const ext = this.getFileExtension(line.filePath);
        if (!rule.fileExtensions.includes(ext)) {
          continue;
        }
      }

      // 匹配规则
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(line.content)) {
          comments.push({
            id: uuidv4(),
            ruleId: rule.id,
            filePath: line.filePath,
            lineNumber: line.lineNumber,
            severity: rule.severity,
            message: `[${rule.name}] ${rule.description}`,
            suggestion: rule.suggestion,
            codeSnippet: line.content.trim(),
            source: 'rule',
            createdAt: new Date(),
          });
        }
      } catch {
        // 忽略无效的正则表达式
        continue;
      }
    }

    return comments;
  }

  /**
   * 评估 diff 内容
   */
  evaluateDiff(diffText: string, rules?: ReviewRule[]): ReviewComment[] {
    const result = this.diffAnalyzer.parseDiff(diffText);
    return this.evaluateChangedLines(result.changedLines, rules);
  }

  /**
   * 获取匹配的规则 (给定代码内容)
   */
  getMatchingRules(code: string, rules?: ReviewRule[]): ReviewRule[] {
    const targetRules = rules || this.getEnabledRules();
    return targetRules.filter((rule) => {
      if (!rule.enabled) return false;
      try {
        const regex = new RegExp(rule.pattern, 'i');
        return regex.test(code);
      } catch {
        return false;
      }
    });
  }

  /**
   * 运行完整审查
   */
  runReview(diffText: string): {
    comments: ReviewComment[];
    stats: {
      totalLines: number;
      matchedLines: number;
      rulesEvaluated: number;
    };
  } {
    const enabledRules = this.getEnabledRules();
    const comments = this.evaluateDiff(diffText, enabledRules);

    const result = this.diffAnalyzer.parseDiff(diffText);

    return {
      comments,
      stats: {
        totalLines: result.changedLines.length,
        matchedLines: new Set(comments.map((c) => `${c.filePath}:${c.lineNumber}`)).size,
        rulesEvaluated: enabledRules.length,
      },
    };
  }

  // ==================== 内部方法 ====================

  /**
   * 评估所有变更行
   */
  private evaluateChangedLines(
    lines: ChangedLine[],
    rules?: ReviewRule[]
  ): ReviewComment[] {
    const allComments: ReviewComment[] = [];

    for (const line of lines) {
      const comments = this.evaluateLine(line, rules);
      allComments.push(...comments);
    }

    return allComments;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }
}
