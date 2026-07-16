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

  async deleteByProviderId(providerId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM auto_recovery_records WHERE provider_id = $1`,
      [providerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getAttemptStats(providerId: string): Promise<{
    attemptCount: number;
    successCount: number;
    failureCount: number;
    lastAttemptAt: Date | null;
    lastSuccessAt: Date | null;
  }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as attempt_count,
        COUNT(*) FILTER (WHERE success = true) as success_count,
        COUNT(*) FILTER (WHERE success = false) as failure_count,
        MAX(attempted_at) as last_attempt_at,
        MAX(CASE WHEN success = true THEN attempted_at END) as last_success_at
       FROM auto_recovery_records WHERE provider_id = $1`,
      [providerId],
    );
    const row = result.rows[0];
    return {
      attemptCount: parseInt(row.attempt_count, 10),
      successCount: parseInt(row.success_count, 10),
      failureCount: parseInt(row.failure_count, 10),
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : null,
      lastSuccessAt: row.last_success_at ? new Date(row.last_success_at) : null,
    };
  }

  async getOverallStats(): Promise<{ totalAttempts: number; totalSuccesses: number }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE success = true) as total_successes
       FROM auto_recovery_records`,
    );
    const row = result.rows[0];
    return {
      totalAttempts: parseInt(row.total_attempts, 10),
      totalSuccesses: parseInt(row.total_successes, 10),
    };
  }

  async getDistinctProviderIds(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT DISTINCT provider_id FROM auto_recovery_records`,
    );
    return result.rows.map((row: any) => row.provider_id);
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
