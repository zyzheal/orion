import { BaseRepository } from '../db/base-repository';

export interface DegradedStateEntity {
  id: string;
  providerId: string;
  degradedAt: Date;
  lastSuccessRate: number | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DegradedStateRepository extends BaseRepository<DegradedStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'auto_recovery_degraded_state');
  }

  async findByProviderId(providerId: string): Promise<DegradedStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM auto_recovery_degraded_state WHERE provider_id = $1`,
      [providerId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsert(providerId: string, degradedAt: Date, successRate?: number, tenantId?: string): Promise<DegradedStateEntity> {
    const result = await this.db.query(
      `INSERT INTO auto_recovery_degraded_state (id, provider_id, degraded_at, last_success_rate, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (provider_id) DO UPDATE SET degraded_at = $3, last_success_rate = $4, updated_at = NOW()
       RETURNING *`,
      [this.generateId(), providerId, degradedAt, successRate ?? null, tenantId ?? '00000000-0000-0000-0000-000000000000'],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async removeByProviderId(providerId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM auto_recovery_degraded_state WHERE provider_id = $1`,
      [providerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAllDegraded(): Promise<DegradedStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM auto_recovery_degraded_state ORDER BY degraded_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DegradedStateEntity {
    return {
      id: row.id,
      providerId: row.provider_id,
      degradedAt: new Date(row.degraded_at),
      lastSuccessRate: row.last_success_rate !== null ? Number(row.last_success_rate) : null,
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
