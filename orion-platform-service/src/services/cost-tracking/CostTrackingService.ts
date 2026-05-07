import { DatabasePool } from '../database';
/**
 * Cost Tracking Service - Phase 2
 *
 * Track and analyze CI/CD resource costs
 */

export interface CostRecord {
  id: string;
  tenant_id: string;
  pipeline_id: string | null;
  run_id: string | null;
  resource_type: 'cpu' | 'memory' | 'storage' | 'network' | 'license';
  units: number;
  unit_cost_cents: number;
  total_cost_cents: number;
  period_start: Date;
  period_end: Date;
  created_at: Date;
}

export interface CostSummary {
  tenant_id: string;
  period: string;
  total_cost_cents: number;
  by_resource_type: Record<string, number>;
  by_pipeline: Record<string, number>;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export class CostTrackingService {

  constructor(private pool: DatabasePool) {}

  async recordCost(input: { tenant_id: string; pipeline_id?: string; run_id?: string; resource_type: string; units: number; unit_cost_cents: number }): Promise<CostRecord> {
    const total = input.units * input.unit_cost_cents;
    const result = await this.pool.query(
      `INSERT INTO cost_records 
        (tenant_id, pipeline_id, run_id, resource_type, units, unit_cost_cents, total_cost_cents, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [input.tenant_id, input.pipeline_id || null, input.run_id || null, input.resource_type, input.units, input.unit_cost_cents, total]
    );
    return result.rows[0];
  }

  async getSummary(tenantId: string, period: string): Promise<CostSummary> {
    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'day': startDate = new Date(now.setDate(now.getDate() - 1)); break;
      case 'week': startDate = new Date(now.setDate(now.getDate() - 7)); break;
      case 'month': startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
      default: startDate = new Date(now.setDate(now.getDate() - 30));
    }

    const result = await this.pool.query(
      `SELECT resource_type, SUM(total_cost_cents) as total
       FROM cost_records 
       WHERE tenant_id = $1 AND created_at >= $2
       GROUP BY resource_type`,
      [tenantId, startDate]
    );

    const byResourceType: Record<string, number> = {};
    let total = 0;
    for (const row of result.rows) {
      byResourceType[row.resource_type] = parseInt(row.total);
      total += parseInt(row.total);
    }

    return {
      tenant_id: tenantId,
      period,
      total_cost_cents: total,
      by_resource_type: byResourceType,
      by_pipeline: {},
      trend: 'stable',
    };
  }

  async getPipelineCosts(pipelineId: string): Promise<{ total: number; records: CostRecord[] }> {
    const result = await this.pool.query(
      'SELECT * FROM cost_records WHERE pipeline_id = $1 ORDER BY created_at DESC',
      [pipelineId]
    );
    const total = result.rows.reduce((sum, r) => sum + r.total_cost_cents, 0);
    return { total, records: result.rows };
  }
}