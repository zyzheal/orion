/**
 * PortalDocumentRepository - 开发者门户文档数据访问层
 *
 * PostgreSQL Repository pattern for portal_documents table.
 * Extends BaseRepository with document-specific query methods.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

export interface PortalDocumentEntity {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  content: string;
  contentFormat: string;
  documentType: string;
  category: string | null;
  tags: string[];
  version: string;
  isPublished: boolean;
  publishedAt: Date | null;
  authorId: string;
  editorId: string | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortalDocumentCreateInput {
  tenantId: string;
  title: string;
  slug: string;
  content: string;
  contentFormat?: string;
  documentType: string;
  category?: string;
  tags?: string[];
  version?: string;
  authorId: string;
  metadata?: Record<string, any>;
}

export interface PortalDocumentUpdateInput {
  title?: string;
  slug?: string;
  content?: string;
  contentFormat?: string;
  documentType?: string;
  category?: string;
  tags?: string[];
  version?: string;
  editorId?: string;
  isPublished?: boolean;
  publishedAt?: Date | null;
  metadata?: Record<string, any>;
}

export interface PortalDocumentListOptions {
  type?: string;
  category?: string;
  tags?: string[];
  published?: boolean;
  tenantId?: string;
  page?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

/** Internal snake_case data for DB operations */
interface PortalDocumentDbRow {
  tenant_id: string;
  title: string;
  slug: string;
  content: string;
  content_format: string;
  document_type: string;
  category: string | null;
  tags: string[];
  version: string;
  is_published: boolean;
  published_at: Date | null;
  author_id: string;
  editor_id: string | null;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  metadata: Record<string, any>;
}

