/**
 * SQL 审核服务
 *
 * 功能：
 * 1. SQL 语句规范审核（命名、索引、类型等）
 * 2. 执行计划分析（EXPLAIN 解析）
 * 3. SQL 风险评估
 * 4. 审核规则管理
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

/** SQL 语句类型 */
export enum SQLStatementType {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ALTER = 'ALTER',
  DROP = 'DROP',
  CREATE = 'CREATE',
  TRUNCATE = 'TRUNCATE',
  UNKNOWN = 'UNKNOWN',
}

/** 审核严重级别 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/** 审核规则类别 */
export enum AuditRuleCategory {
  NAMING = 'naming',
  INDEX = 'index',
  TYPE = 'type',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  SYNTAX = 'syntax',
}

/** 审核规则 */
export interface AuditRule {
  id: string;
  name: string;
  category: AuditRuleCategory;
  severity: AuditSeverity;
  description: string;
  enabled: boolean;
  checker: (sql: string, context?: AuditContext) => AuditViolation | null;
}

/** 审核上下文 */
export interface AuditContext {
  database?: string;
  table?: string;
  tenantId?: string;
  userId?: string;
}

/** 审核违规 */
export interface AuditViolation {
  ruleId: string;
  ruleName: string;
  category: AuditRuleCategory;
  severity: AuditSeverity;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

/** 执行计划节点 */
export interface ExplainNode {
  id: number;
  selectType: string;
  table: string;
  type: string;
  possibleKeys: string | null;
  key: string | null;
  keyLen: string | null;
  ref: string | null;
  rows: number;
  filtered: number;
  extra: string | null;
}

/** 执行计划分析结果 */
export interface ExplainAnalysis {
  nodes: ExplainNode[];
  fullTableScans: ExplainNode[];
  missingIndexes: ExplainNode[];
  estimatedCost: number;
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/** SQL 审核结果 */
export interface SQLAuditResult {
  id: string;
  sql: string;
  statementType: SQLStatementType;
  timestamp: Date;
  violations: AuditViolation[];
  explainAnalysis?: ExplainAnalysis;
  riskScore: number; // 0-100
  approved: boolean;
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
}

/** 审核请求 */
export interface AuditRequest {
  sql: string;
  database?: string;
  table?: string;
  tenantId?: string;
  userId?: string;
  includeExplain?: boolean;
}

/** 审核历史查询参数 */
export interface AuditHistoryQuery {
  tenantId?: string;
  statementType?: SQLStatementType;
  approved?: boolean;
  minRiskScore?: number;
  since?: Date;
  limit?: number;
}

/** SQL 审核服务配置 */
export interface SQLAuditServiceConfig {
  /** 风险评分阈值（超过此值自动拒绝） */
  autoRejectThreshold: number;
  /** 启用的规则类别 */
  enabledCategories: AuditRuleCategory[];
  /** 是否默认包含执行计划分析 */
  defaultIncludeExplain: boolean;
}

const DEFAULT_CONFIG: SQLAuditServiceConfig = {
  autoRejectThreshold: 80,
  enabledCategories: Object.values(AuditRuleCategory),
  defaultIncludeExplain: true,
};

// ==================== 服务实现 ====================

/**
 * SQL 审核服务
 */
export class SQLAuditService extends EventEmitter {
  private config: SQLAuditServiceConfig;
  private rules: AuditRule[] = [];
  private auditHistory: SQLAuditResult[] = [];

  constructor(config: Partial<SQLAuditServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registerDefaultRules();
  }

  /**
   * 审核 SQL 语句
   */
  async audit(request: AuditRequest): Promise<SQLAuditResult> {
    const { sql, database, table, tenantId, userId, includeExplain } = request;
    const statementType = this.detectStatementType(sql);
    const violations: AuditViolation[] = [];

    // 执行所有启用的规则
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (!this.config.enabledCategories.includes(rule.category)) continue;

      const violation = rule.checker(sql, { database, table, tenantId, userId });
      if (violation) {
        violations.push(violation);
      }
    }

    // 执行计划分析
    let explainAnalysis: ExplainAnalysis | undefined;
    if (includeExplain ?? this.config.defaultIncludeExplain) {
      if (statementType === SQLStatementType.SELECT || statementType === SQLStatementType.UPDATE) {
        explainAnalysis = this.analyzeExplain(sql);
      }
    }

    // 计算风险评分
    const riskScore = this.calculateRiskScore(violations, explainAnalysis);
    const approved = riskScore < this.config.autoRejectThreshold;

