import { BaseRepository } from '../db/base-repository';

export interface AlertActiveAlertEntity {
  id: string;
  tenantId: string;
  fingerprint: string;
  name: string;
  severity: string;
  status: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  value: number;
  threshold: number;
  startsAt: Date;
  endsAt: Date | null;
  resolvedAt: Date | null;
  suppressedAt: Date | null;
  suppressedReason: string | null;
  rootCauseAlertId: string | null;
  relatedAlertIds: string[];
  maintenanceWindowId: string | null;
  knownIssueId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AlertActiveAlertRepository extends BaseRepository<AlertActiveAlertEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_active_alerts');
  }

  async findByTenantId(tenantId: string): Promise<AlertActiveAlertEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_active_alerts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySourceId(sourceId: string): Promise<AlertActiveAlertEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_active_alerts WHERE source_id = $1 AND status != 'resolved' ORDER BY created_at DESC`,
      [sourceId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findFiringBySourceType(sourceType: string, severity?: string): Promise<AlertActiveAlertEntity[]> {
    let query = `SELECT * FROM alert_active_alerts WHERE source_type = $1 AND status = 'firing'`;
    const params: any[] = [sourceType];
    if (severity) {
      query += ` AND severity = $2`;
      params.push(severity);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markResolved(id: string): Promise<void> {
    await this.db.query(
      `UPDATE alert_active_alerts SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async deleteResolved(olderThan: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_active_alerts WHERE status = 'resolved' AND resolved_at < $1`,
      [olderThan],
    );
    return result.rowCount ?? 0;
  }

  async countByStatus(tenantId?: string): Promise<{ total: number; firing: number; resolved: number }> {
    let query = `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'firing') as firing,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved
    FROM alert_active_alerts`;
    const params: any[] = [];
    if (tenantId) {
      query += ` WHERE tenant_id = $1`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      firing: parseInt(row.firing, 10),
      resolved: parseInt(row.resolved, 10),
    };
  }

  protected mapRowToEntity(row: any): AlertActiveAlertEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fingerprint: row.fingerprint,
      name: row.name,
      severity: row.severity,
      status: row.status,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceName: row.source_name,
      labels: row.labels || {},
      annotations: row.annotations || {},
      value: row.value,
      threshold: row.threshold,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      resolvedAt: row.resolved_at,
      suppressedAt: row.suppressed_at,
      suppressedReason: row.suppressed_reason,
      rootCauseAlertId: row.root_cause_alert_id,
      relatedAlertIds: row.related_alert_ids || [],
      maintenanceWindowId: row.maintenance_window_id,
      knownIssueId: row.known_issue_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
