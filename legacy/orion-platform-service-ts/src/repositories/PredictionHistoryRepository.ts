/**
 * PredictionHistory Repository
 *
 * PostgreSQL persistence for ML prediction history records.
 */
import { BaseRepository } from '../db/base-repository';

export interface PredictionHistoryEntity {
  id: string;
  model_id: string;
  value_json: unknown;
  confidence: number;
  predicted_at: Date;
  input_features: Record<string, number>;
  tenant_id?: string | null;
  created_at: Date;
}

export class PredictionHistoryRepository extends BaseRepository<PredictionHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_prediction_history');
  }

  async findByModel(modelId: string, limit: number = 50): Promise<PredictionHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_prediction_history WHERE model_id = $1 ORDER BY predicted_at DESC LIMIT $2`,
      [modelId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByModelCount(modelId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ai_prediction_history WHERE model_id = $1`,
      [modelId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async deleteByModel(modelId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_prediction_history WHERE model_id = $1`,
      [modelId],
    );
    return result.rowCount ?? 0;
  }

  async pruneOldRecords(modelId: string, keepCount: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_prediction_history WHERE id IN (
        SELECT id FROM ai_prediction_history
        WHERE model_id = $1
        ORDER BY predicted_at DESC
        OFFSET $2
      )`,
      [modelId, keepCount],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): PredictionHistoryEntity {
    return {
      id: row.id,
      model_id: row.model_id,
      value_json: typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json,
      confidence: parseFloat(row.confidence),
      predicted_at: row.predicted_at,
      input_features: typeof row.input_features === 'string' ? JSON.parse(row.input_features) : (row.input_features ?? {}),
      tenant_id: row.tenant_id,
      created_at: row.created_at,
    };
  }
}
