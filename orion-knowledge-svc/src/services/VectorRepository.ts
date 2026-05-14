/**
 * VectorRepository - Database layer for vector operations using pgvector
 *
 * Handles embedding storage, vector search, and vector store management.
 */
import { DatabasePool } from '../utils/database';
import {
  VectorEmbedding,
  VectorStore,
  VectorSearchResult,
  VectorStoreConfig,
  VectorStoreStatus,
  DistanceMetric,
} from '../types/vector';

export class VectorRepository {
  private defaultDimension: number;

  constructor(private pool: DatabasePool, defaultDimension?: number) {
    this.defaultDimension = defaultDimension ?? 1536;
  }

  // ==================== Vector Stores ====================

  async createStore(name: string, ownerId: string, config: VectorStoreConfig, description?: string, spaceId?: string): Promise<VectorStore> {
    const result = await this.pool.query(
      `INSERT INTO vector_stores (name, description, owner_id, space_id, status, config)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || null, ownerId, spaceId || null, 'active', JSON.stringify(config)]
    );
    return this.mapStoreRow(result.rows[0]);
  }

  async getStoreById(id: string): Promise<VectorStore | null> {
    const result = await this.pool.query('SELECT * FROM vector_stores WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapStoreRow(result.rows[0]) : null;
  }

  async getStoreByNameAndOwner(name: string, ownerId: string): Promise<VectorStore | null> {
    const result = await this.pool.query(
      'SELECT * FROM vector_stores WHERE name = $1 AND owner_id = $2',
      [name, ownerId]
    );
    return result.rows.length > 0 ? this.mapStoreRow(result.rows[0]) : null;
  }

  async listStores(filter?: { ownerId?: string; spaceId?: string; status?: string }): Promise<VectorStore[]> {
    let sql = 'SELECT * FROM vector_stores WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (filter?.ownerId) {
      sql += ` AND owner_id = $${idx++}`;
      params.push(filter.ownerId);
    }
    if (filter?.spaceId) {
      sql += ` AND space_id = $${idx++}`;
      params.push(filter.spaceId);
    }
    if (filter?.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filter.status);
    }
    sql += ' ORDER BY created_at DESC';

    const result = await this.pool.query(sql, params);
    return result.rows.map((r: Record<string, unknown>) => this.mapStoreRow(r));
  }

  async updateStore(id: string, updates: { name?: string; description?: string; status?: string; config?: Partial<VectorStoreConfig> }): Promise<VectorStore | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.description !== undefined) { sets.push(`description = $${idx++}`); params.push(updates.description); }
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); params.push(updates.status); }
    if (updates.config !== undefined) {
      sets.push(`config = COALESCE(config, '{}'::jsonb) || $${idx++}::jsonb`);
      params.push(JSON.stringify(updates.config));
    }
    sets.push(`updated_at = NOW()`);

    if (sets.length <= 1) return null;

    params.push(id);
    const sql = `UPDATE vector_stores SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows.length > 0 ? this.mapStoreRow(result.rows[0]) : null;
  }

  async deleteStore(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM vector_stores WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async updateStoreVectorCount(id: string, delta: number = 1): Promise<void> {
    await this.pool.query(
      'UPDATE vector_stores SET vector_count = vector_count + $1, updated_at = NOW() WHERE id = $2',
      [delta, id]
    );
  }

  async markStoreIndexed(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE vector_stores SET last_indexed_at = NOW() WHERE id = $1',
      [id]
    );
  }

  // ==================== Vector Embeddings ====================

  async storeVector(storeId: string, refId: string, vector: number[], metadata?: Record<string, unknown>, refType?: string): Promise<VectorEmbedding> {
    const dimension = vector.length;
    // Ensure vector has exactly this.defaultDimension elements (pad or truncate)
    const paddedVector = this.ensureDimension(vector, dimension);

    const result = await this.pool.query(
      `INSERT INTO vector_embeddings (store_id, ref_id, ref_type, vector, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [storeId, refId, refType || 'chunk', paddedVector, JSON.stringify(metadata || {})]
    );

    await this.updateStoreVectorCount(storeId, 1);

    return this.mapEmbeddingRow(result.rows[0]);
  }

  async batchStoreVectors(
    storeId: string,
    refIds: string[],
    vectors: number[][],
    metadataList?: Record<string, unknown>[],
    refType?: string
  ): Promise<VectorEmbedding[]> {
    const results: VectorEmbedding[] = [];

    // Use a transaction for batch inserts
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < refIds.length; i++) {
        const vector = this.ensureDimension(vectors[i], vectors[i].length);
        const meta = metadataList?.[i] || {};
        const result = await client.query(
          `INSERT INTO vector_embeddings (store_id, ref_id, ref_type, vector, metadata)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [storeId, refIds[i], refType || 'chunk', vector, JSON.stringify(meta)]
        );
        results.push(this.mapEmbeddingRow(result.rows[0]));
      }

      await client.query('COMMIT');
      await this.updateStoreVectorCount(storeId, results.length);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return results;
  }

