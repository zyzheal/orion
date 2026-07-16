import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface TraceSamplingConfigEntity {
  id: string;
  tenantId: string;
  serviceName: string;
  sampleRate: number;
  maxSpansPerSecond: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TraceSamplingConfigRepository extends BaseRepository<TraceSamplingConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'trace_sampling_config');
  }

  async findByServiceName(tenantId: string, serviceName: string): Promise<TraceSamplingConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM trace_sampling_config WHERE tenant_id = $1 AND service_name = $2`,
      [tenantId, serviceName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<TraceSamplingConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM trace_sampling_config WHERE tenant_id = $1 ORDER BY service_name ASC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertByServiceName(
    tenantId: string,
    serviceName: string,
    data: { sampleRate: number; maxSpansPerSecond?: number; enabled?: boolean },
  ): Promise<TraceSamplingConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO trace_sampling_config (tenant_id, service_name, sample_rate, max_spans_per_second, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, service_name)
       DO UPDATE SET sample_rate = $3, max_spans_per_second = $4, enabled = $5, updated_at = NOW()
       RETURNING *`,
      [tenantId, serviceName, data.sampleRate, data.maxSpansPerSecond ?? 1000, data.enabled ?? true],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): TraceSamplingConfigEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      serviceName: row.service_name,
      sampleRate: parseFloat(row.sample_rate),
      maxSpansPerSecond: row.max_spans_per_second,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
