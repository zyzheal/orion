/**
 * CustomAlertRuleService - 自定义告警规则服务
 *
 * 功能：
 * 1. 创建/更新/删除自定义告警规则
 * 2. 支持阈值（threshold）、趋势（trend）、复合条件（composite）规则
 * 3. 规则评估和触发
 * 4. 告警通知渠道集成
 */

import pino from 'pino';
import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Types ====================

export type RuleType = 'threshold' | 'trend' | 'composite';
export type RuleSeverity = 'critical' | 'warning' | 'info';

export interface ThresholdCondition {
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  threshold: number;
  durationSec?: number; // 持续时间（秒）
}

export interface TrendCondition {
  metric: string;
  direction: 'increasing' | 'decreasing';
  rateOfChange: number; // percentage change
  windowSec: number; // evaluation window
}

export interface CompositeCondition {
  expression: string; // e.g., "rule_a AND rule_b"
  subConditions: (ThresholdCondition | TrendCondition)[];
}

export interface NotificationChannel {
  type: 'email' | 'webhook' | 'slack' | 'dingtalk' | 'feishu';
  target: string;
  template?: string;
}

export interface CustomAlertRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  condition: ThresholdCondition | TrendCondition | CompositeCondition;
  severity: RuleSeverity;
  enabled: boolean;
  notificationChannels?: NotificationChannel[];
  evaluationIntervalSec: number;
  cooldownSec: number;
  lastEvaluatedAt?: Date;
  lastTriggeredAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  ruleType: RuleType;
  condition: ThresholdCondition | TrendCondition | CompositeCondition;
  severity: RuleSeverity;
  notificationChannels?: NotificationChannel[];
  evaluationIntervalSec?: number;
  cooldownSec?: number;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  condition?: ThresholdCondition | TrendCondition | CompositeCondition;
  severity?: RuleSeverity;
  enabled?: boolean;
  notificationChannels?: NotificationChannel[];
  evaluationIntervalSec?: number;
  cooldownSec?: number;
}

export interface RuleFilters {
  ruleType?: RuleType;
  severity?: RuleSeverity;
  enabled?: boolean;
}

// ==================== Rule Templates ====================

export interface AlertRuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  ruleType: RuleType;
  condition: ThresholdCondition | TrendCondition | CompositeCondition;
  severity: RuleSeverity;
  suggestedEvaluationIntervalSec: number;
  suggestedCooldownSec: number;
}

export const ALERT_RULE_TEMPLATES: AlertRuleTemplate[] = [
  {
    id: 'template-cpu-high',
    name: 'CPU 使用率过高',
    description: '当服务 CPU 使用率持续 5 分钟超过 90% 时触发告警',
    category: 'resource',
    ruleType: 'threshold',
    condition: { metric: 'cpu_usage_percent', operator: '>', threshold: 90, durationSec: 300 },
    severity: 'critical',
    suggestedEvaluationIntervalSec: 60,
    suggestedCooldownSec: 300,
  },
  {
    id: 'template-memory-high',
    name: '内存使用率过高',
    description: '当服务内存使用率持续 5 分钟超过 85% 时触发告警',
    category: 'resource',
    ruleType: 'threshold',
    condition: { metric: 'memory_usage_percent', operator: '>', threshold: 85, durationSec: 300 },
    severity: 'critical',
    suggestedEvaluationIntervalSec: 60,
    suggestedCooldownSec: 300,
  },
  {
    id: 'template-error-rate',
    name: '错误率异常',
    description: '当服务 HTTP 5xx 错误率超过 5% 时触发告警',
    category: 'reliability',
    ruleType: 'threshold',
    condition: { metric: 'http_error_rate_5xx', operator: '>', threshold: 5, durationSec: 120 },
    severity: 'critical',
    suggestedEvaluationIntervalSec: 30,
    suggestedCooldownSec: 180,
  },
  {
    id: 'template-latency-high',
    name: '响应延迟过高',
    description: '当服务 P95 延迟超过 2 秒时触发告警',
    category: 'performance',
    ruleType: 'threshold',
    condition: { metric: 'http_latency_p95_ms', operator: '>', threshold: 2000, durationSec: 180 },
    severity: 'warning',
    suggestedEvaluationIntervalSec: 30,
    suggestedCooldownSec: 180,
  },
  {
    id: 'template-cpu-trend',
    name: 'CPU 使用率持续上升',
    description: '当 CPU 使用率在 30 分钟内增长率超过 20% 时触发告警',
    category: 'resource',
    ruleType: 'trend',
    condition: { metric: 'cpu_usage_percent', direction: 'increasing', rateOfChange: 20, windowSec: 1800 },
    severity: 'warning',
    suggestedEvaluationIntervalSec: 120,
    suggestedCooldownSec: 600,
  },
  {
    id: 'template-error-rate-spike',
    name: '错误率突增',
    description: '当错误率在 10 分钟内突增超过 50% 时触发告警',
    category: 'reliability',
    ruleType: 'trend',
    condition: { metric: 'http_error_rate_5xx', direction: 'increasing', rateOfChange: 50, windowSec: 600 },
    severity: 'critical',
    suggestedEvaluationIntervalSec: 60,
    suggestedCooldownSec: 300,
  },
];

