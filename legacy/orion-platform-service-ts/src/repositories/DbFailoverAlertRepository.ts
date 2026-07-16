import { BaseRepository } from '../db/base-repository';

export interface DbFailoverAlertEntity {
  id: string;
  alertTime: Date;
  severity: string;
  degradationLevel: number;
  message: string | null;
  maxLag: number;
  replicas: any[];
  trend: Record<string, any>;
  tenantId: string | null;
  createdAt: Date;
}

export class DbFailoverAlertRepository extends BaseRepository<DbFailoverAlertEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_failover_alerts');
  }

  async findRecent(limit: number = 10, tenantId?: string): Promise<DbFailoverAlertEntity[]> {
    let query = `SELECT * FROM db_failover_alerts WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;
    if (tenantId) {
      query += ` AND tenant_id = $${paramIdx}`;
      params.push(tenantId);
      paramIdx++;
    }
    query += ` ORDER BY alert_time DESC LIMIT $${paramIdx}`;
    params.push(limit);
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_failover_alerts`);
  }

  protected mapRowToEntity(row: any): DbFailoverAlertEntity {
    return {
      id: row.id,
      alertTime: row.alert_time,
      severity: row.severity,
      degradationLevel: parseInt(row.degradation_level, 10),
      message: row.message,
      maxLag: parseFloat(row.max_lag),
      replicas: row.replicas ?? [],
      trend: row.trend ?? {},
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
