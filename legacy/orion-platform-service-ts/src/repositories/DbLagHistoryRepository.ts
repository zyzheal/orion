import { BaseRepository } from '../db/base-repository';

export interface DbLagHistoryEntity {
  id: string;
  replicaHost: string;
  lagSeconds: number;
  lagLevel: string;
  recordedAt: Date;
  tenantId: string | null;
  createdAt: Date;
}

export class DbLagHistoryRepository extends BaseRepository<DbLagHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_lag_history');
  }

  async findByReplicaHost(replicaHost: string, tenantId?: string, limit: number = 100): Promise<DbLagHistoryEntity[]> {
    let query = `SELECT * FROM db_lag_history WHERE replica_host = $1`;
    const params: any[] = [replicaHost];
    let paramIdx = 2;
    if (tenantId) {
      query += ` AND tenant_id = $${paramIdx}`;
      params.push(tenantId);
      paramIdx++;
    }
    query += ` ORDER BY recorded_at DESC LIMIT $${paramIdx}`;
    params.push(limit);
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async deleteByReplicaHost(replicaHost: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM db_lag_history WHERE replica_host = $1`,
      [replicaHost],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteOlderThan(cutoffTime: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM db_lag_history WHERE recorded_at < $1`,
      [cutoffTime],
    );
    return result.rowCount ?? 0;
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_lag_history`);
  }

  protected mapRowToEntity(row: any): DbLagHistoryEntity {
    return {
      id: row.id,
      replicaHost: row.replica_host,
      lagSeconds: parseFloat(row.lag_seconds),
      lagLevel: row.lag_level,
      recordedAt: row.recorded_at,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
