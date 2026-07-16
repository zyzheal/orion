import { BaseRepository } from '../db/base-repository';

export interface DbRecoveryEventEntity {
  id: string;
  eventTime: Date;
  previousLevel: number;
  newLevel: number;
  recoveryTimeMs: number;
  maxLag: number;
  checksPassed: number;
  message: string | null;
  tenantId: string | null;
  createdAt: Date;
}

export class DbRecoveryEventRepository extends BaseRepository<DbRecoveryEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_recovery_events');
  }

  async findRecent(limit: number = 10, tenantId?: string): Promise<DbRecoveryEventEntity[]> {
    let query = `SELECT * FROM db_recovery_events WHERE 1=1`;
    const params: any[] = [];
    let paramIdx = 1;
    if (tenantId) {
      query += ` AND tenant_id = $${paramIdx}`;
      params.push(tenantId);
      paramIdx++;
    }
    query += ` ORDER BY event_time DESC LIMIT $${paramIdx}`;
    params.push(limit);
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_recovery_events`);
  }

  protected mapRowToEntity(row: any): DbRecoveryEventEntity {
    return {
      id: row.id,
      eventTime: row.event_time,
      previousLevel: parseInt(row.previous_level, 10),
      newLevel: parseInt(row.new_level, 10),
      recoveryTimeMs: parseInt(row.recovery_time_ms, 10),
      maxLag: parseFloat(row.max_lag),
      checksPassed: parseInt(row.checks_passed, 10),
      message: row.message,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