    // 统计
    const summary = {
      total: violations.length,
      critical: violations.filter((v) => v.severity === AuditSeverity.CRITICAL).length,
      error: violations.filter((v) => v.severity === AuditSeverity.ERROR).length,
      warning: violations.filter((v) => v.severity === AuditSeverity.WARNING).length,
      info: violations.filter((v) => v.severity === AuditSeverity.INFO).length,
    };

    const result: SQLAuditResult = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sql,
      statementType,
      timestamp: new Date(),
      violations,
      explainAnalysis,
      riskScore,
      approved,
      summary,
    };

    // 记录历史
    this.auditHistory.push(result);
    this.emit('audit-completed', result);

    return result;
  }

  /**
   * 批量审核
   */
  async auditBatch(requests: AuditRequest[]): Promise<SQLAuditResult[]> {
    const results: SQLAuditResult[] = [];
    for (const request of requests) {
      results.push(await this.audit(request));
    }
    return results;
  }

  /**
   * 获取审核历史
   */
  getHistory(query: AuditHistoryQuery = {}): SQLAuditResult[] {
    let results = [...this.auditHistory];

    if (query.tenantId) {
      // In real impl, would filter by tenantId stored in result
    }
    if (query.statementType) {
      results = results.filter((r) => r.statementType === query.statementType);
    }
    if (query.approved !== undefined) {
      results = results.filter((r) => r.approved === query.approved);
    }
    if (query.minRiskScore !== undefined) {
      results = results.filter((r) => r.riskScore >= query.minRiskScore!);
    }
    if (query.since) {
      results = results.filter((r) => r.timestamp >= query.since!);
    }
    if (query.limit) {
      results = results.slice(-query.limit);
    }

    return results;
  }

