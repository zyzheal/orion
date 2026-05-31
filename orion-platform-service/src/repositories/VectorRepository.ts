/**
 * VectorRepository - PostgreSQL pgvector-backed vector document storage
 *
 * Uses PostgreSQL's pgvector extension for semantic similarity search
 * via cosine distance operator (<=>) and IVFFlat/HNSW indexing.
 */

export interface VectorEntity {
  id: string;
  collection: string;
  content: string;
  contentHash?: string;
  metadata: Record<string, any>;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VectorSearchResult {
  id: string;
  collection: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[] | null;
  score: number;
}

export interface VectorFindOptions {
  collection?: string;
  metadataFilter?: Record<string, any>;
  limit?: number;
}

export class VectorRepository {
  private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.pool = pool;
  }

  /**
   * Insert a vector document
   */
  async insert(entity: any): Promise<VectorEntity> {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.pool.query(
      `INSERT INTO vector_documents (id, collection, content, content_hash, metadata, embedding, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        entity.collection,
        entity.content,
        entity.contentHash,
        JSON.stringify(entity.metadata),
        entity.embedding ? `[${entity.embedding.join(',')}]` : null,
        now,
        now,
      ],
    );

    return { ...entity, id, createdAt: now, updatedAt: now };
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<VectorEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM vector_documents WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) return null;
    return this.rowToEntity(result.rows[0]);
  }

  /**
   * Delete by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM vector_documents WHERE id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete by collection
   */
  async deleteByCollection(collection: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM vector_documents WHERE collection = $1',
      [collection],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Count documents in collection
   */
  async count(collection?: string): Promise<number> {
    if (collection) {
      const result = await this.pool.query(
        'SELECT COUNT(*) FROM vector_documents WHERE collection = $1',
        [collection],
      );
      return parseInt(result.rows[0]?.count ?? '0', 10);
    }
    const result = await this.pool.query('SELECT COUNT(*) FROM vector_documents');
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Similarity search using cosine distance
   * Uses pgvector's <=> operator for cosine distance (1 - cosine_similarity)
   */
  async search(
    queryEmbedding: number[],
    topK: number = 10,
    options?: VectorFindOptions,
  ): Promise<VectorSearchResult[]> {
    const embedding = `[${queryEmbedding.join(',')}]`;
    let query = `
      SELECT *,
        1 - (embedding <=> $1::vector) AS similarity_score
      FROM vector_documents
    `;
    const params: unknown[] = [embedding];
    let paramIndex = 2;

    const conditions: string[] = [];

    if (options?.collection) {
      conditions.push(`collection = $${paramIndex}`);
      params.push(options.collection);
      paramIndex++;
    }

    if (options?.metadataFilter) {
      for (const [key, value] of Object.entries(options.metadataFilter)) {
        conditions.push(`metadata->>'${key}' = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIndex}
    `;
    params.push(topK);

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      collection: row.collection,
      content: row.content,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      embedding: this.parseEmbedding(row.embedding),
      score: parseFloat(row.similarity_score) || 0,
    }));
  }

  /**
   * Update embedding for existing document
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE vector_documents SET embedding = $1, updated_at = $2 WHERE id = $3',
      [`[${embedding.join(',')}]`, new Date(), id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update content and metadata
   */
  async update(id: string, content: string, metadata?: Record<string, any>): Promise<VectorEntity | null> {
    const updates: string[] = ['content = $1', 'updated_at = $2'];
    const params: unknown[] = [content, new Date()];

    if (metadata !== undefined) {
      updates.push(`metadata = $${params.length + 1}`);
      params.push(JSON.stringify(metadata));
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE vector_documents SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    if (!result.rows[0]) return null;
    return this.rowToEntity(result.rows[0]);
  }

  // ==================== Helpers ====================

  private rowToEntity(row: any): VectorEntity {
    return {
      id: row.id,
      collection: row.collection,
      content: row.content,
      contentHash: row.content_hash,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      embedding: this.parseEmbedding(row.embedding),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseEmbedding(value: any): number[] | null {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  }
}