  async getVectorsByRefId(storeId: string, refId: string): Promise<VectorEmbedding[]> {
    const result = await this.pool.query(
      'SELECT * FROM vector_embeddings WHERE store_id = $1 AND ref_id = $2 ORDER BY created_at ASC',
      [storeId, refId]
    );
    return result.rows.map((r) => this.mapEmbeddingRow(r)) as unknown as VectorEmbedding[];
  }

  async deleteVectorsByRefId(refId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM vector_embeddings WHERE ref_id = $1',
      [refId]
    );
    const count = result.rowCount ?? 0;
    return count;
  }

  async deleteVectorsByStoreId(storeId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM vector_embeddings WHERE store_id = $1',
      [storeId]
    );
    return result.rowCount ?? 0;
  }

  // ==================== Embedding (simulated) ====================

  /**
   * Generate an embedding for text.
   * In production, this would call an embedding model (OpenAI, local model, etc.).
   * Here we generate a deterministic hash-based vector for testing/development.
   */
  async embed(text: string): Promise<number[]> {
    // Simple hash-based embedding simulation
    // Produces a consistent vector for the same text
    const dimension = this.defaultDimension;
    const vector = new Float64Array(dimension);
    const seed = this.hashString(text);

    // Use seeded pseudo-random generation
    let state = seed;
    for (let i = 0; i < dimension; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      vector[i] = (state / 0x7fffffff - 0.5) * 2;
    }

    // Normalize to unit vector (cosine similarity compatible)
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimension; i++) {
        vector[i] /= magnitude;
      }
    }

    return Array.from(vector);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  // ==================== Vector Search ====================

  async vectorSearch(storeId: string, queryVector: number[], topK: number = 10, metric?: DistanceMetric): Promise<VectorSearchResult[]> {
    const distanceMetric = metric || 'cosine';
    const paddedVector = this.ensureDimension(queryVector, queryVector.length);
    const vectorStr = `[${paddedVector.join(',')}]`;

    let distanceExpr: string;
    let orderDirection: string;

    switch (distanceMetric) {
      case 'cosine':
        // cosine distance: 1 - cosine similarity, lower is better
        distanceExpr = `vector <=> '${vectorStr}'::vector`;
        orderDirection = 'ASC';
        break;
      case 'euclidean':
        // L2 distance, lower is better
        distanceExpr = `vector <-> '${vectorStr}'::vector`;
        orderDirection = 'ASC';
        break;
      case 'dot_product':
        // Negative dot product for sorting (higher dot product first)
        distanceExpr = `vector <#> '${vectorStr}'::vector`;
        orderDirection = 'ASC';
        break;
      default:
        distanceExpr = `vector <=> '${vectorStr}'::vector`;
        orderDirection = 'ASC';
    }

    const result = await this.pool.query(
      `SELECT id, store_id, ref_id, ref_type, metadata, ${distanceExpr} as distance
       FROM vector_embeddings
       WHERE store_id = $1
       ORDER BY distance ${orderDirection}
       LIMIT $2`,
      [storeId, topK]
    );

    return result.rows.map((row) => ({
      id: row.id as string,
      refId: row.ref_id as string,
      refType: row.ref_type as string,
      score: this.distanceToScore(parseFloat(row.distance), distanceMetric),
      metadata: (row.metadata as Record<string, string | number | boolean>) || {},
    }));
  }

  /**
   * Semantic search: embed query text and perform vector search
   */
  async semanticSearch(
    query: string,
    options?: {
      topK?: number;
      scoreThreshold?: number;
      metadataFilter?: Record<string, unknown>;
    }
  ): Promise<VectorSearchResult[]> {
    const queryVector = await this.embed(query);
    const topK = options?.topK ?? 10;

    // First do a broad search
    const stores = await this.listStores();
    if (stores.length === 0) return [];

    // Search across all active stores
    const allResults: VectorSearchResult[] = [];

    for (const store of stores) {
      if (store.status !== 'active') continue;

      // Check space filter
      if (options?.metadataFilter?.spaceIds) {
        const spaceIds = options.metadataFilter.spaceIds as string[];
        if (spaceIds.length > 0 && !spaceIds.includes(store.spaceId || '')) {
          continue;
        }
      }

      const storeResults = await this.vectorSearch(store.id, queryVector, topK * 2);

      // Apply metadata filters
      const filtered = storeResults.filter((r) => {
        if (!options?.metadataFilter) return true;
        return this.matchesMetadataFilter(r.metadata, options.metadataFilter);
      });

      // Apply score threshold
      const threshold = options?.scoreThreshold ?? 0;
      const scored = filtered.filter((r) => r.score >= threshold);

      allResults.push(...scored);
    }

    // Sort by score and limit
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK);
  }

  async getStoreStats(storeId: string): Promise<{ vectorCount: number; lastIndexedAt?: Date }> {
    const store = await this.getStoreById(storeId);
    if (!store) {
      return { vectorCount: 0 };
    }

    // Verify count
    const countResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM vector_embeddings WHERE store_id = $1',
      [storeId]
    );
    const actualCount = parseInt(countResult.rows[0].count, 10);

    return {
      vectorCount: actualCount,
      lastIndexedAt: store.lastIndexedAt,
    };
  }

  // ==================== Helpers ====================

  private ensureDimension(vector: number[], originalDimension: number): number[] {
    if (originalDimension === this.defaultDimension) {
      return vector;
    }

    if (originalDimension > this.defaultDimension) {
      // Truncate
      return vector.slice(0, this.defaultDimension);
    }

    // Pad with zeros
    const padded = [...vector];
    while (padded.length < this.defaultDimension) {
      padded.push(0);
    }
    return padded;
  }

  private distanceToScore(distance: number, metric: DistanceMetric): number {
    switch (metric) {
      case 'cosine':
        // Cosine distance 0 = perfect match (score 1.0), 2 = opposite (score 0.0)
        return Math.max(0, Math.min(1, 1 - distance / 2));
      case 'euclidean':
        // L2 distance 0 = perfect (score 1.0), higher = worse
        return Math.max(0, 1 / (1 + distance));
      case 'dot_product':
        // Negative dot product, so negate back
        return Math.max(0, Math.min(1, -distance));
      default:
        return Math.max(0, Math.min(1, 1 - distance));
    }
  }

  private matchesMetadataFilter(metadata: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'spaceIds') {
        // Special case: array of space IDs
        const spaceIds = value as string[];
        const metaSpaceId = metadata.spaceId as string;
        if (spaceIds.length > 0 && metaSpaceId && !spaceIds.includes(metaSpaceId)) {
          return false;
        }
        continue;
      }
      if (key === 'tags') {
        // Special case: tag matching
        const filterTags = value as string[];
        const metaTags = metadata.tags as string[];
        if (filterTags.length > 0 && metaTags) {
          const hasMatch = filterTags.some((t) => metaTags.includes(t));
          if (!hasMatch) return false;
        }
        continue;
      }
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private mapStoreRow(row: Record<string, unknown>): VectorStore {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      ownerId: row.owner_id as string,
      spaceId: row.space_id as string | undefined,
      status: row.status as VectorStoreStatus,
      config: (row.config as VectorStoreConfig) || { dimension: this.defaultDimension, metric: 'cosine' },
      vectorCount: row.vector_count as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      lastIndexedAt: row.last_indexed_at as Date | undefined,
    };
  }

  private mapEmbeddingRow(row: Record<string, unknown>): VectorEmbedding {
    return {
      id: row.id as string,
      storeId: row.store_id as string,
      refId: row.ref_id as string,
      refType: row.ref_type as string,
      vector: (row.vector as unknown as number[]) || [],
      metadata: (row.metadata as Record<string, string | number | boolean>) || {},
      createdAt: row.created_at as Date,
    };
  }
}
