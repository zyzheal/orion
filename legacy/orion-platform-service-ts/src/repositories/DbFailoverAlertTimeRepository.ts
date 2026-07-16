import { BaseRepository } from '../db/base-repository';

export interface DbFailoverAlertTimeEntity {
  id: string;
  degradationLevel: number;
  lastAlertTime: Date;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DbFailoverAlertTimeRepository extends BaseRepository<DbFailoverAlertTimeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_failover_alert_times');
  }

  async findByLevel(degradationLevel: number, tenantId?: string): Promise<DbFailoverAlertTimeEntity | undefined> {
    let query = `SELECT * FROM db_failover_alert_times WHERE degradation_level = $1`;
    const params: any[] = [degradationLevel];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsertAlertTime(degradationLevel: number, alertTime: Date, tenantId?: string): Promise<DbFailoverAlertTimeEntity | null> {
    const existing = await this.findByLevel(degradationLevel, tenantId);
    if (existing) {
      return this.update(existing.id, { last_alert_time: alertTime, updated_at: new Date() });
    }
    return this.create({
      id: `fat-${degradationLevel}-${Date.now()}`,
      degradation_level: degradationLevel,
      last_alert_time: alertTime,
      tenant_id: tenantId || null,
    });
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_failover_alert_times`);
  }

  protected mapRowToEntity(row: any): DbFailoverAlertTimeEntity {
    return {
      id: row.id,
      degradationLevel: parseInt(row.degradation_level, 10),
      lastAlertTime: row.last_alert_time,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
