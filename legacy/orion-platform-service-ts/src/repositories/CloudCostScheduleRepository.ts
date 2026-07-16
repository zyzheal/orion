import { BaseRepository } from '../db/base-repository';

export interface CloudCostScheduleEntity {
  id: string;
  tenantId: string | null;
  provider: string;
  cronExpression: string;
  enabled: boolean;
  lastCollectedAt: Date | null;
  lastStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CloudCostScheduleRepository extends BaseRepository<CloudCostScheduleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cloud_cost_schedules');
  }

  async findByProvider(provider: string): Promise<CloudCostScheduleEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cloud_cost_schedules WHERE provider = $1`,
      [provider],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findEnabled(): Promise<CloudCostScheduleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_cost_schedules WHERE enabled = true ORDER BY provider`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateLastCollected(provider: string, status: 'success' | 'failed'): Promise<void> {
    await this.db.query(
      `UPDATE cloud_cost_schedules SET last_collected_at = NOW(), last_status = $1, updated_at = NOW() WHERE provider = $2`,
      [status, provider],
    );
  }

  protected mapRowToEntity(row: any): CloudCostScheduleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      cronExpression: row.cron_expression,
      enabled: row.enabled,
      lastCollectedAt: row.last_collected_at,
      lastStatus: row.last_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
