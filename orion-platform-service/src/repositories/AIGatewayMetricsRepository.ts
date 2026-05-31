/**
 * AIGateway Metrics Repository
 *
 * PostgreSQL persistence for AI Gateway per-scenario metrics.
 */
import { BaseRepository } from '../db/base-repository';

export interface AIGatewayMetricsEntity {
  id: string;
  scenario: string;
  total_requests: number;
  failed_requests: number;
  total_latency: number;
  avg_latency: number;
  p95_latency: number;
  error_rate: number;
  last_error: string | null;
  last_error_time: Date | null;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class AIGatewayMetricsRepository extends BaseRepository<AIGatewayMetricsEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_gateway_metrics');
  }

  async findByScenario(scenario: string): Promise<AIGatewayMetricsEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_gateway_metrics WHERE scenario = $1 LIMIT 1`,
      [scenario],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsertByScenario(data: {
    scenario: string;
    totalRequests: number;
    failedRequests: number;
    totalLatency: number;
    avgLatency: number;
    p95Latency: number;
    errorRate: number;
    lastError?: string;
    lastErrorTime?: Date;
    tenantId?: string;
  }): Promise<AIGatewayMetricsEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_gateway_metrics (id, scenario, total_requests, failed_requests, total_latency, avg_latency, p95_latency, error_rate, last_error, last_error_time, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (scenario) DO UPDATE SET
         total_requests = EXCLUDED.total_requests,
         failed_requests = EXCLUDED.failed_requests,
         total_latency = EXCLUDED.total_latency,
         avg_latency = EXCLUDED.avg_latency,
         p95_latency = EXCLUDED.p95_latency,
         error_rate = EXCLUDED.error_rate,
         last_error = EXCLUDED.last_error,
         last_error_time = EXCLUDED.last_error_time,
         updated_at = NOW()
       RETURNING *`,
      [
        data.scenario,
        data.scenario,
        data.totalRequests,
        data.failedRequests,
        data.totalLatency,
        data.avgLatency,
        data.p95Latency,
        data.errorRate,
        data.lastError || null,
        data.lastErrorTime || null,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<AIGatewayMetricsEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_gateway_metrics ORDER BY scenario`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AIGatewayMetricsEntity {
    return {
      id: row.id,
      scenario: row.scenario,
      total_requests: parseInt(row.total_requests) || 0,
      failed_requests: parseInt(row.failed_requests) || 0,
      total_latency: parseInt(row.total_latency) || 0,
      avg_latency: parseFloat(row.avg_latency) || 0,
      p95_latency: parseFloat(row.p95_latency) || 0,
      error_rate: parseFloat(row.error_rate) || 0,
      last_error: row.last_error,
      last_error_time: row.last_error_time,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
