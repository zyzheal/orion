/**
 * ProviderCircuitBreaker Repository
 *
 * PostgreSQL persistence for ProviderCircuitBreaker states, metrics, and request history.
 */
import { BaseRepository } from '../db/base-repository';

export interface ProviderCBStateEntity {
  id: string;
  provider_id: string;
  state: string;
  failure_count: number;
  success_count: number;
  last_failure_time: Date | null;
  last_success_time: Date | null;
  last_state_change_time: Date;
  half_open_probe_count: number;
  open_start_time: Date | null;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class ProviderCBStateRepository extends BaseRepository<ProviderCBStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_provider_cb_states');
  }

  async findByProviderId(providerId: string): Promise<ProviderCBStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_provider_cb_states WHERE provider_id = $1 LIMIT 1`,
      [providerId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<ProviderCBStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_provider_cb_states ORDER BY provider_id`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByProviderId(data: {
    id: string;
    providerId: string;
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
    lastStateChangeTime: Date;
    halfOpenProbeCount: number;
    openStartTime?: Date;
    tenantId?: string;
  }): Promise<ProviderCBStateEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_provider_cb_states (id, provider_id, state, failure_count, success_count, last_failure_time, last_success_time, last_state_change_time, half_open_probe_count, open_start_time, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (provider_id) DO UPDATE SET
         state = EXCLUDED.state,
         failure_count = EXCLUDED.failure_count,
         success_count = EXCLUDED.success_count,
         last_failure_time = EXCLUDED.last_failure_time,
         last_success_time = EXCLUDED.last_success_time,
         last_state_change_time = EXCLUDED.last_state_change_time,
         half_open_probe_count = EXCLUDED.half_open_probe_count,
         open_start_time = EXCLUDED.open_start_time,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.providerId,
        data.state,
        data.failureCount,
        data.successCount,
        data.lastFailureTime || null,
        data.lastSuccessTime || null,
        data.lastStateChangeTime,
        data.halfOpenProbeCount,
        data.openStartTime || null,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByProviderId(providerId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ai_provider_cb_states WHERE provider_id = $1`,
      [providerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ProviderCBStateEntity {
    return {
      id: row.id,
      provider_id: row.provider_id,
      state: row.state || 'CLOSED',
      failure_count: parseInt(row.failure_count) || 0,
      success_count: parseInt(row.success_count) || 0,
      last_failure_time: row.last_failure_time,
      last_success_time: row.last_success_time,
      last_state_change_time: row.last_state_change_time,
      half_open_probe_count: parseInt(row.half_open_probe_count) || 0,
      open_start_time: row.open_start_time,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

/**
 * ProviderCBMetrics Entity
 */
export interface ProviderCBMetricsEntity {
  id: string;
  provider_id: string;
  total_requests: number;
  failed_requests: number;
  success_requests: number;
  failure_rate: number;
  success_rate: number;
  avg_latency: number;
  p95_latency: number;
  last_failure_time: Date | null;
  last_success_time: Date | null;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class ProviderCBMetricsRepository extends BaseRepository<ProviderCBMetricsEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_provider_cb_metrics');
  }

  async findByProviderId(providerId: string): Promise<ProviderCBMetricsEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_provider_cb_metrics WHERE provider_id = $1 LIMIT 1`,
      [providerId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<ProviderCBMetricsEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_provider_cb_metrics ORDER BY provider_id`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByProviderId(data: {
    id: string;
    providerId: string;
    totalRequests: number;
    failedRequests: number;
    successRequests: number;
    failureRate: number;
    successRate: number;
    avgLatency: number;
    p95Latency: number;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
    tenantId?: string;
  }): Promise<ProviderCBMetricsEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_provider_cb_metrics (id, provider_id, total_requests, failed_requests, success_requests, failure_rate, success_rate, avg_latency, p95_latency, last_failure_time, last_success_time, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (provider_id) DO UPDATE SET
         total_requests = EXCLUDED.total_requests,
         failed_requests = EXCLUDED.failed_requests,
         success_requests = EXCLUDED.success_requests,
         failure_rate = EXCLUDED.failure_rate,
         success_rate = EXCLUDED.success_rate,
         avg_latency = EXCLUDED.avg_latency,
         p95_latency = EXCLUDED.p95_latency,
         last_failure_time = EXCLUDED.last_failure_time,
         last_success_time = EXCLUDED.last_success_time,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.providerId,
        data.totalRequests,
        data.failedRequests,
        data.successRequests,
        data.failureRate,
        data.successRate,
        data.avgLatency,
        data.p95Latency,
        data.lastFailureTime || null,
        data.lastSuccessTime || null,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ProviderCBMetricsEntity {
    return {
      id: row.id,
      provider_id: row.provider_id,
      total_requests: parseInt(row.total_requests) || 0,
      failed_requests: parseInt(row.failed_requests) || 0,
      success_requests: parseInt(row.success_requests) || 0,
      failure_rate: parseFloat(row.failure_rate) || 0,
      success_rate: parseFloat(row.success_rate) || 0,
      avg_latency: parseFloat(row.avg_latency) || 0,
      p95_latency: parseFloat(row.p95_latency) || 0,
      last_failure_time: row.last_failure_time,
      last_success_time: row.last_success_time,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

/**
 * ProviderCBRequestHistory Entity
 */
export interface ProviderCBRequestHistoryEntity {
  id: string;
  provider_id: string;
  success: boolean;
  latency: number;
  request_time: Date;
  tenant_id: string | null;
  created_at: Date;
}

export class ProviderCBRequestHistoryRepository extends BaseRepository<ProviderCBRequestHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_provider_cb_request_history');
  }

  async findByProviderId(providerId: string, limit: number = 100): Promise<ProviderCBRequestHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_provider_cb_request_history WHERE provider_id = $1 ORDER BY request_time DESC LIMIT $2`,
      [providerId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async pruneOldRecords(providerId: string, cutoffTime: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_provider_cb_request_history WHERE provider_id = $1 AND request_time < $2`,
      [providerId, cutoffTime],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ProviderCBRequestHistoryEntity {
    return {
      id: row.id,
      provider_id: row.provider_id,
      success: row.success === true || row.success === 'true',
      latency: parseInt(row.latency) || 0,
      request_time: row.request_time ? new Date(row.request_time) : new Date(),
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
