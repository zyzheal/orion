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
  HealingStrategy,
  HealingAction,
  HealingDecision,
  KnowledgeBase,
  IncidentSeverity,
  IncidentStatus,
  StrategyType,
  ActionStatus,
  DecisionAction,
} from '../types/selfhealing';

// Database connection pool interface
export interface DatabasePool {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
  connect(): Promise<PoolClient>;
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
    const countQuery = `SELECT COUNT(*) as count FROM selfhealing_incidents WHERE 1=1`;
    const countParams: unknown[] = [];
    let countIndex = 1;

    if (filters.severity) {
      countQuery.replace(` WHERE 1=1`, ` WHERE 1=1`); // keep structure
    }

    return { items, total: items.length };
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

  private mapRowToIncident(row: any): SelfHealingIncident {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity as IncidentSeverity,
      status: row.status as IncidentStatus,
      alertId: row.alert_id,
      source: row.source,
      affectedResources: Array.isArray(row.affected_resources) ? row.affected_resources : JSON.parse(row.affected_resources || '[]'),
      rootCause: row.root_cause,
      strategyId: row.strategy_id,
      decisionId: row.decision_id,
      actionIds: Array.isArray(row.action_ids) ? row.action_ids : JSON.parse(row.action_ids || '[]'),
      triggerSource: row.trigger_source,
      triggeredAt: new Date(row.triggered_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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

  private mapRowToDecision(row: any): HealingDecision {
    return {
      id: row.id,
      incidentId: row.incident_id,
      action: row.action as DecisionAction,
      reasoning: row.reasoning,
      recommendedStrategyId: row.recommended_strategy_id,
      recommendedActionId: row.recommended_action_id,
      confidence: parseFloat(row.confidence),
      autoExecute: row.auto_execute,
      decidedBy: row.decided_by,
      createdAt: new Date(row.created_at),
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

  private mapRowToAction(row: any): HealingAction {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as StrategyType,
      status: row.status as ActionStatus,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters || {},
      targetId: row.target_id,
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      error: row.error,
      actionType: row.action_type,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      incidentId: row.incident_id,
      decisionId: row.decision_id,
      executor: row.executor,
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

  private mapRowToKnowledge(row: any): KnowledgeBase {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      problemPattern: row.problem_pattern,
      solution: row.solution,
      relatedStrategyTypes: typeof row.related_strategy_types === 'string'
        ? JSON.parse(row.related_strategy_types)
        : row.related_strategy_types || [],
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      usageCount: parseInt(row.usage_count, 10) || 0,
      successRate: parseFloat(row.success_rate) || 0,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdBy: row.created_by,
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
