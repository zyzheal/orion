/**
 * AlertRuleRepository — PostgreSQL data access layer for custom alert rules.
 *
 * Handles CRUD operations for alert rules with tenant isolation.
 * Supports condition-based alert evaluation (thresholds, patterns, anomalies).
 */

import type { DatabasePool } from '../services/database/index.js';

export type AlertCondition = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between' | 'anomaly';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  thresholdMax?: number;
  duration: number;
  severity: AlertSeverity;
  enabled: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

interface AlertRuleRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  metric: string;
  condition: AlertCondition;
  threshold: string | number;
  threshold_max: string | number | null;
  duration: number;
  severity: AlertSeverity;
  enabled: boolean;
  labels: string | Record<string, string>;
  annotations: string | Record<string, string>;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Convert a DB row (snake_case) to domain model (camelCase).
 */
function toDomain(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? '',
    metric: row.metric,
    condition: row.condition,
    threshold: typeof row.threshold === 'string' ? parseFloat(row.threshold) : row.threshold,
    thresholdMax: row.threshold_max
      ? (typeof row.threshold_max === 'string' ? parseFloat(row.threshold_max) : row.threshold_max)
      : undefined,
    duration: row.duration,
    severity: row.severity,
    enabled: row.enabled,
    labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : (row.labels ?? {}),
    annotations: typeof row.annotations === 'string' ? JSON.parse(row.annotations) : (row.annotations ?? {}),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

export class AlertRuleRepository {
  private pool: DatabasePool | null = null;

  constructor(pool?: DatabasePool) {
    this.pool = pool ?? null;
  }

  /**
   * Create a new alert rule.
   */
  async create(data: Omit<AlertRule, 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    if (this.pool) {
      const sql = `
        INSERT INTO alert_rules (
          id, tenant_id, name, description, metric, condition,
          threshold, threshold_max, duration, severity, enabled,
          labels, annotations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const rows = await this.pool.query(sql, [
        data.id,
        data.tenantId,
        data.name,
        data.description || null,
        data.metric,
        data.condition,
        data.threshold,
        data.thresholdMax ?? null,
        data.duration,
        data.severity,
        data.enabled,
        JSON.stringify(data.labels),
        JSON.stringify(data.annotations),
      ]);
      return toDomain(rows.rows[0] as unknown as AlertRuleRow);
    }

    // In-memory fallback for tests / dev without DB
    const now = new Date();
    return {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Find all rules for a tenant.
   */
  async findAll(tenantId: string, enabledOnly?: boolean): Promise<AlertRule[]> {
    if (this.pool) {
      let query = 'SELECT * FROM alert_rules WHERE tenant_id = $1';
      const params: unknown[] = [tenantId];
      if (enabledOnly) {
        query += ' AND enabled = true';
      }
      query += ' ORDER BY severity ASC, created_at DESC';
      const rows = await this.pool.query(query, params);
      return rows.rows.map((r) => toDomain(r as unknown as AlertRuleRow));
    }
    return [];
  }

  /**
   * Find a single rule by ID.
   */
  async findById(id: string): Promise<AlertRule | null> {
    if (this.pool) {
      const rows = await this.pool.query('SELECT * FROM alert_rules WHERE id = $1', [id]);
      if (rows.rows.length === 0) return null;
      return toDomain(rows.rows[0] as unknown as AlertRuleRow);
    }
    return null;
  }

  /**
   * Update a rule. Only updates provided fields.
   */
  async update(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    if (!this.pool) return null;

    const existing = await this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.name !== undefined) { fields.push(`name = $${index++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${index++}`); values.push(updates.description); }
    if (updates.metric !== undefined) { fields.push(`metric = $${index++}`); values.push(updates.metric); }
    if (updates.condition !== undefined) { fields.push(`condition = $${index++}`); values.push(updates.condition); }
    if (updates.threshold !== undefined) { fields.push(`threshold = $${index++}`); values.push(updates.threshold); }
    if (updates.thresholdMax !== undefined) { fields.push(`threshold_max = $${index++}`); values.push(updates.thresholdMax); }
    if (updates.duration !== undefined) { fields.push(`duration = $${index++}`); values.push(updates.duration); }
    if (updates.severity !== undefined) { fields.push(`severity = $${index++}`); values.push(updates.severity); }
    if (updates.enabled !== undefined) { fields.push(`enabled = $${index++}`); values.push(updates.enabled); }
    if (updates.labels !== undefined) { fields.push(`labels = $${index++}`); values.push(JSON.stringify(updates.labels)); }
    if (updates.annotations !== undefined) { fields.push(`annotations = $${index++}`); values.push(JSON.stringify(updates.annotations)); }

    if (fields.length === 0) return existing;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const rows = await this.pool.query(
      `UPDATE alert_rules SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
      values,
    );
    if (rows.rows.length === 0) return null;
    return toDomain(rows.rows[0] as unknown as AlertRuleRow);
  }

  /**
   * Delete a rule by ID.
   */
  async delete(id: string): Promise<boolean> {
    if (this.pool) {
      const res = await this.pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    return false;
  }
}
