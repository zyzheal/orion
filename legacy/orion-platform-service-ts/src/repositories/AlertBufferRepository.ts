import { BaseRepository } from '../db/base-repository';

export interface AlertBufferEntity {
  id: string;
  tenantId: string;
  name: string;
  severity: string;
  source: string;
  service: string;
  environment: string;
  message: string;
  labels: Record<string, string>;
  value: number | null;
  threshold: number | null;
  firedAt: Date;
  createdAt: Date;
}

export class AlertBufferRepository extends BaseRepository<AlertBufferEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_buffer');
  }

  async findByTenantId(tenantId: string): Promise<AlertBufferEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_buffer WHERE tenant_id = $1 ORDER BY fired_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Delete alerts older than cutoff */
  async deleteOlderThan(cutoffMs: number, tenantId?: string): Promise<number> {
    const cutoff = new Date(Date.now() - cutoffMs);
    const result = await this.db.query(
      `DELETE FROM alert_buffer WHERE fired_at < $1${tenantId ? ' AND tenant_id = $2' : ''}`,
      tenantId ? [cutoff, tenantId] : [cutoff],
    );
    return result.rowCount ?? 0;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as cnt FROM alert_buffer WHERE tenant_id = $1`,
      [tenantId],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }

  protected mapRowToEntity(row: any): AlertBufferEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      severity: row.severity,
      source: row.source,
      service: row.service,
      environment: row.environment,
      message: row.message,
      labels: row.labels || {},
      value: row.value ?? null,
      threshold: row.threshold ?? null,
      firedAt: row.fired_at,
      createdAt: row.created_at,
    };
  }
}
