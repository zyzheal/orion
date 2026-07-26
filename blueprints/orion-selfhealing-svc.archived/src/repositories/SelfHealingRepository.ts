/**
 * Orion Self-Healing Service - PostgreSQL Repository
 * 自愈数据存储层
 *
 * Provides PostgreSQL-based storage for incidents, decisions, actions, and knowledge.
 * Replaces the in-memory Map implementation.
 */

import { Pool, PoolClient } from 'pg';
import {
  SelfHealingIncident,
  HealingAction,
  HealingDecision,
  KnowledgeBase,
  IncidentSeverity,
  IncidentStatus,
  ActionStatus,
  DecisionAction,
  StrategyType,
} from '../types/selfhealing';

// Database connection pool interface
export interface DatabasePool {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
  connect(): Promise<PoolClient>;
}

// ============================================================
// Policy Types
// ============================================================

export interface SelfHealingPolicy {
  id: string;
  name: string;
  description: string | null;
  conditionType: string;
  conditionConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  cooldownSeconds: number;
  enabled: boolean;
  priority: number;
  confidence: number;
  maxRetries: number;
  timeoutSeconds: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SelfHealingExecution {
  id: string;
  policyId: string;
  incidentId: string | null;
  target: string;
  status: string;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}

// ============================================================
// SelfHealingIncident Repository
// ============================================================

export class SelfHealingIncidentRepository {
  constructor(private db: DatabasePool) {}

  async create(data: Omit<SelfHealingIncident, 'id'>): Promise<SelfHealingIncident> {
    const id = `incident-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO selfhealing_incidents (
        id, title, description, severity, status, alert_id, source,
        affected_resources, root_cause, strategy_id, decision_id, action_ids,
        trigger_source, triggered_at, resolved_at, tenant_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        id, data.title, data.description, data.severity, data.status,
        data.alertId || null, data.source || null,
        JSON.stringify(data.affectedResources), data.rootCause || null,
        data.strategyId || null, data.decisionId || null,
        JSON.stringify(data.actionIds), data.triggerSource, data.triggeredAt,
        data.resolvedAt || null, data.tenantId, data.createdAt, data.updatedAt,
      ],
    );
    return { ...data, id };
  }

  async findById(id: string): Promise<SelfHealingIncident | null> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_incidents WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToIncident(result.rows[0]);
  }

  async findAll(filters: {
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    tenantId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SelfHealingIncident[]; total: number }> {
    let query = `SELECT * FROM selfhealing_incidents WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }
    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters.tenantId) {
      query += ` AND tenant_id = $${paramIndex++}`;
      params.push(filters.tenantId);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const items = result.rows.map((row) => this.mapRowToIncident(row));

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM selfhealing_incidents WHERE 1=1`;
    const countParams: unknown[] = [];
    let countIndex = 1;

    if (filters.severity) {
      countQuery += ` AND severity = $${countIndex++}`;
      countParams.push(filters.severity);
    }
    if (filters.status) {
      countQuery += ` AND status = $${countIndex++}`;
      countParams.push(filters.status);
    }
    if (filters.tenantId) {
      countQuery += ` AND tenant_id = $${countIndex++}`;
      countParams.push(filters.tenantId);
    }

    const countResult = await this.db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    return { items, total };
  }

  async update(id: string, updates: Partial<SelfHealingIncident>): Promise<SelfHealingIncident | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const updateFields: (keyof SelfHealingIncident)[] = [
      'title', 'description', 'severity', 'status', 'alertId', 'source',
      'affectedResources', 'rootCause', 'strategyId', 'decisionId',
      'actionIds', 'triggerSource', 'triggeredAt', 'resolvedAt',
    ];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        const col = this.camelToSnake(field);
        if (field === 'affectedResources' || field === 'actionIds') {
          fields.push(`${col} = $${index++}`);
          values.push(JSON.stringify(updates[field]));
        } else {
          fields.push(`${col} = $${index++}`);
          values.push(updates[field]);
        }
      }
    }

    fields.push(`updated_at = $${index++}`);
    values.push(new Date());
    values.push(id);

    const query = `UPDATE selfhealing_incidents SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) return null;
    return this.mapRowToIncident(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM selfhealing_incidents WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToIncident(row: Record<string, unknown>): SelfHealingIncident {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      severity: row.severity as IncidentSeverity,
      status: row.status as IncidentStatus,
      alertId: row.alert_id as string | undefined,
      source: row.source as string | undefined,
      affectedResources: Array.isArray(row.affected_resources) ? row.affected_resources : JSON.parse(row.affected_resources as string || '[]'),
      rootCause: row.root_cause as string | undefined,
      strategyId: row.strategy_id as string | undefined,
      decisionId: row.decision_id as string | undefined,
      actionIds: Array.isArray(row.action_ids) ? row.action_ids : JSON.parse(row.action_ids as string || '[]'),
      triggerSource: row.trigger_source as string,
      triggeredAt: new Date(row.triggered_at as string | number | Date),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string | number | Date) : undefined,
      tenantId: row.tenant_id as string,
      createdAt: new Date(row.created_at as string | number | Date),
      updatedAt: new Date(row.updated_at as string | number | Date),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

// ============================================================
// HealingDecision Repository
// ============================================================

export class HealingDecisionRepository {
  constructor(private db: DatabasePool) {}

  async create(data: Omit<HealingDecision, 'id'>): Promise<HealingDecision> {
    const id = `decision-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO selfhealing_decisions (
        id, incident_id, action, reasoning, recommended_strategy_id,
        recommended_action_id, confidence, auto_execute, decided_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id, data.incidentId, data.action, data.reasoning,
        data.recommendedStrategyId || null, data.recommendedActionId || null,
        data.confidence, data.autoExecute, data.decidedBy || null, data.createdAt,
      ],
    );
    return { ...data, id };
  }

  async findById(id: string): Promise<HealingDecision | null> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_decisions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToDecision(result.rows[0]);
  }

  async findByIncidentId(incidentId: string): Promise<HealingDecision[]> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_decisions WHERE incident_id = $1 ORDER BY created_at DESC`,
      [incidentId],
    );
    return result.rows.map((row) => this.mapRowToDecision(row));
  }

  private mapRowToDecision(row: Record<string, unknown>): HealingDecision {
    return {
      id: row.id as string,
      incidentId: row.incident_id as string,
      action: row.action as DecisionAction,
      reasoning: row.reasoning as string,
      recommendedStrategyId: row.recommended_strategy_id as string | undefined,
      recommendedActionId: row.recommended_action_id as string | undefined,
      confidence: parseFloat(row.confidence as string),
      autoExecute: row.auto_execute as boolean,
      decidedBy: row.decided_by as string | undefined,
      createdAt: new Date(row.created_at as string | number | Date),
    };
  }
}

// ============================================================
// HealingAction Repository
// ============================================================

export class HealingActionRepository {
  constructor(private db: DatabasePool) {}