  /**
   * 获取审核统计
   */
  getStats(): {
    totalAudits: number;
    approvedCount: number;
    rejectedCount: number;
    averageRiskScore: number;
    topViolations: { ruleName: string; count: number }[];
    byStatementType: Record<string, number>;
  } {
    const total = this.auditHistory.length;
    const approved = this.auditHistory.filter((r) => r.approved).length;
    const avgRisk = total > 0
      ? this.auditHistory.reduce((sum, r) => sum + r.riskScore, 0) / total
      : 0;

    // 统计违规规则频率
    const violationCounts = new Map<string, number>();
    for (const result of this.auditHistory) {
      for (const v of result.violations) {
        violationCounts.set(v.ruleName, (violationCounts.get(v.ruleName) || 0) + 1);
      }
    }
    const topViolations = Array.from(violationCounts.entries())
      .map(([ruleName, count]) => ({ ruleName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 按语句类型统计
    const byStatementType: Record<string, number> = {};
    for (const result of this.auditHistory) {
      byStatementType[result.statementType] = (byStatementType[result.statementType] || 0) + 1;
    }

    return {
      totalAudits: total,
      approvedCount: approved,
      rejectedCount: total - approved,
      averageRiskScore: Math.round(avgRisk),
      topViolations,
      byStatementType,
    };
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: AuditRule): void {
    const existing = this.rules.find((r) => r.id === rule.id);
    if (existing) {
      throw new Error(`Rule with id ${rule.id} already exists`);
    }
    this.rules.push(rule);
    this.emit('rule-added', rule);
  }

  /**
   * 更新规则启用状态
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /**
   * 获取所有规则
   */
  getRules(): AuditRule[] {
    return [...this.rules];
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SQLAuditServiceConfig>): void {
    Object.assign(this.config, updates);
  }

  // ==================== 内部方法 ====================

  /**
   * 检测 SQL 语句类型
   */
  private detectStatementType(sql: string): SQLStatementType {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return SQLStatementType.SELECT;
    if (trimmed.startsWith('INSERT')) return SQLStatementType.INSERT;
    if (trimmed.startsWith('UPDATE')) return SQLStatementType.UPDATE;
    if (trimmed.startsWith('DELETE')) return SQLStatementType.DELETE;
    if (trimmed.startsWith('ALTER')) return SQLStatementType.ALTER;
    if (trimmed.startsWith('DROP')) return SQLStatementType.DROP;
    if (trimmed.startsWith('CREATE')) return SQLStatementType.CREATE;
    if (trimmed.startsWith('TRUNCATE')) return SQLStatementType.TRUNCATE;
    return SQLStatementType.UNKNOWN;
  }

  /**
   * 计算风险评分
   */
  private calculateRiskScore(violations: AuditViolation[], explain?: ExplainAnalysis): number {
    let score = 0;

    for (const v of violations) {
      switch (v.severity) {
        case AuditSeverity.CRITICAL: score += 30; break;
        case AuditSeverity.ERROR: score += 15; break;
        case AuditSeverity.WARNING: score += 5; break;
        case AuditSeverity.INFO: score += 1; break;
      }
    }

    if (explain) {
      score += explain.fullTableScans.length * 10;
      score += explain.missingIndexes.length * 8;
      if (explain.riskLevel === 'critical') score += 20;
      else if (explain.riskLevel === 'high') score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * 模拟 EXPLAIN 分析
   */
  private analyzeExplain(sql: string): ExplainAnalysis {
    // 模拟解析 EXPLAIN 结果
    const hasWhere = sql.toUpperCase().includes('WHERE');
    const hasJoin = sql.toUpperCase().includes('JOIN');
    const hasIndex = sql.toUpperCase().includes('INDEX');

    const nodes: ExplainNode[] = [{
      id: 1,
      selectType: 'SIMPLE',
      table: 'unknown',
      type: hasWhere ? 'ref' : 'ALL',
      possibleKeys: hasIndex ? 'idx_id' : null,
      key: hasIndex ? 'idx_id' : null,
      keyLen: hasIndex ? '4' : null,
      ref: null,
      rows: hasWhere ? 100 : 10000,
      filtered: hasWhere ? 50 : 100,
      extra: hasJoin ? 'Using temporary; Using filesort' : null,
    }];

    const fullTableScans = nodes.filter((n) => n.type === 'ALL');
    const missingIndexes = nodes.filter((n) => !n.key && n.rows > 1000);

    const recommendations: string[] = [];
    if (fullTableScans.length > 0) {
      recommendations.push('存在全表扫描，建议添加合适的索引');
    }
    if (missingIndexes.length > 0) {
      recommendations.push('大表查询未使用索引，建议优化查询条件');
    }
    if (hasJoin) {
      recommendations.push('JOIN 查询注意关联字段是否有索引');
    }

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (fullTableScans.length > 0 && nodes[0].rows > 10000) riskLevel = 'critical';
    else if (fullTableScans.length > 0) riskLevel = 'high';
    else if (missingIndexes.length > 0) riskLevel = 'medium';

    return {
      nodes,
      fullTableScans,
      missingIndexes,
      estimatedCost: nodes.reduce((sum, n) => sum + n.rows, 0),
      recommendations,
      riskLevel,
    };
  }

  /**
   * 注册默认审核规则
   */
  private registerDefaultRules(): void {
    // 1. 禁止 SELECT *
    this.rules.push({
      id: 'no-select-star',
      name: '禁止 SELECT *',
      category: AuditRuleCategory.PERFORMANCE,
      severity: AuditSeverity.WARNING,
      description: 'SELECT * 会查询所有字段，影响性能',
      enabled: true,
      checker: (sql) => {
        if (/SELECT\s+\*/i.test(sql)) {
          return {
            ruleId: 'no-select-star',
            ruleName: '禁止 SELECT *',
            category: AuditRuleCategory.PERFORMANCE,
            severity: AuditSeverity.WARNING,
            message: '建议明确指定需要的字段，避免 SELECT *',
            suggestion: '将 SELECT * 替换为具体字段列表',
          };
        }
        return null;
      },
    });

    // 2. DELETE/UPDATE 必须有 WHERE
    this.rules.push({
      id: 'require-where-clause',
      name: 'DELETE/UPDATE 必须有 WHERE',
      category: AuditRuleCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      description: '无 WHERE 的 DELETE/UPDATE 会影响全表数据',
      enabled: true,
      checker: (sql) => {
        const upper = sql.trim().toUpperCase();
        if ((upper.startsWith('DELETE') || upper.startsWith('UPDATE')) && !upper.includes('WHERE')) {
          return {
            ruleId: 'require-where-clause',
            ruleName: 'DELETE/UPDATE 必须有 WHERE',
            category: AuditRuleCategory.SECURITY,
            severity: AuditSeverity.CRITICAL,
            message: 'DELETE/UPDATE 语句缺少 WHERE 条件，可能导致全表数据被修改',
            suggestion: '添加 WHERE 条件限制影响范围',
          };
        }
        return null;
      },
    });

    // 3. 禁止使用 DROP
    this.rules.push({
      id: 'no-drop-statement',
      name: '禁止 DROP 语句',
      category: AuditRuleCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      description: 'DROP 语句不可逆，需要特殊审批',
      enabled: true,
      checker: (sql) => {
        if (/^\s*DROP\s/i.test(sql.trim())) {
          return {
            ruleId: 'no-drop-statement',
            ruleName: '禁止 DROP 语句',
            category: AuditRuleCategory.SECURITY,
            severity: AuditSeverity.CRITICAL,
            message: 'DROP 语句不可逆，请确认是否需要执行',
            suggestion: '考虑使用软删除或归档替代',
          };
        }
        return null;
      },
    });

    // 4. 禁止 TRUNCATE
    this.rules.push({
      id: 'no-truncate',
      name: '禁止 TRUNCATE 语句',
      category: AuditRuleCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      description: 'TRUNCATE 不可逆且不触发触发器',
      enabled: true,
      checker: (sql) => {
        if (/^\s*TRUNCATE\s/i.test(sql.trim())) {
          return {
            ruleId: 'no-truncate',
            ruleName: '禁止 TRUNCATE 语句',
            category: AuditRuleCategory.SECURITY,
            severity: AuditSeverity.CRITICAL,
            message: 'TRUNCATE 不可逆，建议使用 DELETE 替代',
            suggestion: '使用 DELETE FROM table WHERE 1=1',
          };
        }
        return null;
      },
    });

    // 5. LIKE 查询左模糊
    this.rules.push({
      id: 'no-left-like',
      name: '避免左模糊查询',
      category: AuditRuleCategory.PERFORMANCE,
      severity: AuditSeverity.WARNING,
      description: 'LIKE "%xxx" 无法使用索引',
      enabled: true,
      checker: (sql) => {
        if (/LIKE\s+['"]%/i.test(sql)) {
          return {
            ruleId: 'no-left-like',
            ruleName: '避免左模糊查询',
            category: AuditRuleCategory.PERFORMANCE,
            severity: AuditSeverity.WARNING,
            message: '左模糊查询 (LIKE "%xxx") 无法使用索引，影响查询性能',
            suggestion: '考虑使用全文索引或搜索引擎',
          };
        }
        return null;
      },
    });

    // 6. 子查询嵌套检查
    this.rules.push({
      id: 'limit-subquery-depth',
      name: '限制子查询嵌套深度',
      category: AuditRuleCategory.PERFORMANCE,
      severity: AuditSeverity.WARNING,
      description: '过多子查询嵌套影响可读性和性能',
      enabled: true,
      checker: (sql) => {
        const depth = (sql.match(/SELECT/gi) || []).length;
        if (depth > 3) {
          return {
            ruleId: 'limit-subquery-depth',
            ruleName: '限制子查询嵌套深度',
            category: AuditRuleCategory.PERFORMANCE,
            severity: AuditSeverity.WARNING,
            message: `查询包含 ${depth} 层 SELECT，建议使用 JOIN 替代深层子查询`,
            suggestion: '将子查询重构为 JOIN 或 CTE',
          };
        }
        return null;
      },
    });

    // 7. 索引命名规范
    this.rules.push({
      id: 'index-naming-convention',
      name: '索引命名规范',
      category: AuditRuleCategory.NAMING,
      severity: AuditSeverity.INFO,
      description: '索引应以 idx_ 或 uk_ 前缀命名',
      enabled: true,
      checker: (sql) => {
        if (/CREATE\s+(UNIQUE\s+)?INDEX\s+/i.test(sql)) {
          const match = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/i);
          if (match && !match[1].startsWith('idx_') && !match[1].startsWith('uk_')) {
            return {
              ruleId: 'index-naming-convention',
              ruleName: '索引命名规范',
              category: AuditRuleCategory.NAMING,
              severity: AuditSeverity.INFO,
              message: `索引名 "${match[1]}" 不符合命名规范`,
              suggestion: '普通索引使用 idx_ 前缀，唯一索引使用 uk_ 前缀',
            };
          }
        }
        return null;
      },
    });

    // 8. 大表 ALTER 检查
    this.rules.push({
      id: 'large-table-alter-warning',
      name: '大表变更警告',
      category: AuditRuleCategory.PERFORMANCE,
      severity: AuditSeverity.WARNING,
      description: 'ALTER TABLE 在大表上可能造成长时间锁表',
      enabled: true,
      checker: (sql) => {
        if (/^\s*ALTER\s+TABLE\s/i.test(sql.trim())) {
          return {
            ruleId: 'large-table-alter-warning',
            ruleName: '大表变更警告',
            category: AuditRuleCategory.PERFORMANCE,
            severity: AuditSeverity.WARNING,
            message: 'ALTER TABLE 可能导致锁表，建议在低峰期执行或使用 pt-online-schema-change',
            suggestion: '使用在线 DDL 工具如 pt-online-schema-change 或 gh-ost',
          };
        }
        return null;
      },
    });
  }
}
