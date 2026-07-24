import { DatabasePool } from '../database';
/**
 * KnowledgeRepository - Database layer for Knowledge operations (M28)
 *
 * Supports:
 * - kb_spaces: logical grouping of documents
 * - kb_docs: documents within spaces with versioning, tagging, embedding
 * - kb_doc_versions: version history for documents
 */


// ============================================================================
// Space types
// ============================================================================

// Space type: 扩展 'docs' 用于官方文档中心
export type SpaceType = 'public' | 'internal' | 'private' | 'docs';

// Content source: 文档来源 (manual=手动创建, synced=自动同步)
export type ContentSource = 'manual' | 'synced';

export interface KnowledgeSpace {
  id: string;
  tenant_id: string;
  name: string;
  type: SpaceType;
  source?: ContentSource;  // 新增: 文档来源
  owner_id: string;
  team_id: string | null;
  description: string | null;
  doc_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSpaceInput {
  name: string;
  type: SpaceType;
  source?: ContentSource;
  owner_id: string;
  team_id?: string;
  description?: string;
}

export interface UpdateSpaceInput {
  name?: string;
  type?: SpaceType;
  source?: ContentSource;
  team_id?: string;
  description?: string;
}

// ============================================================================
// Document types
// ============================================================================

// Doc type: 区分官方文档 (docs) 和用户知识库 (knowledge)
export type DocType = 'docs' | 'knowledge';

export interface KnowledgeDoc {
  id: string;
  tenant_id: string;
  space_id: string;
  title: string;
  content: string;
  type: string;
  source?: ContentSource;  // 新增: 文档来源
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  version: number;
  author_id: string | null;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDocInput {
  title: string;
  content: string;
  space_id: string;
  type?: string;
  source?: ContentSource;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  author_id?: string;
}

export interface UpdateDocInput {
  title?: string;
  content?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  source?: ContentSource;
}

export interface DocVersion {
  id: string;
  doc_id: string;
  version: number;
  title: string;
  content: string;
  tags: string[];
  created_at: Date;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  space_id: string;
  tags: string[];
  status: string;
}

// ============================================================================
// Repository
// ============================================================================

export class KnowledgeRepository {
  constructor(private pool: DatabasePool) {}

  // ---- Spaces ----