export class PortalDocumentRepository extends BaseRepository<PortalDocumentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'portal_documents');
  }

  // ==================== Override BaseRepository methods to handle camelCase ↔ snake_case ====================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(input: any): Promise<PortalDocumentEntity> {
    const row: Partial<PortalDocumentDbRow> = {
      tenant_id: input.tenantId,
      title: input.title,
      slug: input.slug,
      content: input.content,
      content_format: input.contentFormat ?? 'markdown',
      document_type: input.documentType,
      category: input.category ?? null,
      tags: input.tags ?? [],
      version: input.version ?? '1.0.0',
      is_published: false,
      published_at: null,
      author_id: input.authorId,
      editor_id: null,
      view_count: 0,
      helpful_count: 0,
      not_helpful_count: 0,
      metadata: input.metadata ?? {},
    };

    if (input.id) {
      (row as any).id = input.id;
    }

    const columns = Object.keys(row) as string[];
    const values = Object.values(row);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO portal_documents (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into portal_documents returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: string, data: PortalDocumentUpdateInput): Promise<PortalDocumentEntity> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      params.push(data.title);
      updates.push(`title = $${paramIndex++}`);
    }
    if (data.slug !== undefined) {
      params.push(data.slug);
      updates.push(`slug = $${paramIndex++}`);
    }
    if (data.content !== undefined) {
      params.push(data.content);
      updates.push(`content = $${paramIndex++}`);
    }
    if (data.contentFormat !== undefined) {
      params.push(data.contentFormat);
      updates.push(`content_format = $${paramIndex++}`);
    }
    if (data.documentType !== undefined) {
      params.push(data.documentType);
      updates.push(`document_type = $${paramIndex++}`);
    }
    if (data.category !== undefined) {
      params.push(data.category);
      updates.push(`category = $${paramIndex++}`);
    }
    if (data.tags !== undefined) {
      params.push(data.tags);
      updates.push(`tags = $${paramIndex++}`);
    }
    if (data.version !== undefined) {
      params.push(data.version);
      updates.push(`version = $${paramIndex++}`);
    }
    if (data.editorId !== undefined) {
      params.push(data.editorId);
      updates.push(`editor_id = $${paramIndex++}`);
    }
    if (data.isPublished !== undefined) {
      params.push(data.isPublished);
      updates.push(`is_published = $${paramIndex++}`);
    }
    if (data.publishedAt !== undefined) {
      params.push(data.publishedAt);
      updates.push(`published_at = $${paramIndex++}`);
    }
    if (data.metadata !== undefined) {
      params.push(data.metadata);
      updates.push(`metadata = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Document not found: ${id}`);
      }
      return existing;
    }

    params.push(id);
    const query = `UPDATE portal_documents SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `UPDATE on portal_documents affected no rows (id: ${id})`)
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  // ==================== Custom query methods ====================

  /**
   * Find document by tenant and slug
   */
  async findBySlug(tenantId: string, slug: string): Promise<PortalDocumentEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM portal_documents WHERE tenant_id = $1 AND slug = $2`,
      [tenantId, slug],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all documents with advanced filtering (type, category, tags, published)
   */
  async findAllFiltered(options: PortalDocumentListOptions = {}): Promise<FindAllResult<PortalDocumentEntity>> {
    const {
      type,
      category,
      tags,
      published,
      tenantId,
      orderBy = 'created_at',
      orderDir = 'DESC',
      limit = 20,
      offset = 0,
    } = options;

    const conditions: string[] = [];
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`document_type = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (published !== undefined) {
      params.push(published);
      conditions.push(`is_published = $${params.length}`);
    }
    if (tags && tags.length > 0) {
      params.push(tags);
      conditions.push(`tags && $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `SELECT * FROM portal_documents ${whereClause} ORDER BY ${orderBy} ${orderDir === 'ASC' ? 'ASC' : 'DESC'} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    const countQuery = `SELECT COUNT(*) as count FROM portal_documents ${whereClause}`;
    const countResult = await this.db.query(countQuery, params.slice(0, -2));

    return {
      entities: result.rows.map((row: any) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Full-text search across title, content, and tags
   */
  async search(tenantId: string, query: string, filters?: { type?: string; category?: string }): Promise<PortalDocumentEntity[]> {
    const searchQuery = `%${query}%`;
    const sqlParams: any[] = [tenantId, searchQuery, searchQuery];

    let sql = `SELECT * FROM portal_documents
               WHERE tenant_id = $1
                 AND (title ILIKE $2 OR content ILIKE $3)`;

    if (filters?.type) {
      sqlParams.push(filters.type);
      sql += ` AND document_type = $${sqlParams.length}`;
    }
    if (filters?.category) {
      sqlParams.push(filters.category);
      sql += ` AND category = $${sqlParams.length}`;
    }

    sql += ` AND is_published = true
              ORDER BY view_count DESC, created_at DESC
              LIMIT 50`;

    const result = await this.db.query(sql, sqlParams);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Increment view count for a document
   */
  async incrementViewCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE portal_documents SET view_count = view_count + 1 WHERE id = $1`,
      [id],
    );
  }

  /**
   * Increment helpful or not-helpful count
   */
  async incrementHelpful(id: string, isHelpful: boolean): Promise<void> {
    const column = isHelpful ? 'helpful_count' : 'not_helpful_count';
    await this.db.query(
      `UPDATE portal_documents SET ${column} = ${column} + 1 WHERE id = $1`,
      [id],
    );
  }

  /**
   * Get distinct categories for a tenant
   */
  async getCategories(tenantId: string): Promise<{ category: string; count: number }[]> {
    const result = await this.db.query(
      `SELECT category, COUNT(*) as count
       FROM portal_documents
       WHERE tenant_id = $1 AND category IS NOT NULL AND category != ''
       GROUP BY category
       ORDER BY count DESC`,
      [tenantId],
    );
    return result.rows;
  }

  /**
   * Get popular documents by view count
   */
  async findPopular(tenantId: string, limit: number = 10): Promise<PortalDocumentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM portal_documents
       WHERE tenant_id = $1 AND is_published = true
       ORDER BY view_count DESC, helpful_count DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): PortalDocumentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      contentFormat: row.content_format ?? 'markdown',
      documentType: row.document_type ?? 'guide',
      category: row.category,
      tags: row.tags ?? [],
      version: row.version ?? '1.0.0',
      isPublished: row.is_published ?? false,
      publishedAt: row.published_at,
      authorId: row.author_id,
      editorId: row.editor_id,
      viewCount: row.view_count ?? 0,
      helpfulCount: row.helpful_count ?? 0,
      notHelpfulCount: row.not_helpful_count ?? 0,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
