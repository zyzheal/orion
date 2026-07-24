import { BaseRepository } from '../db/base-repository';

export interface AlertCorrelationGroupEntity {
  id: string;
  tenantId: string;
  rootAlert: Record<string, any>;
  correlatedAlerts: Record<string, any>[];
  commonLabels: Record<string, string>;
  category: string;
  severity: string;
  firstFiredAt: Date;
  lastFiredAt: Date;
  totalCount: number;
  uniqueServices: string[];
  recommendedAction: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AlertCorrelationGroupRepository extends BaseRepository<AlertCorrelationGroupEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_correlation_groups');
  }

  async findByTenantId(tenantId: string): Promise<AlertCorrelationGroupEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_correlation_groups WHERE tenant_id = $1 ORDER BY last_fired_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(timeWindowMs: number, tenantId?: string): Promise<AlertCorrelationGroupEntity[]> {
    const cutoff = new Date(Date.now() - timeWindowMs);
    let query = `SELECT * FROM alert_correlation_groups WHERE last_fired_at >= $1`;
    const params: any[] = [cutoff];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY last_fired_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteExpired(timeWindowMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const result = await this.db.query(
      `DELETE FROM alert_correlation_groups WHERE last_fired_at < $1`,
      [cutoff],
    );
    return result.rowCount ?? 0;
  }

  async updateAlerts(id: string, updates: {
    correlatedAlerts?: Record<string, any>[];
    commonLabels?: Record<string, string>;
    lastFiredAt?: Date;
    totalCount?: number;
    uniqueServices?: string[];
    severity?: string;
    recommendedAction?: string;
  }): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.correlatedAlerts !== undefined) {
      setClauses.push(`correlated_alerts = $${idx++}`);
      params.push(JSON.stringify(updates.correlatedAlerts));
    }
    if (updates.commonLabels !== undefined) {
      setClauses.push(`common_labels = $${idx++}`);
      params.push(JSON.stringify(updates.commonLabels));
    }
    if (updates.lastFiredAt !== undefined) {
      setClauses.push(`last_fired_at = $${idx++}`);
      params.push(updates.lastFiredAt);
    }
    if (updates.totalCount !== undefined) {
      setClauses.push(`total_count = $${idx++}`);
      params.push(updates.totalCount);
    }
    if (updates.uniqueServices !== undefined) {
      setClauses.push(`unique_services = $${idx++}`);
      params.push(updates.uniqueServices);
    }
    if (updates.severity !== undefined) {
      setClauses.push(`severity = $${idx++}`);
      params.push(updates.severity);
    }
    if (updates.recommendedAction !== undefined) {
      setClauses.push(`recommended_action = $${idx++}`);
      params.push(updates.recommendedAction);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    await this.db.query(
      `UPDATE alert_correlation_groups SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );
  }

  protected mapRowToEntity(row: any): AlertCorrelationGroupEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      rootAlert: row.root_alert,
      correlatedAlerts: row.correlated_alerts || [],
      commonLabels: row.common_labels || {},
      category: row.category,
      severity: row.severity,
      firstFiredAt: row.first_fired_at,
      lastFiredAt: row.last_fired_at,
      totalCount: row.total_count,
      uniqueServices: row.unique_services || [],
      recommendedAction: row.recommended_action,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
