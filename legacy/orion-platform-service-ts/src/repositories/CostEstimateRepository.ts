import { BaseRepository } from '../db/base-repository';

export interface CostEstimateEntity {
  id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  currency: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

export class CostEstimateRepository extends BaseRepository<CostEstimateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cost_estimates');
  }

  async findByModel(model: string, provider: string): Promise<CostEstimateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cost_estimates WHERE model = $1 AND provider = $2 ORDER BY created_at DESC`,
      [model, provider],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<CostEstimateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cost_estimates WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(limit: number = 50): Promise<CostEstimateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cost_estimates ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByDateRange(dateFrom: string, dateTo: string, tenantId?: string): Promise<CostEstimateEntity[]> {
    let query = `SELECT * FROM cost_estimates WHERE created_at >= $1 AND created_at <= $2`;
    const params: any[] = [dateFrom, dateTo];

    if (tenantId) {
      query += ` AND tenant_id = $3`;
      params.push(tenantId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CostEstimateEntity {
    return {
      id: row.id,
      model: row.model,
      provider: row.provider,
      input_tokens: parseInt(row.input_tokens, 10),
      output_tokens: parseInt(row.output_tokens, 10),
      input_cost: parseFloat(row.input_cost),
      output_cost: parseFloat(row.output_cost),
      total_cost: parseFloat(row.total_cost),
      currency: row.currency,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