  async create(data: Omit<HealingAction, 'id'>): Promise<HealingAction> {
    const id = `action-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO selfhealing_actions (
        id, name, description, type, status, parameters, target_id,
        output, error, action_type, started_at, completed_at,
        incident_id, decision_id, executor
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, data.name, data.description || null, data.type, data.status,
        JSON.stringify(data.parameters), data.targetId || null,
        data.output ? JSON.stringify(data.output) : null, data.error || null,
        data.actionType || null, data.startedAt, data.completedAt || null,
        data.incidentId, data.decisionId || null, data.executor,
      ],
    );
    return { ...data, id };
  }

  async findById(id: string): Promise<HealingAction | null> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_actions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToAction(result.rows[0]);
  }

  async findByIncidentId(incidentId: string): Promise<HealingAction[]> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_actions WHERE incident_id = $1 ORDER BY started_at DESC`,
      [incidentId],
    );
    return result.rows.map((row) => this.mapRowToAction(row));
  }

  async update(id: string, updates: Partial<HealingAction>): Promise<HealingAction | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const updateFields: (keyof HealingAction)[] = [
      'name', 'description', 'type', 'status', 'parameters', 'targetId',
      'output', 'error', 'actionType', 'startedAt', 'completedAt',
      'incidentId', 'decisionId', 'executor',
    ];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        const col = this.camelToSnake(field);
        if (field === 'parameters' || field === 'output') {
          fields.push(`${col} = $${index++}`);
          values.push(updates[field] ? JSON.stringify(updates[field]) : null);
        } else {
          fields.push(`${col} = $${index++}`);
          values.push(updates[field]);
        }
      }
    }

    values.push(id);

    const query = `UPDATE selfhealing_actions SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) return null;
    return this.mapRowToAction(result.rows[0]);
  }

  private mapRowToAction(row: Record<string, unknown>): HealingAction {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as StrategyType,
      status: row.status as ActionStatus,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters as string) : (row.parameters as Record<string, unknown> | undefined) || {},
      targetId: row.target_id as string | undefined,
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output as string) : row.output) : undefined,
      error: row.error as string | undefined,
      actionType: row.action_type as string | undefined,
      startedAt: new Date(row.started_at as string | number | Date),
      completedAt: row.completed_at ? new Date(row.completed_at as string | number | Date) : undefined,
      incidentId: row.incident_id as string,
      decisionId: row.decision_id as string | undefined,
      executor: row.executor as string,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

// ============================================================
// KnowledgeBase Repository
// ============================================================

export class KnowledgeBaseRepository {
  constructor(private db: DatabasePool) {}

  async create(data: Omit<KnowledgeBase, 'id'>): Promise<KnowledgeBase> {
    const id = `kb-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO selfhealing_knowledge (
        id, title, description, problem_pattern, solution,
        related_strategy_types, tags, usage_count, success_rate,
        last_used_at, created_by, tenant_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id, data.title, data.description, data.problemPattern, data.solution,
        JSON.stringify(data.relatedStrategyTypes), JSON.stringify(data.tags),
        data.usageCount, data.successRate, data.lastUsedAt || null,
        data.createdBy, data.tenantId, data.createdAt, data.updatedAt,
      ],
    );
    return { ...data, id };
  }

  async findById(id: string): Promise<KnowledgeBase | null> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_knowledge WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToKnowledge(result.rows[0]);
  }

  async findAll(filters: { tags?: string[]; problemPattern?: string; tenantId?: string }): Promise<KnowledgeBase[]> {
    let query = `SELECT * FROM selfhealing_knowledge WHERE 1=1`;
    const params: unknown[] = [];
    let index = 1;

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND tags @> $${index++}`;
      params.push(JSON.stringify(filters.tags));
    }
    if (filters.problemPattern) {
      query += ` AND problem_pattern ILIKE $${index++}`;
      params.push(`%${filters.problemPattern}%`);
    }
    if (filters.tenantId) {
      query += ` AND tenant_id = $${index++}`;
      params.push(filters.tenantId);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToKnowledge(row));
  }

  async update(id: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const updateFields: (keyof KnowledgeBase)[] = [
      'title', 'description', 'problemPattern', 'solution',
      'relatedStrategyTypes', 'tags', 'usageCount', 'successRate',
      'lastUsedAt', 'createdBy', 'tenantId',
    ];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        const col = this.camelToSnake(field);
        if (field === 'relatedStrategyTypes' || field === 'tags') {
          fields.push(`${col} = $${index++}`);
          values.push(JSON.stringify(updates[field]));
        } else {
          fields.push(`${col} = $${index++}`);
          values.push(updates[field]);
        }
      }
    }

    fields.push(`updated_at = $${index++}`);
    values.push(new Date());
    values.push(id);

    const query = `UPDATE selfhealing_knowledge SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) return null;
    return this.mapRowToKnowledge(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM selfhealing_knowledge WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async search(query: string): Promise<KnowledgeBase[]> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_knowledge
       WHERE title ILIKE $1 OR problem_pattern ILIKE $1 OR solution ILIKE $1
       ORDER BY usage_count DESC`,
      [`%${query}%`],
    );
    return result.rows.map((row) => this.mapRowToKnowledge(row));
  }

  private mapRowToKnowledge(row: Record<string, unknown>): KnowledgeBase {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      problemPattern: row.problem_pattern as string,
      solution: row.solution as string,
      relatedStrategyTypes: typeof row.related_strategy_types === 'string'
        ? JSON.parse(row.related_strategy_types as string)
        : (row.related_strategy_types as string[]) || [],
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : (row.tags as string[]) || [],
      usageCount: parseInt(row.usage_count as string, 10) || 0,
      successRate: parseFloat(row.success_rate as string) || 0,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string | number | Date) : undefined,
      createdBy: row.created_by as string,
      tenantId: row.tenant_id as string,
      createdAt: new Date(row.created_at as string | number | Date),
      updatedAt: new Date(row.updated_at as string | number | Date),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

// ============================================================
// SelfHealingPolicy Repository
// ============================================================

export class SelfHealingPolicyRepository {
  constructor(private db: DatabasePool) {}

  async create(data: Omit<SelfHealingPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<SelfHealingPolicy> {
    const id = `policy-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO selfhealing_policies (
        id, name, description, condition_type, condition_config,
        action_type, action_config, cooldown_seconds, enabled, priority,
        confidence, max_retries, timeout_seconds, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id, data.name, data.description, data.conditionType, JSON.stringify(data.conditionConfig),
        data.actionType, JSON.stringify(data.actionConfig), data.cooldownSeconds, data.enabled,
        data.priority, data.confidence, data.maxRetries, data.timeoutSeconds, data.tenantId,
      ],
    );
    return { ...data, id, createdAt: new Date(), updatedAt: new Date() };
  }

  async findById(id: string): Promise<SelfHealingPolicy | null> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_policies WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToPolicy(result.rows[0]);
  }

  async findAll(filters?: { enabled?: boolean; conditionType?: string; tenantId?: string }): Promise<SelfHealingPolicy[]> {
    let query = `SELECT * FROM selfhealing_policies WHERE 1=1`;
    const params: unknown[] = [];
    let index = 1;

    if (filters?.enabled !== undefined) {
      query += ` AND enabled = $${index++}`;
      params.push(filters.enabled);
    }
    if (filters?.conditionType) {
      query += ` AND condition_type = $${index++}`;
      params.push(filters.conditionType);
    }
    if (filters?.tenantId) {
      query += ` AND tenant_id = $${index++}`;
      params.push(filters.tenantId);
    }

    query += ` ORDER BY priority ASC, confidence DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToPolicy(row));
  }

  async findMatchingPolicies(incident: SelfHealingIncident): Promise<SelfHealingPolicy[]> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_policies WHERE enabled = true ORDER BY priority ASC, confidence DESC`,
    );

    const policies: SelfHealingPolicy[] = [];
    for (const row of result.rows) {
      const policy = this.mapRowToPolicy(row);
      if (this.evaluatePolicyCondition(policy, incident)) {
        policies.push(policy);
      }
    }
    return policies;
  }

  private evaluatePolicyCondition(policy: SelfHealingPolicy, incident: SelfHealingIncident): boolean {
    const { conditionType, conditionConfig } = policy;

    switch (conditionType) {
      case 'severity': {
        const severities = conditionConfig.severity as string[] | undefined;
        if (severities && severities.length > 0) {
          return severities.includes(incident.severity);
        }
        return true;
      }
      case 'source_match': {
        const pattern = conditionConfig.pattern as string;
        if (pattern && incident.source) {
          const regex = new RegExp(pattern, 'i');
          return regex.test(incident.source) || regex.test(incident.description || '');
        }
        return false;
      }
      case 'metric_threshold': {
        // For metric-based conditions, we'd need actual metrics data
        // This is a placeholder - in real implementation, we'd query metrics service
        return false;
      }
      case 'event_match': {
        const event = conditionConfig.event as string;
        if (event && incident.description) {
          const regex = new RegExp(event, 'i');
          return regex.test(incident.description);
        }
        return false;
      }
      case 'always':
        return true;
      default:
        return false;
    }
  }

  async update(id: string, updates: Partial<SelfHealingPolicy>): Promise<SelfHealingPolicy | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const updateFields: (keyof SelfHealingPolicy)[] = [
      'name', 'description', 'conditionType', 'conditionConfig',
      'actionType', 'actionConfig', 'cooldownSeconds', 'enabled',
      'priority', 'confidence', 'maxRetries', 'timeoutSeconds', 'tenantId',
    ];

    for (const field of updateFields) {
      if (updates[field] !== undefined) {
        const col = this.camelToSnake(field);
        if (field === 'conditionConfig' || field === 'actionConfig') {
          fields.push(`${col} = $${index++}`);
          values.push(JSON.stringify(updates[field]));
        } else {
          fields.push(`${col} = $${index++}`);
          values.push(updates[field]);
        }
      }
    }

    fields.push(`updated_at = $${index++}`);
    values.push(new Date());
    values.push(id);

    const query = `UPDATE selfhealing_policies SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) return null;
    return this.mapRowToPolicy(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM selfhealing_policies WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToPolicy(row: Record<string, unknown>): SelfHealingPolicy {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | null,
      conditionType: row.condition_type as string,
      conditionConfig: typeof row.condition_config === 'string'
        ? JSON.parse(row.condition_config as string)
        : (row.condition_config as Record<string, unknown>),
      actionType: row.action_type as string,
      actionConfig: typeof row.action_config === 'string'
        ? JSON.parse(row.action_config as string)
        : (row.action_config as Record<string, unknown>),
      cooldownSeconds: parseInt(row.cooldown_seconds as string, 10) || 300,
      enabled: row.enabled as boolean,
      priority: parseInt(row.priority as string, 10) || 10,
      confidence: parseFloat(row.confidence as string) || 0.5,
      maxRetries: parseInt(row.max_retries as string, 10) || 3,
      timeoutSeconds: parseInt(row.timeout_seconds as string, 10) || 300,
      tenantId: row.tenant_id as string,
      createdAt: new Date(row.created_at as string | number | Date),
      updatedAt: new Date(row.updated_at as string | number | Date),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

// ============================================================
// SelfHealingExecution Repository
// ============================================================

export class SelfHealingExecutionRepository {
  constructor(private db: DatabasePool) {}

  async create(data: Omit<SelfHealingExecution, 'id' | 'startedAt' | 'completedAt'>): Promise<SelfHealingExecution> {
    const id = `exec-${crypto.randomUUID()}`;
    await this.db.query(
      `INSERT INTO selfhealing_executions (
        id, policy_id, incident_id, target, status, result, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id, data.policyId, data.incidentId, data.target, data.status,
        data.result ? JSON.stringify(data.result) : null, data.errorMessage || null,
      ],
    );
    return { ...data, id, startedAt: new Date(), completedAt: null };
  }

  async findById(id: string): Promise<SelfHealingExecution | null> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_executions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToExecution(result.rows[0]);
  }

  async findByPolicyId(policyId: string): Promise<SelfHealingExecution[]> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_executions WHERE policy_id = $1 ORDER BY started_at DESC`,
      [policyId],
    );
    return result.rows.map((row) => this.mapRowToExecution(row));
  }

  async findByIncidentId(incidentId: string): Promise<SelfHealingExecution[]> {
    const result = await this.db.query(
      `SELECT * FROM selfhealing_executions WHERE incident_id = $1 ORDER BY started_at DESC`,
      [incidentId],
    );
    return result.rows.map((row) => this.mapRowToExecution(row));
  }

  async update(id: string, updates: Partial<SelfHealingExecution>): Promise<SelfHealingExecution | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${index++}`);
      values.push(updates.status);
    }
    if (updates.result !== undefined) {
      fields.push(`result = $${index++}`);
      values.push(updates.result ? JSON.stringify(updates.result) : null);
    }
    if (updates.errorMessage !== undefined) {
      fields.push(`error_message = $${index++}`);
      values.push(updates.errorMessage);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${index++}`);
      values.push(updates.completedAt);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const query = `UPDATE selfhealing_executions SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) return null;
    return this.mapRowToExecution(result.rows[0]);
  }

  async checkCooldown(policyId: string, target: string): Promise<boolean> {
    const policyResult = await this.db.query(
      `SELECT cooldown_seconds FROM selfhealing_policies WHERE id = $1`,
      [policyId],
    );

    if (policyResult.rows.length === 0) return true;

    const cooldownSeconds = parseInt(policyResult.rows[0].cooldown_seconds, 10) || 300;
    const cutoffTime = new Date(Date.now() - cooldownSeconds * 1000);

    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM selfhealing_executions
       WHERE policy_id = $1 AND target = $2 AND status != 'failed'
       AND started_at > $3`,
      [policyId, target, cutoffTime],
    );

    return parseInt(result.rows[0]?.count || '0', 10) === 0;
  }

  private mapRowToExecution(row: Record<string, unknown>): SelfHealingExecution {
    return {
      id: row.id as string,
      policyId: row.policy_id as string,
      incidentId: row.incident_id as string | null,
      target: row.target as string,
      status: row.status as string,
      result: row.result
        ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result as Record<string, unknown>)
        : null,
      errorMessage: row.error_message as string | null,
      startedAt: new Date(row.started_at as string | number | Date),
      completedAt: row.completed_at ? new Date(row.completed_at as string | number | Date) : null,
    };
  }
}
