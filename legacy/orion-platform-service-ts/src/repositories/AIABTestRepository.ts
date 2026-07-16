/**
 * AI A/B Test Repository
 *
 * PostgreSQL persistence for ML A/B test configurations and metrics.
 */
import { NotFoundError } from '../errors';
import { BaseRepository } from '../db/base-repository';

export interface AIABTestEntity {
  id: string;
  name: string;
  model_id: string;
  variant_a: Record<string, unknown>;
  variant_b: Record<string, unknown>;
  status: string;
  started_at?: Date;
  completed_at?: Date | null;
  winner?: string | null;
  metrics: Record<string, unknown>;
  tenant_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export class AIABTestRepository extends BaseRepository<AIABTestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_ab_tests');
  }

  async findByModelId(modelId: string): Promise<AIABTestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_ab_tests WHERE model_id = $1 ORDER BY started_at DESC`,
      [modelId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRunning(): Promise<AIABTestEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_ab_tests WHERE status = 'running' ORDER BY started_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, winner?: string): Promise<AIABTestEntity> {
    let query: string;
    let params: unknown[];
    if (winner) {
      query = `UPDATE ai_ab_tests SET status = $1, winner = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`;
      params = [status, winner, id];
    } else {
      query = `UPDATE ai_ab_tests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      params = [status, id];
    }
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new NotFoundError('AIABTest', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateMetrics(id: string, metrics: Record<string, unknown>): Promise<AIABTestEntity> {
    const result = await this.db.query(
      `UPDATE ai_ab_tests SET metrics = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(metrics), id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('AIABTest', id);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): AIABTestEntity {
    return {
      id: row.id,
      name: row.name,
      model_id: row.model_id,
      variant_a: typeof row.variant_a === 'string' ? JSON.parse(row.variant_a) : (row.variant_a ?? {}),
      variant_b: typeof row.variant_b === 'string' ? JSON.parse(row.variant_b) : (row.variant_b ?? {}),
      status: row.status ?? 'running',
      started_at: row.started_at,
      completed_at: row.completed_at,
      winner: row.winner,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics ?? {}),
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
