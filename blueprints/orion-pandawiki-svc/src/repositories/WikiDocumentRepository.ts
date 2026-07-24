/**
 * WikiDocumentRepository - PostgreSQL data access layer for wiki documents.
 *
 * Maps camelCase entity fields to snake_case DB columns.
 * Uses TEXT[] for tags, full-text search for content queries.
 */

import type { Pool } from 'pg';
import { WikiDocument, WikiSearchResult } from '../types/pandawiki.js';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface CreateWikiDocumentInput {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  parentId?: string;
  tags: string[];
  createdBy: string;
}

export interface UpdateWikiDocumentInput {
  title?: string;
  content?: string;
  parentId?: string | null;
  tags?: string[];
}

export class WikiDocumentRepository {
  constructor(private pool: DbClient) {}

  /**
   * Create a new wiki document.
   */
  async create(input: CreateWikiDocumentInput): Promise<WikiDocument> {
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO wiki_documents (
        id, space_id, title, content, parent_id, tags,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.id,
        input.spaceId,
        input.title,
        input.content,
        input.parentId ?? null,
        input.tags,
        input.createdBy,
        now,
        now,
      ]
    );
    return this.mapRowToDocument(result.rows[0]);
  }

  /**
   * Find a document by ID.
   */
  async findById(id: string): Promise<WikiDocument | null> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_documents WHERE id = $1',
      [id]
    );
    return result.rows.length === 0 ? null : this.mapRowToDocument(result.rows[0]);
  }

  /**
   * Find all documents in a space.
   */
  async findBySpace(spaceId: string): Promise<WikiDocument[]> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_documents WHERE space_id = $1 ORDER BY created_at DESC',
      [spaceId]
    );
    return result.rows.map((row: any) => this.mapRowToDocument(row));
  }

  /**
   * Find child documents of a parent.
   */
  async findByParent(parentId: string): Promise<WikiDocument[]> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_documents WHERE parent_id = $1 ORDER BY created_at ASC',
      [parentId]
    );
    return result.rows.map((row: any) => this.mapRowToDocument(row));
  }

  /**
   * Find documents by creator.
   */
  async findByCreator(createdBy: string): Promise<WikiDocument[]> {
    const result = await this.pool.query(
      'SELECT * FROM wiki_documents WHERE created_by = $1 ORDER BY created_at DESC',
      [createdBy]
    );
    return result.rows.map((row: any) => this.mapRowToDocument(row));
  }

  /**
   * Search documents by title/content using PostgreSQL full-text search.
   */
  async search(query: string, spaceId?: string, limit = 20): Promise<WikiSearchResult[]> {
    const conditions: string[] = [
      `to_tsvector('simple', title || ' ' || content) @@ plainto_tsquery('simple', $${1})`,
    ];
    const params: unknown[] = [query];

    if (spaceId) {
      conditions.push(`space_id = $${params.length + 1}`);
      params.push(spaceId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.pool.query(
      `SELECT id, title,
        LEFT(content, 200) AS excerpt,
        ts_rank(to_tsvector('simple', title || ' ' || content), plainto_tsquery('simple', $1)) AS score,
        space_id
       FROM wiki_documents ${whereClause}
       ORDER BY score DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      score: Number(row.score),
      spaceId: row.space_id,
    }));
  }

  /**
   * Update a document's mutable fields.
   */
  async update(id: string, updates: UpdateWikiDocumentInput): Promise<WikiDocument | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push(`title = $${params.length + 1}`);
      params.push(updates.title);
    }
    if (updates.content !== undefined) {
      setClauses.push(`content = $${params.length + 1}`);
      params.push(updates.content);
    }
    if (updates.parentId !== undefined) {
      setClauses.push(`parent_id = $${params.length + 1}`);
      params.push(updates.parentId);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${params.length + 1}`);
      params.push(updates.tags);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE wiki_documents SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    return result.rows.length === 0 ? null : this.mapRowToDocument(result.rows[0]);
  }

  /**
   * Delete a document.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM wiki_documents WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToDocument(row: any): WikiDocument {
    return {
      id: row.id,
      spaceId: row.space_id,
      title: row.title,
      content: row.content,
      parentId: row.parent_id ?? undefined,
      tags: row.tags ?? [],
      createdBy: row.created_by,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}
