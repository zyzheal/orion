/**
 * Vectorize Rules Repository
 * PostgreSQL persistence for vectorize_rules table (migration 346)
 */

import { BaseRepository } from '../db/base-repository';

export interface VectorizeRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  sourceType: string;
  fileTypes: string[];
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  targetCollection: string;
  enabled: boolean;
  lastRun: Date | null;
  processedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class VectorizeRulesRepository extends BaseRepository<VectorizeRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'vectorize_rules');
  }

  async findByTenant(tenantId: string, limit = 100, offset = 0): Promise<{ entities: VectorizeRuleEntity[]; total: number }> {
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM vectorize_rules WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const result = await this.db.query(
      `SELECT * FROM vectorize_rules WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );

    return { entities: result.rows.map(row => this.mapRowToEntity(row)), total };
  }

  async findEnabled(tenantId: string): Promise<VectorizeRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM vectorize_rules WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<VectorizeRuleEntity | undefined> {
    const result = await this.db.query(
      `UPDATE vectorize_rules SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [enabled, id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateLastRun(id: string, processedCount: number): Promise<void> {
    await this.db.query(
      `UPDATE vectorize_rules SET last_run = NOW(), processed_count = processed_count + $1, updated_at = NOW() WHERE id = $2`,
      [processedCount, id],
    );
  }

  protected mapRowToEntity(row: any): VectorizeRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      sourceType: row.source_type,
      fileTypes: row.file_types ?? [],
      chunkSize: row.chunk_size,
      chunkOverlap: row.chunk_overlap,
      embeddingModel: row.embedding_model,
      targetCollection: row.target_collection,
      enabled: row.enabled,
      lastRun: row.last_run ?? null,
      processedCount: row.processed_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
