/**
 * AI Model Registry Repository
 *
 * PostgreSQL persistence for ML model registry entries (model + version metadata).
 */
import { NotFoundError } from '../errors';
import { BaseRepository } from '../db/base-repository';

export interface AIModelRegistryEntity {
  id: string;
  model_id: string;
  name: string;
  active_version: string | null;
  versions_json: unknown[];
  tenant_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export class AIModelRegistryRepository extends BaseRepository<AIModelRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_model_registry');
  }

  async findByModelId(modelId: string): Promise<AIModelRegistryEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_model_registry WHERE model_id = $1 LIMIT 1`,
      [modelId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateVersions(modelId: string, versionsJson: unknown[], activeVersion?: string): Promise<AIModelRegistryEntity> {
    const result = await this.db.query(
      `UPDATE ai_model_registry SET versions_json = $1, active_version = $2, updated_at = NOW()
       WHERE model_id = $3 RETURNING *`,
      [JSON.stringify(versionsJson), activeVersion ?? null, modelId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('AIModelRegistry', modelId);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<AIModelRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_model_registry ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AIModelRegistryEntity {
    return {
      id: row.id,
      model_id: row.model_id,
      name: row.name,
      active_version: row.active_version,
      versions_json: typeof row.versions_json === 'string' ? JSON.parse(row.versions_json) : (row.versions_json ?? []),
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
