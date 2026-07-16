import { BaseRepository } from '../db/base-repository';

export interface DbDegradationEventEntity {
  id: string;
  eventTime: Date;
  previousLevel: number;
  newLevel: number;
  triggerType: string;
  maxLag: number;
  averageLag: number;
  affectedReplicas: string[];
  message: string | null;
  tenantId: string | null;
  createdAt: Date;
}

export class DbDegradationEventRepository extends BaseRepository<DbDegradationEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_degradation_events');
  }

  async findRecent(limit: number = 10, tenantId?: string): Promise<DbDegradationEventEntity[]> {
    let query = `SELECT * FROM db_degradation_events WHERE 1=1`;
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
    await this.db.query(`DELETE FROM db_degradation_events`);
  }

  protected mapRowToEntity(row: any): DbDegradationEventEntity {
    return {
      id: row.id,
      eventTime: row.event_time,
      previousLevel: parseInt(row.previous_level, 10),
      newLevel: parseInt(row.new_level, 10),
      triggerType: row.trigger_type,
      maxLag: parseFloat(row.max_lag),
      averageLag: parseFloat(row.average_lag),
      affectedReplicas: row.affected_replicas ?? [],
      message: row.message,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
