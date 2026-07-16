/**
 * CommunityRepository — PostgreSQL data access for community contributions, best practices, plugins, and contributors
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

// ============================================================================
// Contribution Entity
// ============================================================================

export interface ContributionEntity {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  repository?: string;
  url?: string;
  tags: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ContributionRepository extends BaseRepository<ContributionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'contributions');
  }

  protected mapRowToEntity(row: any): ContributionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      description: row.description,
      repository: row.repository,
      url: row.url,
      tags: row.tags || [],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listByTenant(tenantId: string, options?: FindAllOptions): Promise<FindAllResult<ContributionEntity>> {
    const where = { ...(options?.where || {}), tenant_id: tenantId };
    return super.findAll({ where, orderBy: options?.orderBy || 'created_at', orderDir: options?.orderDir, limit: options?.limit ?? 20, offset: options?.offset ?? 0 });
  }

  async listByType(tenantId: string, type: string): Promise<ContributionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM contributions WHERE tenant_id = $1 AND type = $2 ORDER BY created_at DESC',
      [tenantId, type],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByUserId(tenantId: string, userId: string): Promise<ContributionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM contributions WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [tenantId, userId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByTags(tenantId: string, tagFilters: string[]): Promise<ContributionEntity[]> {
    const placeholders = tagFilters.map((_, i) => `$${i + 2}`).join(', ');
    const result = await this.db.query(
      `SELECT * FROM contributions WHERE tenant_id = $1 AND tags @> ARRAY[${placeholders}]::varchar[] ORDER BY created_at DESC`,
      [tenantId, ...tagFilters],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async countByUserId(tenantId: string, userId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) AS cnt FROM contributions WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }
}

// ============================================================================
// BestPractice Entity
// ============================================================================

export interface BestPracticeEntity {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  content: string;
  authorId: string;
  authorName: string;
  status: string;
  votes: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BestPracticeRepository extends BaseRepository<BestPracticeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'best_practices');
  }

  protected mapRowToEntity(row: any): BestPracticeEntity {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      tags: row.tags || [],
      content: row.content,
      authorId: row.author_id,
      authorName: row.author_name,
      status: row.status,
      votes: row.votes,
      views: row.views,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listByCategory(category: string): Promise<BestPracticeEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM best_practices WHERE category = $1 ORDER BY votes DESC',
      [category],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByStatus(status: string): Promise<BestPracticeEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM best_practices WHERE status = $1 ORDER BY votes DESC',
      [status],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByAuthor(authorId: string): Promise<BestPracticeEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM best_practices WHERE author_id = $1 ORDER BY votes DESC',
      [authorId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async search(query: string): Promise<BestPracticeEntity[]> {
    const searchTerms = `%${query.toLowerCase()}%`;
    const result = await this.db.query(
      `SELECT * FROM best_practices
       WHERE title ILIKE $1 OR description ILIKE $1 OR tags::text ILIKE $1
       ORDER BY votes DESC`,
      [searchTerms],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByTags(tagFilters: string[]): Promise<BestPracticeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM best_practices WHERE tags @> ARRAY[$1]::varchar[] ORDER BY votes DESC`,
      [tagFilters[0]],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async incrementViews(id: string): Promise<BestPracticeEntity | null> {
    const result = await this.db.query(
      `UPDATE best_practices SET views = views + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async incrementVotes(id: string, delta: number): Promise<BestPracticeEntity | null> {
    const result = await this.db.query(
      `UPDATE best_practices SET votes = votes + $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [delta, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}

// ============================================================================
// CommunityPlugin Entity
// ============================================================================

export interface CommunityPluginEntity {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  repository: string;
  compatibility: string[];
  status: string;
  reviewComment?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

export class CommunityPluginRepository extends BaseRepository<CommunityPluginEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'community_plugins');
  }

  protected mapRowToEntity(row: any): CommunityPluginEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      version: row.version,
      description: row.description,
      author: row.author,
      category: row.category,
      repository: row.repository,
      compatibility: row.compatibility || [],
      status: row.status,
      reviewComment: row.review_comment,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
    };
  }

  async listByCategory(category: string): Promise<CommunityPluginEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM community_plugins WHERE category = $1 ORDER BY submitted_at DESC',
      [category],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByStatus(status: string): Promise<CommunityPluginEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM community_plugins WHERE status = $1 ORDER BY submitted_at DESC',
      [status],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByAuthor(author: string): Promise<CommunityPluginEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM community_plugins WHERE author = $1 ORDER BY submitted_at DESC',
      [author],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async reviewPlugin(id: string, action: 'approve' | 'reject', comment: string): Promise<CommunityPluginEntity | null> {
    const result = await this.db.query(
      `UPDATE community_plugins
       SET status = $1, review_comment = $2, reviewed_at = NOW()
       WHERE id = $3 RETURNING *`,
      [action, comment, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }
}

// ============================================================================
// Contributor Entity
// ============================================================================

export interface ContributorEntity {
  userId: string;
  username: string;
  contributions: number;
  types: string[];
  joinedAt: Date;
  reputation: number;
  badges?: string[];
}

export class ContributorRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async findById(userId: string): Promise<ContributorEntity | undefined> {
    const result = await this.db.query('SELECT * FROM contributors WHERE user_id = $1', [userId]);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async findAll(): Promise<ContributorEntity[]> {
    const result = await this.db.query('SELECT * FROM contributors ORDER BY reputation DESC');
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async upsert(userId: string, data: { username: string; contributions: number; types: string[]; reputation: number }): Promise<void> {
    await this.db.query(
      `INSERT INTO contributors (user_id, username, contributions, types, joined_at, reputation)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (user_id) DO UPDATE
       SET username = $2, contributions = $3, types = $4, reputation = $5`,
      [userId, data.username, data.contributions, JSON.stringify(data.types), data.reputation],
    );
  }

  protected mapRowToEntity(row: any): ContributorEntity {
    return {
      userId: row.user_id,
      username: row.username,
      contributions: row.contributions,
      types: row.types || [],
      joinedAt: row.joined_at,
      reputation: row.reputation,
      badges: row.badges,
    };
  }
}
