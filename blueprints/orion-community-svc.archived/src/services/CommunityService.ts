import { Pool } from 'pg';
import type {
  Contribution,
  ContributionType,
  ContributionStatus,
  PluginStatus,
  ReviewStatus,
  FeedbackSeverity,
  FeedbackStatus,
  CreateContributionInput,
  UpdateContributionInput,
  Plugin,
  SubmitPluginInput,
  Review,
  CreateReviewInput,
  Feedback,
  CreateFeedbackInput,
  PaginationParams,
  PaginatedResponse,
} from '../types/community';

/**
 * CommunityService - 社区生态核心业务逻辑
 * 负责 Contributions, Plugins, Reviews, Feedback 的 CRUD 操作
 */
export class CommunityService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ==================== Contributions ====================

  async createContribution(input: CreateContributionInput): Promise<Contribution> {
    const query = `
      INSERT INTO contributions (author_id, author_name, type, title, description, repository_url, documentation_url, version, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      input.authorId,
      input.authorName,
      input.type,
      input.title,
      input.description || null,
      input.repositoryUrl || null,
      input.documentationUrl || null,
      input.version || '0.1.0',
      input.tags || [],
    ];
    const { rows } = await this.pool.query(query, values);
    return this.mapContribution(rows[0]);
  }

  async getContribution(id: string): Promise<Contribution | null> {
    const { rows } = await this.pool.query('SELECT * FROM contributions WHERE id = $1', [id]);
    return rows.length > 0 ? this.mapContribution(rows[0]) : null;
  }

  async listContributions(params: PaginationParams & { type?: string; status?: string; authorId?: string }): Promise<PaginatedResponse<Contribution>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(params.type);
    }
    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.authorId) {
      conditions.push(`author_id = $${paramIndex++}`);
      values.push(params.authorId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM contributions ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM contributions ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapContribution(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async updateContribution(id: string, input: UpdateContributionInput): Promise<Contribution | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(input.title); }
    if (input.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(input.description); }
    if (input.repositoryUrl !== undefined) { fields.push(`repository_url = $${paramIndex++}`); values.push(input.repositoryUrl); }
    if (input.documentationUrl !== undefined) { fields.push(`documentation_url = $${paramIndex++}`); values.push(input.documentationUrl); }
    if (input.version !== undefined) { fields.push(`version = $${paramIndex++}`); values.push(input.version); }
    if (input.tags !== undefined) { fields.push(`tags = $${paramIndex++}`); values.push(input.tags); }
    if (input.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(input.status); }

    if (fields.length === 0) return this.getContribution(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE contributions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const { rows } = await this.pool.query(query, values);
    return rows.length > 0 ? this.mapContribution(rows[0]) : null;
  }

  async deleteContribution(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM contributions WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ==================== Plugins ====================

  async submitPlugin(input: SubmitPluginInput): Promise<Plugin> {
    const query = `
      INSERT INTO plugins (name, description, author_id, author_name, version, manifest, download_url, checksum_sha256, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      input.name,
      input.description || null,
      input.authorId,
      input.authorName,
      input.version || '0.1.0',
      JSON.stringify(input.manifest),
      input.downloadUrl || null,
      input.checksumSha256 || null,
      input.category || null,
      input.tags || [],
    ];
    const { rows } = await this.pool.query(query, values);
    return this.mapPlugin(rows[0]);
  }

  async getPlugin(id: string): Promise<Plugin | null> {
    const { rows } = await this.pool.query('SELECT * FROM plugins WHERE id = $1', [id]);
    return rows.length > 0 ? this.mapPlugin(rows[0]) : null;
  }

  async getPluginByName(name: string): Promise<Plugin | null> {
    const { rows } = await this.pool.query('SELECT * FROM plugins WHERE name = $1', [name]);
    return rows.length > 0 ? this.mapPlugin(rows[0]) : null;
  }

  async listPlugins(params: PaginationParams & { status?: string; category?: string }): Promise<PaginatedResponse<Plugin>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.category) {
      conditions.push(`category = $${paramIndex++}`);
      values.push(params.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM plugins ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM plugins ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapPlugin(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async updatePluginStatus(id: string, status: string): Promise<Plugin | null> {
    const { rows } = await this.pool.query(
      'UPDATE plugins SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    );
    return rows.length > 0 ? this.mapPlugin(rows[0]) : null;
  }

  async incrementPluginDownloads(id: string): Promise<void> {
    await this.pool.query('UPDATE plugins SET downloads_count = downloads_count + 1 WHERE id = $1', [id]);
  }

  // ==================== Reviews ====================

  async createReview(input: CreateReviewInput): Promise<Review> {
    const query = `
      INSERT INTO reviews (target_id, target_type, reviewer_id, reviewer_name, rating, title, content)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [input.targetId, input.targetType, input.reviewerId, input.reviewerName, input.rating, input.title || null, input.content || null];
    const { rows } = await this.pool.query(query, values);
    return this.mapReview(rows[0]);
  }

  async getReview(id: string): Promise<Review | null> {
    const { rows } = await this.pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
    return rows.length > 0 ? this.mapReview(rows[0]) : null;
  }

  async listReviews(params: PaginationParams & { targetId?: string; targetType?: string; reviewerId?: string }): Promise<PaginatedResponse<Review>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.targetId) { conditions.push(`target_id = $${paramIndex++}`); values.push(params.targetId); }
    if (params.targetType) { conditions.push(`target_type = $${paramIndex++}`); values.push(params.targetType); }
    if (params.reviewerId) { conditions.push(`reviewer_id = $${paramIndex++}`); values.push(params.reviewerId); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM reviews ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM reviews ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapReview(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async deleteReview(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  /** 获取指定目标的所有评论 */
  async getReviews(targetId: string): Promise<Review[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM reviews WHERE target_id = $1 ORDER BY created_at DESC',
      [targetId],
    );
    return rows.map((r) => this.mapReview(r));
  }

  // ==================== Feedback ====================

  async createFeedback(input: CreateFeedbackInput): Promise<Feedback> {
    const query = `
      INSERT INTO feedback (target_id, target_type, user_id, user_name, type, content, severity)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [input.targetId, input.targetType, input.userId, input.userName, input.type || 'feedback', input.content, input.severity || 'info'];
    const { rows } = await this.pool.query(query, values);
    return this.mapFeedback(rows[0]);
  }

  async getFeedback(id: string): Promise<Feedback | null> {
    const { rows } = await this.pool.query('SELECT * FROM feedback WHERE id = $1', [id]);
    return rows.length > 0 ? this.mapFeedback(rows[0]) : null;
  }

  async listFeedback(params: PaginationParams & { targetId?: string; status?: string; severity?: string }): Promise<PaginatedResponse<Feedback>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.targetId) { conditions.push(`target_id = $${paramIndex++}`); values.push(params.targetId); }
    if (params.status) { conditions.push(`status = $${paramIndex++}`); values.push(params.status); }
    if (params.severity) { conditions.push(`severity = $${paramIndex++}`); values.push(params.severity); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM feedback ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM feedback ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapFeedback(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async updateFeedbackStatus(id: string, status: string, resolution?: string): Promise<Feedback | null> {
    const query = resolution
      ? 'UPDATE feedback SET status = $1, resolution = $2, updated_at = NOW() WHERE id = $3 RETURNING *'
      : 'UPDATE feedback SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    const values = resolution ? [status, resolution, id] : [status, id];
    const { rows } = await this.pool.query(query, values);
    return rows.length > 0 ? this.mapFeedback(rows[0]) : null;
  }

  // ==================== Row Mappers ====================

  private mapContribution(row: Record<string, unknown>): Contribution {
    return {
      id: row.id as string,
      authorId: row.author_id as string,
      authorName: row.author_name as string,
      type: row.type as ContributionType,
      title: row.title as string,
      description: row.description as string | undefined,
      repositoryUrl: row.repository_url as string | undefined,
      documentationUrl: row.documentation_url as string | undefined,
      version: row.version as string,
      status: row.status as ContributionStatus,
      tags: (row.tags as string[]) || [],
      downloadsCount: row.downloads_count as number,
      starsCount: row.stars_count as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapPlugin(row: Record<string, unknown>): Plugin {
    return {
      id: row.id as string,
      contributionId: row.contribution_id as string | undefined,
      name: row.name as string,
      description: row.description as string | undefined,
      authorId: row.author_id as string,
      authorName: row.author_name as string,
      version: row.version as string,
      manifest: (row.manifest as Record<string, unknown>) || {},
      downloadUrl: row.download_url as string | undefined,
      checksumSha256: row.checksum_sha256 as string | undefined,
      status: row.status as PluginStatus,
      category: row.category as string | undefined,
      tags: (row.tags as string[]) || [],
      ratingAvg: parseFloat(row.rating_avg as string),
      ratingCount: row.rating_count as number,
      downloadsCount: row.downloads_count as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapReview(row: Record<string, unknown>): Review {
    return {
      id: row.id as string,
      targetId: row.target_id as string,
      targetType: row.target_type as string,
      reviewerId: row.reviewer_id as string,
      reviewerName: row.reviewer_name as string,
      rating: row.rating as number,
      title: row.title as string | undefined,
      content: row.content as string | undefined,
      status: row.status as ReviewStatus,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapFeedback(row: Record<string, unknown>): Feedback {
    return {
      id: row.id as string,
      targetId: row.target_id as string,
      targetType: row.target_type as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      type: row.type as string,
      content: row.content as string,
      severity: row.severity as FeedbackSeverity,
      status: row.status as FeedbackStatus,
      resolution: row.resolution as string | undefined,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

export default CommunityService;
