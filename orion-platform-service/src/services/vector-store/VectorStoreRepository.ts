/**
 * VectorStoreRepository
 *
 * Two Repository classes for vectorize_rules and vector_collections tables.
 * Uses migration 346 as authoritative schema.
 */

import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

// ==================== VectorizeRule ====================

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

export interface VectorizeRuleFilters {
  enabled?: boolean;
  sourceType?: string;
  limit?: number;
  offset?: number;
}

export class VectorizeRuleRepository extends BaseRepository<VectorizeRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'vectorize_rules');
  }

  /**
   * List rules by tenant with optional filters
   */
  async findByTenant(
    tenantId: string,
    filters: VectorizeRuleFilters = {},
  ): Promise<VectorizeRuleEntity[]> {
    const { enabled, sourceType } = filters;
    let query = `SELECT * FROM vectorize_rules WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (enabled !== undefined) {
      query += ` AND enabled = $${paramIndex}`;
      params.push(enabled);
      paramIndex++;
    }

    if (sourceType) {
      query += ` AND source_type = $${paramIndex}`;
      params.push(sourceType);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Toggle enabled status of a rule
   */
  async toggleEnabled(
    id: string,
    enabled: boolean,
    tenantId: string,
  ): Promise<VectorizeRuleEntity | null> {
    const result = await this.db.query(
      `UPDATE vectorize_rules SET enabled = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [enabled, id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a rule by ID scoped to tenant
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<VectorizeRuleEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM vectorize_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete a rule scoped to tenant
   */
  async deleteByIdAndTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM vectorize_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Create a new rule with tenant context
   */
  async createForTenant(data: Omit<VectorizeRuleEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'lastRun' | 'processedCount'>): Promise<VectorizeRuleEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO vectorize_rules (id, tenant_id, name, source_type, file_types, chunk_size, chunk_overlap, embedding_model, target_collection, enabled)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.sourceType,
        JSON.stringify(data.fileTypes),
        data.chunkSize,
        data.chunkOverlap,
        data.embeddingModel,
        data.targetCollection,
        data.enabled ?? true,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update a rule scoped to tenant
   */
  async updateByIdAndTenant(
    id: string,
    tenantId: string,
    data: Partial<Omit<VectorizeRuleEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<VectorizeRuleEntity | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }
    if (data.sourceType !== undefined) {
      setClauses.push(`source_type = $${paramIndex}`);
      params.push(data.sourceType);
      paramIndex++;
    }
    if (data.fileTypes !== undefined) {
      setClauses.push(`file_types = $${paramIndex}`);
      params.push(JSON.stringify(data.fileTypes));
      paramIndex++;
    }
    if (data.chunkSize !== undefined) {
      setClauses.push(`chunk_size = $${paramIndex}`);
      params.push(data.chunkSize);
      paramIndex++;
    }
    if (data.chunkOverlap !== undefined) {
      setClauses.push(`chunk_overlap = $${paramIndex}`);
      params.push(data.chunkOverlap);
      paramIndex++;
    }
    if (data.embeddingModel !== undefined) {
      setClauses.push(`embedding_model = $${paramIndex}`);
      params.push(data.embeddingModel);
      paramIndex++;
    }
    if (data.targetCollection !== undefined) {
      setClauses.push(`target_collection = $${paramIndex}`);
      params.push(data.targetCollection);
      paramIndex++;
    }
    if (data.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(data.enabled);
      paramIndex++;
    }

    if (setClauses.length === 0) return null;

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const query = `
      UPDATE vectorize_rules
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
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
      lastRun: row.last_run,
      processedCount: row.processed_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== VectorCollection ====================

export interface VectorCollectionEntity {
  id: string;
  tenantId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  dimensions: number;
  indexType: string;
  distanceMetric: string;
  status: string;
  documentCount: number;
  parameters: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface VectorCollectionFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export class VectorCollectionRepository extends BaseRepository<VectorCollectionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'vector_collections');
  }

  /**
   * List collections by tenant with optional filters
   */
  async findByTenant(
    tenantId: string,
    filters: VectorCollectionFilters = {},
  ): Promise<VectorCollectionEntity[]> {
    const { status } = filters;
    let query = `SELECT * FROM vector_collections WHERE tenant_id = $1`;
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find a collection by ID scoped to tenant
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<VectorCollectionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM vector_collections WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update document count for a collection
   */
  async updateVectorCount(id: string, count: number, tenantId: string): Promise<void> {
    await this.db.query(
      `UPDATE vector_collections SET document_count = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [count, id, tenantId],
    );
  }

  /**
   * Create a new collection with tenant context
   */
  async createForTenant(data: Omit<VectorCollectionEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'documentCount'>): Promise<VectorCollectionEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO vector_collections (id, tenant_id, name, display_name, description, dimensions, index_type, distance_metric, status, parameters)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.displayName ?? null,
        data.description ?? null,
        data.dimensions,
        data.indexType,
        data.distanceMetric,
        data.status ?? 'active',
        JSON.stringify(data.parameters ?? {}),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete a collection scoped to tenant
   */
  async deleteByIdAndTenant(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM vector_collections WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): VectorCollectionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      dimensions: row.dimensions,
      indexType: row.index_type,
      distanceMetric: row.distance_metric,
      status: row.status,
      documentCount: row.document_count,
      parameters: row.parameters ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
