/**
 * CodeEmbeddingRepository - PostgreSQL pgvector-backed code embedding storage
 *
 * Provides CRUD operations for code_embeddings table with:
 * - Vector similarity search via cosine distance
 * - Project/file/chunk type filtering
 * - Metadata JSONB queries
 */

import {
  CodeEmbedding,
  CodeEmbeddingInput,
  CodeChunkType,
  CodeChunkMetadata,
} from '../services/ai/vector-types';

export interface CodeEmbeddingEntity {
  id: string;
  project_id: string;
  file_path: string;
  chunk_type: string;
  chunk_name: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CodeSearchOptions {
  projectId?: string;
  filePath?: string;
  chunkType?: CodeChunkType[];
  metadataFilter?: Record<string, any>;
  limit?: number;
}

export class CodeEmbeddingRepository {
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
   * Insert a code embedding
   */
  async insert(input: CodeEmbeddingInput): Promise<CodeEmbedding> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO code_embeddings
       (id, project_id, file_path, chunk_type, chunk_name, content, embedding, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.projectId,
        input.filePath,
        input.chunkType,
        input.chunkName,
        input.content,
        input.embedding ? `[${input.embedding.join(',')}]` : null,
        JSON.stringify(input.metadata),
        now,
        now,
      ]
    );

    return {
      id,
      projectId: input.projectId,
      filePath: input.filePath,
      chunkType: input.chunkType,
      chunkName: input.chunkName,
      content: input.content,
      embedding: input.embedding || [],
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<CodeEmbedding | null> {
    const result = await this.pool.query(
      'SELECT * FROM code_embeddings WHERE id = $1',
      [id]
    );
    if (!result.rows[0]) return null;
    return this.rowToEmbedding(result.rows[0]);
  }

  /**
   * Find by project ID
   */
  async findByProject(projectId: string): Promise<CodeEmbedding[]> {
    const result = await this.pool.query(
      'SELECT * FROM code_embeddings WHERE project_id = $1 ORDER BY file_path, chunk_name',
      [projectId]
    );
    return result.rows.map((row) => this.rowToEmbedding(row));
  }

  /**
   * Find by file path
   */
  async findByFilePath(projectId: string, filePath: string): Promise<CodeEmbedding[]> {
    const result = await this.pool.query(
      'SELECT * FROM code_embeddings WHERE project_id = $1 AND file_path = $2 ORDER BY chunk_name',
      [projectId, filePath]
    );
    return result.rows.map((row) => this.rowToEmbedding(row));
  }

  /**
   * Delete by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM code_embeddings WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete by file path (all chunks in a file)
   */
  async deleteByFilePath(projectId: string, filePath: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM code_embeddings WHERE project_id = $1 AND file_path = $2',
      [projectId, filePath]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Delete all embeddings for a project
   */
  async deleteByProject(projectId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM code_embeddings WHERE project_id = $1',
      [projectId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Update embedding for existing document
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE code_embeddings SET embedding = $1, updated_at = $2 WHERE id = $3',
      [`[${embedding.join(',')}]`, new Date(), id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count embeddings
   */
  async count(options?: { projectId?: string; chunkType?: CodeChunkType }): Promise<number> {
    let query = 'SELECT COUNT(*) FROM code_embeddings';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options?.projectId) {
      conditions.push(`project_id = $${params.length + 1}`);
      params.push(options.projectId);
    }

    if (options?.chunkType) {
      conditions.push(`chunk_type = $${params.length + 1}`);
      params.push(options.chunkType);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Similarity search using cosine distance
   * Uses pgvector's <=> operator for cosine distance (1 - cosine_similarity)
   */
  async search(
    queryEmbedding: number[],
    topK: number = 10,
    options?: CodeSearchOptions
  ): Promise<Array<{ embedding: CodeEmbedding; similarity: number }>> {
    const embedding = `[${queryEmbedding.join(',')}]`;
    let query = `
      SELECT *,
        1 - (embedding <=> $1::vector) AS similarity_score
      FROM code_embeddings
    `;
    const params: unknown[] = [embedding];
    let paramIndex = 2;

    const conditions: string[] = [];

    if (options?.projectId) {
      conditions.push(`project_id = $${paramIndex}`);
      params.push(options.projectId);
      paramIndex++;
    }

    if (options?.filePath) {
      conditions.push(`file_path = $${paramIndex}`);
      params.push(options.filePath);
      paramIndex++;
    }

    if (options?.chunkType && options.chunkType.length > 0) {
      conditions.push(`chunk_type = ANY($${paramIndex})`);
      params.push(options.chunkType);
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
    options?: CodeSearchOptions
  ): Promise<CodeEmbedding[]> {
    let query = 'SELECT * FROM code_embeddings WHERE ';
    const params: unknown[] = [];
    const conditions: string[] = [];

    // Search in content or chunk_name
    for (let i = 0; i < keywords.length; i++) {
      conditions.push(
        `(content ILIKE $${params.length + 1} OR chunk_name ILIKE $${params.length + 1})`
      );
      params.push(`%${keywords[i]}%`);
    }

    query += conditions.join(' OR ');

    // Add filters
    if (options?.projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(options.projectId);
    }

    if (options?.chunkType && options.chunkType.length > 0) {
      query += ` AND chunk_type = ANY($${params.length + 1})`;
      params.push(options.chunkType);
    }

    query += ' LIMIT 100';

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.rowToEmbedding(row));
  }

  // ==================== Helpers ====================

  private rowToEmbedding(row: any): CodeEmbedding {
    return {
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      chunkType: row.chunk_type as CodeChunkType,
      chunkName: row.chunk_name,
      content: row.content,
      embedding: this.parseEmbedding(row.embedding),
      metadata: this.parseMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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

  private parseMetadata(value: any): CodeChunkMetadata {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return { language: 'unknown', lineStart: 0, lineEnd: 0 };
      }
    }
    return value || { language: 'unknown', lineStart: 0, lineEnd: 0 };
  }
}