export interface EvaluationResult {
  triggered: boolean;
  ruleId: string;
  ruleName: string;
  evaluatedAt: Date;
  currentValue?: number;
  message?: string;
  notificationsSent?: number;
}

// ==================== Entity interface for repository ====================

export interface CustomAlertRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  ruleType: RuleType;
  condition: Record<string, unknown>;
  severity: RuleSeverity;
  enabled: boolean;
  notificationChannels: Record<string, unknown>[] | null;
  evaluationIntervalSec: number;
  cooldownSec: number;
  lastEvaluatedAt: Date | null;
  lastTriggeredAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Repository ====================

export class CustomAlertRuleRepository extends BaseRepository<CustomAlertRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'custom_alert_rules');
  }

  async findByTenantId(tenantId: string, filters?: RuleFilters): Promise<CustomAlertRuleEntity[]> {
    let query = `SELECT * FROM custom_alert_rules WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.ruleType) {
      query += ` AND rule_type = $${paramIndex}`;
      params.push(filters.ruleType);
      paramIndex++;
    }
    if (filters?.severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }
    if (filters?.enabled !== undefined) {
      query += ` AND enabled = $${paramIndex}`;
      params.push(filters.enabled);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<CustomAlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM custom_alert_rules WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findDueForEvaluation(intervalSec: number): Promise<CustomAlertRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM custom_alert_rules
       WHERE enabled = true
       AND (
         last_evaluated_at IS NULL
         OR EXTRACT(EPOCH FROM NOW() - last_evaluated_at) >= $1
       )
       ORDER BY last_evaluated_at ASC NULLS FIRST`,
      [intervalSec],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async updateEvaluationTimestamp(id: string, evaluatedAt: Date, triggered: boolean): Promise<void> {
    if (triggered) {
      await this.db.query(
        `UPDATE custom_alert_rules SET last_evaluated_at = $1, last_triggered_at = $1 WHERE id = $2`,
        [evaluatedAt, id],
      );
    } else {
      await this.db.query(
        `UPDATE custom_alert_rules SET last_evaluated_at = $1 WHERE id = $2`,
        [evaluatedAt, id],
      );
    }
  }

  protected mapRowToEntity(row: any): CustomAlertRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      ruleType: row.rule_type,
      condition: row.condition,
      severity: row.severity,
      enabled: row.enabled,
      notificationChannels: row.notification_channels,
      evaluationIntervalSec: row.evaluation_interval_sec,
      cooldownSec: row.cooldown_sec,
      lastEvaluatedAt: row.last_evaluated_at,
      lastTriggeredAt: row.last_triggered_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== Service ====================

export class CustomAlertRuleService {
  private repository?: CustomAlertRuleRepository;
  private inMemoryRules: Map<string, CustomAlertRule> = new Map();
  private metricValues: Map<string, number> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.repository = new CustomAlertRuleRepository(db);
      logger.info('[CustomAlertRuleService] Database-backed repository initialized');
    } else {
      logger.info('[CustomAlertRuleService] Memory mode initialized');
    }
  }

  /**
   * 创建自定义告警规则
   */
  async createRule(tenantId: string, input: CreateRuleInput, createdBy?: string): Promise<CustomAlertRule> {
    this.validateCondition(input.ruleType, input.condition);

    const rule: CustomAlertRule = {
      id: this.generateId(),
      tenantId,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      condition: input.condition,
      severity: input.severity,
      enabled: true,
      notificationChannels: input.notificationChannels,
      evaluationIntervalSec: input.evaluationIntervalSec ?? 60,
      cooldownSec: input.cooldownSec ?? 300,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.repository) {
      const created = await this.repository.create({
        id: rule.id,
        tenantId: rule.tenantId,
        name: rule.name,
        description: rule.description ?? null,
        ruleType: rule.ruleType,
        condition: rule.condition as unknown as Record<string, unknown>,
        severity: rule.severity,
        enabled: rule.enabled,
        notificationChannels: rule.notificationChannels?.map((c) => c as unknown as Record<string, unknown>) ?? null,
        evaluationIntervalSec: rule.evaluationIntervalSec,
        cooldownSec: rule.cooldownSec,
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        createdBy: rule.createdBy ?? null,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      } as unknown as Omit<CustomAlertRuleEntity, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<CustomAlertRuleEntity, 'id'>>);
      return this.entityToRule(created);
    }

    this.inMemoryRules.set(rule.id, rule);
    logger.info({ ruleId: rule.id, name: rule.name }, '[CustomAlertRuleService] Rule created (memory)');
    return rule;
  }

  /**
   * 获取规则列表
   */
  async getRules(tenantId: string, filters?: RuleFilters): Promise<CustomAlertRule[]> {
    if (this.repository) {
      const entities = await this.repository.findByTenantId(tenantId, filters);
      return entities.map((e) => this.entityToRule(e));
    }

    let rules = Array.from(this.inMemoryRules.values()).filter((r) => r.tenantId === tenantId);
    if (filters?.ruleType) {
      rules = rules.filter((r) => r.ruleType === filters.ruleType);
    }
    if (filters?.severity) {
      rules = rules.filter((r) => r.severity === filters.severity);
    }
    if (filters?.enabled !== undefined) {
      rules = rules.filter((r) => r.enabled === filters.enabled);
    }
    return rules;
  }

  /**
   * 获取单个规则
   */
  async getRuleById(ruleId: string): Promise<CustomAlertRule | undefined> {
    if (this.repository) {
      const entity = await this.repository.findById(ruleId);
      return entity ? this.entityToRule(entity) : undefined;
    }
    return this.inMemoryRules.get(ruleId);
  }

  /**
   * 更新规则
   */
  async updateRule(ruleId: string, input: UpdateRuleInput): Promise<CustomAlertRule | undefined> {
    const existing = await this.getRuleById(ruleId);
    if (!existing) {
      return undefined;
    }

    if (input.condition) {
      this.validateCondition(existing.ruleType, input.condition);
    }

    const updated: CustomAlertRule = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.condition !== undefined && { condition: input.condition }),
      ...(input.severity !== undefined && { severity: input.severity }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.notificationChannels !== undefined && { notificationChannels: input.notificationChannels }),
      ...(input.evaluationIntervalSec !== undefined && { evaluationIntervalSec: input.evaluationIntervalSec }),
      ...(input.cooldownSec !== undefined && { cooldownSec: input.cooldownSec }),
      updatedAt: new Date(),
    };

    if (this.repository) {
      await this.repository.update(ruleId, {
        ...(input.name !== undefined && { name: updated.name }),
        ...(input.description !== undefined && { description: updated.description ?? null }),
        ...(input.condition !== undefined && { condition: updated.condition as unknown as Record<string, unknown> }),
        ...(input.severity !== undefined && { severity: updated.severity }),
        ...(input.enabled !== undefined && { enabled: updated.enabled }),
        ...(input.notificationChannels !== undefined && {
          notification_channels: updated.notificationChannels?.map((c) => c as unknown as Record<string, unknown>) ?? null,
        }),
        ...(input.evaluationIntervalSec !== undefined && { evaluation_interval_sec: updated.evaluationIntervalSec }),
        ...(input.cooldownSec !== undefined && { cooldown_sec: updated.cooldownSec }),
      } as Partial<Omit<CustomAlertRuleEntity, 'id' | 'created_at' | 'updated_at'>>);
    } else {
      this.inMemoryRules.set(ruleId, updated);
    }

    logger.info({ ruleId }, '[CustomAlertRuleService] Rule updated');
    return updated;
  }

  /**
   * 删除规则
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    if (this.repository) {
      return this.repository.delete(ruleId);
    }
    return this.inMemoryRules.delete(ruleId);
  }

  /**
   * 评估规则
   */
  async evaluateRule(ruleId: string, metricValue?: number): Promise<EvaluationResult> {
    const rule = await this.getRuleById(ruleId);
    if (!rule) {
      throw new Error(`Rule '${ruleId}' not found`);
    }

    if (!rule.enabled) {
      return {
        triggered: false,
        ruleId,
        ruleName: rule.name,
        evaluatedAt: new Date(),
        message: 'Rule is disabled',
      };
    }

    // Check cooldown
    if (rule.lastTriggeredAt) {
      const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownSec * 1000);
      if (new Date() < cooldownEnd) {
        return {
          triggered: false,
          ruleId,
          ruleName: rule.name,
          evaluatedAt: new Date(),
          message: 'Rule is in cooldown period',
        };
      }
    }

    const value = metricValue ?? this.metricValues.get((rule.condition as ThresholdCondition).metric ?? 'unknown');
    const evaluatedAt = new Date();
    let triggered = false;
    let message: string | undefined;

    switch (rule.ruleType) {
      case 'threshold': {
        const cond = rule.condition as ThresholdCondition;
        if (value !== undefined) {
          triggered = this.evaluateThreshold(value, cond);
          message = triggered
            ? `Metric '${cond.metric}' (${value}) ${cond.operator} threshold (${cond.threshold})`
            : undefined;
        }
        break;
      }
      case 'trend': {
        const cond = rule.condition as TrendCondition;
        if (value !== undefined) {
          triggered = this.evaluateTrend(value, cond);
          message = triggered
            ? `Metric '${cond.metric}' trend ${cond.direction} with rate ${cond.rateOfChange}%`
            : undefined;
        }
        break;
      }
      case 'composite': {
        const cond = rule.condition as CompositeCondition;
        triggered = this.evaluateComposite(cond);
        message = triggered ? `Composite condition '${cond.expression}' is true` : undefined;
        break;
      }
    }

    // Update evaluation timestamp
    if (this.repository) {
      await this.repository.updateEvaluationTimestamp(ruleId, evaluatedAt, triggered);
    } else {
      rule.lastEvaluatedAt = evaluatedAt;
      if (triggered) {
        rule.lastTriggeredAt = evaluatedAt;
      }
      this.inMemoryRules.set(ruleId, rule);
    }

    let notificationsSent = 0;
    if (triggered && rule.notificationChannels && rule.notificationChannels.length > 0) {
      notificationsSent = await this.sendNotifications(rule, message);
    }

    logger.info(
      { ruleId, triggered, value, notificationsSent },
      '[CustomAlertRuleService] Rule evaluated'
    );

    return {
      triggered,
      ruleId,
      ruleName: rule.name,
      evaluatedAt,
      currentValue: value,
      message,
      notificationsSent,
    };
  }

  /**
   * 获取所有规则模板
   */
  getRuleTemplates(category?: string): AlertRuleTemplate[] {
    if (category) {
      return ALERT_RULE_TEMPLATES.filter((t) => t.category === category);
    }
    return [...ALERT_RULE_TEMPLATES];
  }

  /**
   * 从模板创建规则
   */
  async createRuleFromTemplate(
    tenantId: string,
    templateId: string,
    overrides?: Partial<CreateRuleInput>,
    createdBy?: string,
  ): Promise<CustomAlertRule> {
    const template = ALERT_RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      throw new Error(`Rule template '${templateId}' not found`);
    }

    const input: CreateRuleInput = {
      name: overrides?.name ?? template.name,
      description: overrides?.description ?? template.description,
      ruleType: template.ruleType,
      condition: overrides?.condition ?? template.condition,
      severity: overrides?.severity ?? template.severity,
      notificationChannels: overrides?.notificationChannels,
      evaluationIntervalSec: overrides?.evaluationIntervalSec ?? template.suggestedEvaluationIntervalSec,
      cooldownSec: overrides?.cooldownSec ?? template.suggestedCooldownSec,
    };

    return this.createRule(tenantId, input, createdBy);
  }

  /**
   * 注入指标值（用于测试和外部集成）
   */
  setMetricValue(metric: string, value: number): void {
    this.metricValues.set(metric, value);
  }

  /**
   * 验证条件
   */
  private validateCondition(ruleType: RuleType, condition: unknown): void {
    switch (ruleType) {
      case 'threshold': {
        const cond = condition as ThresholdCondition;
        if (!cond.metric || !cond.operator || cond.threshold === undefined) {
          throw new Error('Threshold condition requires metric, operator, and threshold');
        }
        break;
      }
      case 'trend': {
        const cond = condition as TrendCondition;
        if (!cond.metric || !cond.direction || cond.rateOfChange === undefined || !cond.windowSec) {
          throw new Error('Trend condition requires metric, direction, rateOfChange, and windowSec');
        }
        break;
      }
      case 'composite': {
        const cond = condition as CompositeCondition;
        if (!cond.expression || !cond.subConditions || cond.subConditions.length === 0) {
          throw new Error('Composite condition requires expression and subConditions');
        }
        break;
      }
    }
  }

  /**
   * 评估阈值条件
   */
  private evaluateThreshold(value: number, condition: ThresholdCondition): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold;
      case '>=': return value >= condition.threshold;
      case '<': return value < condition.threshold;
      case '<=': return value <= condition.threshold;
      case '==': return value === condition.threshold;
      case '!=': return value !== condition.threshold;
      default: return false;
    }
  }

  /**
   * 评估趋势条件
   */
  private evaluateTrend(currentValue: number, condition: TrendCondition): boolean {
    // Simplified: check if the value indicates the trend direction
    // In production, this would compare historical data points
    const previousValue = this.metricValues.get(`${condition.metric}:previous`);
    if (previousValue === undefined) {
      return false;
    }

    const changeRate = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;

    if (condition.direction === 'increasing') {
      return changeRate >= condition.rateOfChange;
    }
    return changeRate <= -condition.rateOfChange;
  }

  /**
   * 评估复合条件
   */
  private evaluateComposite(condition: CompositeCondition): boolean {
    let expression = condition.expression;

    // Evaluate each sub-condition and substitute in expression
    condition.subConditions.forEach((sub, index) => {
      const varName = `rule_${index}`;
      let result = false;

      if ('metric' in sub && 'operator' in sub) {
        const thresholdCond = sub as ThresholdCondition;
        const value = this.metricValues.get(thresholdCond.metric);
        if (value !== undefined) {
          result = this.evaluateThreshold(value, thresholdCond);
        }
      } else if ('direction' in sub) {
        const trendCond = sub as TrendCondition;
        const value = this.metricValues.get(trendCond.metric);
        if (value !== undefined) {
          result = this.evaluateTrend(value, trendCond);
        }
      }

      expression = expression.replace(new RegExp(varName, 'g'), String(result));
    });

    // Evaluate boolean expression (simple AND/OR support)
    return this.evaluateBooleanExpression(expression);
  }

  /**
   * 评估布尔表达式（简单 AND/OR）
   */
  private evaluateBooleanExpression(expression: string): boolean {
    // Handle simple boolean expressions: "true AND false OR true"
    const tokens = expression.split(/\s+/);
    let result = tokens[0] === 'true';

    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const value = tokens[i + 1] === 'true';

      if (op === 'AND') {
        result = result && value;
      } else if (op === 'OR') {
        result = result || value;
      }
    }

    return result;
  }

  /**
   * 发送通知
   */
  private async sendNotifications(rule: CustomAlertRule, message?: string): Promise<number> {
    if (!rule.notificationChannels) return 0;

    let sent = 0;
    for (const channel of rule.notificationChannels) {
      try {
        // In production, integrate with actual notification providers
        logger.info(
          { channelType: channel.type, target: channel.target, ruleName: rule.name },
          '[CustomAlertRuleService] Notification sent (simulated)'
        );
        sent++;
      } catch (error) {
        logger.error({ channelType: channel.type, error }, '[CustomAlertRuleService] Failed to send notification');
      }
    }
    return sent;
  }

  private generateId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private entityToRule(entity: CustomAlertRuleEntity): CustomAlertRule {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description ?? undefined,
      ruleType: entity.ruleType,
      condition: entity.condition as unknown as ThresholdCondition | TrendCondition | CompositeCondition,
      severity: entity.severity,
      enabled: entity.enabled,
      notificationChannels: entity.notificationChannels?.map(
        (c) => c as unknown as NotificationChannel
      ),
      evaluationIntervalSec: entity.evaluationIntervalSec,
      cooldownSec: entity.cooldownSec,
      lastEvaluatedAt: entity.lastEvaluatedAt ?? undefined,
      lastTriggeredAt: entity.lastTriggeredAt ?? undefined,
      createdBy: entity.createdBy ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
