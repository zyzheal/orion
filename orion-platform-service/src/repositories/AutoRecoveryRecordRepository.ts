import { BaseRepository } from '../db/base-repository';

export interface AutoRecoveryRecordEntity {
  id: string;
  providerId: string;
  attemptedAt: Date;
  success: boolean;
  successRate: number | null;
  degradedAt: Date | null;
  recoveredAt: Date | null;
  tenantId: string | null;
  createdAt: Date;
}

export class AutoRecoveryRecordRepository extends BaseRepository<AutoRecoveryRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'auto_recovery_records');
  }

  async findByProviderId(providerId: string, limit: number = 50): Promise<AutoRecoveryRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM auto_recovery_records WHERE provider_id = $1 ORDER BY attempted_at DESC LIMIT $2`,
      [providerId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findDegradedProviders(): Promise<AutoRecoveryRecordEntity[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (provider_id) * FROM auto_recovery_records WHERE recovered_at IS NULL ORDER BY provider_id, attempted_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AutoRecoveryRecordEntity {
    return {
      id: row.id,
      providerId: row.provider_id,
      attemptedAt: row.attempted_at,
      success: row.success,
      successRate: row.success_rate !== null ? Number(row.success_rate) : null,
      degradedAt: row.degraded_at,
      recoveredAt: row.recovered_at,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
