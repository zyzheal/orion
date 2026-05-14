/**
 * KnowledgeEmbeddingRepository - PostgreSQL pgvector-backed knowledge embedding storage
 *
 * Provides CRUD operations for knowledge_embeddings table with:
 * - Vector similarity search via cosine distance
 * - Document type filtering
 * - Metadata JSONB queries
 */

import {
  KnowledgeEmbedding,
  KnowledgeEmbeddingInput,
  KnowledgeDocType,
  KnowledgeMetadata,
} from '../services/ai/vector-types';

export interface KnowledgeEmbeddingEntity {
  id: string;
  doc_id: string;
  doc_type: string;
  title: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface KnowledgeSearchOptions {
  docId?: string;
  docType?: KnowledgeDocType[];
  metadataFilter?: Record<string, any>;
  limit?: number;
}

export class KnowledgeEmbeddingRepository {
  private pool: {
    query: (
      text: string,
      params?: unknown[]
    ) => Promise<{ rows: any[]; rowCount: number | null }>;
  };

  constructor(pool: {
    query: (
      text: string,
      params?: unknown[]
    ) => Promise<{ rows: any[]; rowCount: number | null }>;
  }) {
    this.pool = pool;
  }

  /**
   * Insert a knowledge embedding
   */
  async insert(input: KnowledgeEmbeddingInput): Promise<KnowledgeEmbedding> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO knowledge_embeddings
       (id, doc_id, doc_type, title, content, embedding, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        input.docId,
        input.docType,
        input.title,
        input.content,
        input.embedding ? `[${input.embedding.join(',')}]` : null,
        JSON.stringify(input.metadata || {}),
        now,
      ]
    );

    return {
      id,
      docId: input.docId || '',
      docType: input.docType,
      title: input.title,
      content: input.content,
      embedding: input.embedding || [],
      vector: input.embedding || input.vector || [],
      metadata: input.metadata || {},
      createdAt: now,
    } as KnowledgeEmbedding;
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<KnowledgeEmbedding | null> {
    const result = await this.pool.query(
      'SELECT * FROM knowledge_embeddings WHERE id = $1',
      [id]
    );
    if (!result.rows[0]) return null;
    return this.rowToEmbedding(result.rows[0]);
  }

  /**
   * Find by document ID (may have multiple chunks)
   */
  async findByDocId(docId: string): Promise<KnowledgeEmbedding[]> {
    const result = await this.pool.query(
      'SELECT * FROM knowledge_embeddings WHERE doc_id = $1 ORDER BY created_at',
      [docId]
    );
    return result.rows.map((row) => this.rowToEmbedding(row));
  }

  /**
   * Find by document type
   */
  async findByDocType(docType: KnowledgeDocType): Promise<KnowledgeEmbedding[]> {
    const result = await this.pool.query(
      'SELECT * FROM knowledge_embeddings WHERE doc_type = $1 ORDER BY created_at DESC',
      [docType]
    );
    return result.rows.map((row) => this.rowToEmbedding(row));
  }

  /**
   * Delete by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM knowledge_embeddings WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all embeddings for a document
   */
  async deleteByDocId(docId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM knowledge_embeddings WHERE doc_id = $1',
      [docId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Update embedding for existing document
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE knowledge_embeddings SET embedding = $1 WHERE id = $2',
      [`[${embedding.join(',')}]`, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count embeddings
   */
  async count(options?: { docType?: KnowledgeDocType }): Promise<number> {
    let query = 'SELECT COUNT(*) FROM knowledge_embeddings';
    const params: unknown[] = [];

    if (options?.docType) {
      query += ' WHERE doc_type = $1';
      params.push(options.docType);
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Similarity search using cosine distance
   */
  async search(
    queryEmbedding: number[],
    topK: number = 10,
    options?: KnowledgeSearchOptions
  ): Promise<Array<{ embedding: KnowledgeEmbedding; similarity: number }>> {
    const embedding = `[${queryEmbedding.join(',')}]`;
    let query = `
      SELECT *,
        1 - (embedding <=> $1::vector) AS similarity_score
      FROM knowledge_embeddings
    `;
    const params: unknown[] = [embedding];
    let paramIndex = 2;

    const conditions: string[] = [];

    if (options?.docId) {
      conditions.push(`doc_id = $${paramIndex}`);
      params.push(options.docId);
      paramIndex++;
    }

    if (options?.docType && options.docType.length > 0) {
      conditions.push(`doc_type = ANY($${paramIndex})`);
      params.push(options.docType);
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
      embedding: this.rowToEmbedding(row),
      similarity: parseFloat(row.similarity_score) || 0,
    }));
  }

  /**
   * Keyword search (for hybrid search)
   */
  async keywordSearch(
    keywords: string[],
    options?: KnowledgeSearchOptions
  ): Promise<KnowledgeEmbedding[]> {
    let query = 'SELECT * FROM knowledge_embeddings WHERE ';
    const params: unknown[] = [];
    const conditions: string[] = [];

    // Search in title or content
    for (let i = 0; i < keywords.length; i++) {
      conditions.push(
        `(title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 1})`
      );
      params.push(`%${keywords[i]}%`);
    }

    query += conditions.join(' OR ');

    // Add filters
    if (options?.docType && options.docType.length > 0) {
      query += ` AND doc_type = ANY($${params.length + 1})`;
      params.push(options.docType);
    }

    query += ' LIMIT 100';

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.rowToEmbedding(row));
  }

  // ==================== Helpers ====================

  private rowToEmbedding(row: any): KnowledgeEmbedding {
    return {
      id: row.id,
      docId: row.doc_id,
      docType: row.doc_type as KnowledgeDocType,
      title: row.title,
      content: row.content,
      embedding: this.parseEmbedding(row.embedding),
      vector: this.parseEmbedding(row.embedding),
      metadata: this.parseMetadata(row.metadata),
      createdAt: row.created_at,
    } as KnowledgeEmbedding;
  }

  private parseEmbedding(value: any): number[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return [];
  }

  private parseMetadata(value: any): KnowledgeMetadata {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value || {};
  }
}