  async createSpace(tenantId: string, input: CreateSpaceInput): Promise<KnowledgeSpace> {
    const result = await this.pool.query(
      `INSERT INTO kb_spaces (tenant_id, name, type, source, owner_id, team_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, input.name, input.type, input.source || 'manual', input.owner_id, input.team_id || null, input.description || null]
    );
    return result.rows[0];
  }

  async findSpaceById(id: string): Promise<KnowledgeSpace | null> {
    return (await this.pool.query('SELECT * FROM kb_spaces WHERE id = $1', [id])).rows[0] || null;
  }

  async findAllSpaces(tenantId: string, params?: { type?: string; source?: string; search?: string; limit?: number; offset?: number }): Promise<KnowledgeSpace[]> {
    let sql = 'SELECT * FROM kb_spaces WHERE tenant_id = $1';
    const values: any[] = [tenantId];
    let idx = 2;

    if (params?.type) {
      sql += ` AND type = $${idx++}`;
      values.push(params.type);
    }
    if (params?.source) {
      sql += ` AND source = $${idx++}`;
      values.push(params.source);
    }
    if (params?.search) {
      sql += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
      values.push(`%${params.search}%`);
      idx++;
    }

    sql += ` ORDER BY created_at DESC`;
    if (params?.limit) {
      sql += ` LIMIT $${idx++}`;
      values.push(params.limit);
    }
    if (params?.offset) {
      sql += ` OFFSET $${idx}`;
      values.push(params.offset);
    }

    return (await this.pool.query(sql, values)).rows;
  }

  async updateSpace(id: string, input: UpdateSpaceInput): Promise<KnowledgeSpace | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.type !== undefined) { fields.push(`type = $${idx++}`); values.push(input.type); }
    if (input.source !== undefined) { fields.push(`source = $${idx++}`); values.push(input.source); }
    if (input.team_id !== undefined) { fields.push(`team_id = $${idx++}`); values.push(input.team_id); }
    if (input.description !== undefined) { fields.push(`description = $${idx++}`); values.push(input.description); }

    if (fields.length === 0) return this.findSpaceById(id);

    fields.push(`updated_at = now()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE kb_spaces SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteSpace(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM kb_spaces WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async incrementSpaceDocCount(spaceId: string, delta: number = 1): Promise<void> {
    await this.pool.query(
      'UPDATE kb_spaces SET doc_count = doc_count + $1, updated_at = now() WHERE id = $2',
      [delta, spaceId]
    );
  }

  // ---- Documents ----

  async createDoc(tenantId: string, input: CreateDocInput): Promise<KnowledgeDoc> {
    return this.pool.transaction(async client => {
      const result = await client.query(
        `INSERT INTO kb_docs (tenant_id, space_id, title, content, type, source, tags, status, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [tenantId, input.space_id, input.title, input.content, input.type || 'knowledge', input.source || 'manual', input.tags || [], input.status || 'draft', input.author_id || null]
      );
      const doc = result.rows[0];

      // Save initial version
      await client.query(
        `INSERT INTO kb_doc_versions (doc_id, version, title, content, tags)
         VALUES ($1, 1, $2, $3, $4)`,
        [doc.id, doc.title, doc.content, doc.tags]
      );

      // Update space doc count
      await client.query(
        'UPDATE kb_spaces SET doc_count = doc_count + 1, updated_at = now() WHERE id = $1',
        [doc.space_id]
      );

      return doc;
    });
  }

  async findDocById(id: string): Promise<KnowledgeDoc | null> {
    return (await this.pool.query('SELECT * FROM kb_docs WHERE id = $1', [id])).rows[0] || null;
  }

  async findAllDocs(tenantId: string, params?: { spaceId?: string; status?: string; tag?: string; search?: string; type?: string; source?: string; limit?: number; offset?: number }): Promise<KnowledgeDoc[]> {
    let sql = 'SELECT * FROM kb_docs WHERE tenant_id = $1';
    const values: any[] = [tenantId];
    let idx = 2;

    if (params?.spaceId) { sql += ` AND space_id = $${idx++}`; values.push(params.spaceId); }
    if (params?.status) { sql += ` AND status = $${idx++}`; values.push(params.status); }
    if (params?.tag) { sql += ` AND $${idx} = ANY(tags)`; values.push(params.tag); idx++; }
    if (params?.type) { sql += ` AND type = $${idx++}`; values.push(params.type); }
    if (params?.source) { sql += ` AND source = $${idx++}`; values.push(params.source); }
    if (params?.search) {
      sql += ` AND (title ILIKE $${idx} OR content ILIKE $${idx})`;
      values.push(`%${params.search}%`);
      idx++;
    }

    sql += ` ORDER BY updated_at DESC`;
    if (params?.limit) { sql += ` LIMIT $${idx++}`; values.push(params.limit); }
    if (params?.offset) { sql += ` OFFSET $${idx}`; values.push(params.offset); }

    return (await this.pool.query(sql, values)).rows;
  }

  async updateDoc(id: string, input: UpdateDocInput): Promise<KnowledgeDoc | null> {
    return this.pool.transaction(async client => {
      const existing = await client.query('SELECT * FROM kb_docs WHERE id = $1', [id]);
      if (existing.rows.length === 0) return null;

      const doc = existing.rows[0];
      const newVersion = doc.version + 1;

      const fields: string[] = [`version = $1`];
      const values: any[] = [newVersion];
      let idx = 2;

      if (input.title !== undefined) { fields.push(`title = $${idx++}`); values.push(input.title); }
      if (input.content !== undefined) { fields.push(`content = $${idx++}`); values.push(input.content); }
      if (input.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(input.tags); }
      if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
      if (input.source !== undefined) { fields.push(`source = $${idx++}`); values.push(input.source); }

      fields.push(`updated_at = now()`);
      values.push(id);

      const result = await client.query(
        `UPDATE kb_docs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      const updated = result.rows[0];

      // Save version
      await client.query(
        `INSERT INTO kb_doc_versions (doc_id, version, title, content, tags)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, newVersion, updated.title, updated.content, updated.tags]
      );

      return updated;
    });
  }

  async deleteDoc(id: string): Promise<boolean> {
    return this.pool.transaction(async client => {
      const existing = await client.query('SELECT space_id FROM kb_docs WHERE id = $1', [id]);
      if (existing.rows.length === 0) return false;

      const spaceId = existing.rows[0].space_id;
      const result = await client.query('DELETE FROM kb_docs WHERE id = $1', [id]);

      if (result.rowCount && result.rowCount > 0) {
        await client.query(
          'UPDATE kb_spaces SET doc_count = GREATEST(doc_count - 1, 0), updated_at = now() WHERE id = $1',
          [spaceId]
        );
        return true;
      }
      return false;
    });
  }

  // ---- Versions ----

  async getDocVersions(docId: string): Promise<DocVersion[]> {
    return (await this.pool.query(
      'SELECT * FROM kb_doc_versions WHERE doc_id = $1 ORDER BY version DESC',
      [docId]
    )).rows;
  }

  // ---- Search (RAG-ready) ----

  async search(tenantId: string, query: string, params?: { spaceId?: string; limit?: number }): Promise<KnowledgeSearchResult[]> {
    const limit = params?.limit || 10;
    let sql = `
      SELECT id, title, content, space_id, tags, status,
        (CASE
          WHEN title ILIKE $2 THEN 0.9
          WHEN content ILIKE $2 THEN 0.5
          ELSE 0.1
        END) as similarity
      FROM kb_docs
      WHERE tenant_id = $1 AND status = 'published' AND (title ILIKE $2 OR content ILIKE $2)
    `;
    const values: any[] = [tenantId, `%${query}%`];

    if (params?.spaceId) {
      sql += ' AND space_id = $3';
      values.push(params.spaceId);
    }

    sql += ` ORDER BY similarity DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    return (await this.pool.query(sql, values)).rows;
  }

  async searchByEmbedding(_tenantId: string, _embedding: number[], _limit: number = 5): Promise<KnowledgeSearchResult[]> {
    // Placeholder for vector similarity search when pgvector is enabled
    // SELECT id, title, content, space_id, tags, status,
    //   (1 - (embedding <=> $1)) as similarity
    // FROM kb_docs WHERE tenant_id = $2 AND status = 'published' AND embedding IS NOT NULL
    // ORDER BY similarity DESC LIMIT $3
    return [];
  }
}
