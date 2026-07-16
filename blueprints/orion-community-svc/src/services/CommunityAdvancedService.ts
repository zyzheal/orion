import { Pool } from 'pg';

/** 徽章等级 */
export enum BadgeLevel {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

/** 徽章实体 */
export interface Badge {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  category?: string;
  criteria: Record<string, unknown>;
  level: BadgeLevel;
  isActive: boolean;
  createdAt: string;
}

/** 用户徽章 */
export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeLevel: string;
  badgeIconUrl?: string;
  awardedAt: string;
  awardedBy?: string;
  metadata: Record<string, unknown>;
}

/** 激励类型 */
export enum IncentiveType {
  BOUNTY = 'bounty',
  REWARD = 'reward',
  RECOGNITION = 'recognition',
  GRANT = 'grant',
}

/** 激励奖励类型 */
export enum RewardType {
  CASH = 'cash',
  CREDIT = 'credit',
  BADGE = 'badge',
  FEATURE = 'feature',
}

/** 激励实体 */
export interface Incentive {
  id: string;
  name: string;
  description?: string;
  type: IncentiveType;
  rewardType: RewardType;
  rewardValue?: number;
  eligibilityCriteria: Record<string, unknown>;
  budgetTotal?: number;
  budgetSpent: number;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** 激励奖励 */
export interface IncentiveAward {
  id: string;
  incentiveId: string;
  incentiveName: string;
  userId: string;
  userName: string;
  rewardValue?: number;
  reason?: string;
  status: string;
  awardedAt: string;
  fulfilledAt?: string;
}

/** 导师实体 */
export interface Mentor {
  id: string;
  userId: string;
  userName: string;
  bio?: string;
  expertise: string[];
  availability?: string;
  ratingAvg: number;
  ratingCount: number;
  menteeCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 最佳实践实体 */
export interface BestPractice {
  id: string;
  title: string;
  description: string;
  category: string;
  content: Record<string, unknown>;
  authorId: string;
  authorName: string;
  tags: string[];
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  upvoteCount: number;
  viewCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** 分页参数 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * CommunityAdvancedService - 社区高级功能业务逻辑
 * 负责 Badges, Incentives, Mentors, BestPractices 的 CRUD
 */
export class CommunityAdvancedService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ==================== Badges ====================

  async createBadge(input: {
    name: string;
    description?: string;
    iconUrl?: string;
    category?: string;
    criteria?: Record<string, unknown>;
    level?: BadgeLevel;
  }): Promise<Badge> {
    const query = `
      INSERT INTO badges (name, description, icon_url, category, criteria, level)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      input.name,
      input.description || null,
      input.iconUrl || null,
      input.category || null,
      JSON.stringify(input.criteria || {}),
      input.level || BadgeLevel.BRONZE,
    ];
    const { rows } = await this.pool.query(query, values);
    return this.mapBadge(rows[0]);
  }

  async getBadge(id: string): Promise<Badge | null> {
    const { rows } = await this.pool.query('SELECT * FROM badges WHERE id = $1', [id]);
    return rows.length > 0 ? this.mapBadge(rows[0]) : null;
  }

  async listBadges(params: PaginationParams & { category?: string; level?: string }): Promise<PaginatedResponse<Badge>> {
    const conditions: string[] = ['is_active = true'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.category) { conditions.push(`category = $${paramIndex++}`); values.push(params.category); }
    if (params.level) { conditions.push(`level = $${paramIndex++}`); values.push(params.level); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `SELECT COUNT(*) FROM badges ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM badges ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapBadge(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async awardBadge(userId: string, badgeId: string, awardedBy?: string, metadata?: Record<string, unknown>): Promise<UserBadge | null> {
    const joinQuery = `
      INSERT INTO user_badges (user_id, badge_id, awarded_by, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING *;
    `;
    const { rows } = await this.pool.query(joinQuery, [userId, badgeId, awardedBy || null, JSON.stringify(metadata || {})]);
    if (rows.length === 0) return null;

    const userBadge = rows[0];
    const badgeInfo = await this.pool.query('SELECT name, level, icon_url FROM badges WHERE id = $1', [badgeId]);
    const badge = badgeInfo.rows[0];

    return {
      id: userBadge.id,
      userId: userBadge.user_id,
      badgeId: userBadge.badge_id,
      badgeName: badge.name,
      badgeLevel: badge.level,
      badgeIconUrl: badge.icon_url,
      awardedAt: (userBadge.awarded_at as Date).toISOString(),
      awardedBy: userBadge.awarded_by as string | undefined,
      metadata: (userBadge.metadata as Record<string, unknown>) || {},
    };
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    const query = `
      SELECT ub.*, b.name AS badge_name, b.level AS badge_level, b.icon_url AS badge_icon_url
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = $1
      ORDER BY ub.awarded_at DESC;
    `;
    const { rows } = await this.pool.query(query, [userId]);
    return rows.map(this.mapUserBadge);
  }

  async toggleBadgeActive(id: string, isActive: boolean): Promise<Badge | null> {
    const { rows } = await this.pool.query(
      'UPDATE badges SET is_active = $1 WHERE id = $2 RETURNING *',
      [isActive, id],
    );
    return rows.length > 0 ? this.mapBadge(rows[0]) : null;
  }

  // ==================== Incentives ====================

  async createIncentive(input: {
    name: string;
    description?: string;
    type: IncentiveType;
    rewardType: RewardType;
    rewardValue?: number;
    eligibilityCriteria?: Record<string, unknown>;
    budgetTotal?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<Incentive> {
    const query = `
      INSERT INTO incentives (name, description, type, reward_type, reward_value, eligibility_criteria, budget_total, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      input.name,
      input.description || null,
      input.type,
      input.rewardType,
      input.rewardValue || null,
      JSON.stringify(input.eligibilityCriteria || {}),
      input.budgetTotal || null,
      input.startDate || null,
      input.endDate || null,
    ];
    const { rows } = await this.pool.query(query, values);
    return this.mapIncentive(rows[0]);
  }

  async getIncentive(id: string): Promise<Incentive | null> {
    const { rows } = await this.pool.query('SELECT * FROM incentives WHERE id = $1', [id]);
    return rows.length > 0 ? this.mapIncentive(rows[0]) : null;
  }

  async listIncentives(params: PaginationParams & { type?: string; status?: string }): Promise<PaginatedResponse<Incentive>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.type) { conditions.push(`type = $${paramIndex++}`); values.push(params.type); }
    if (params.status) { conditions.push(`status = $${paramIndex++}`); values.push(params.status); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM incentives ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM incentives ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapIncentive(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async awardIncentive(input: {
    incentiveId: string;
    userId: string;
    userName: string;
    rewardValue?: number;
    reason?: string;
  }): Promise<IncentiveAward> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const incentiveQuery = 'SELECT * FROM incentives WHERE id = $1 FOR UPDATE';
      const { rows } = await client.query(incentiveQuery, [input.incentiveId]);
      if (rows.length === 0) throw new Error('Incentive not found');

      const incentive = rows[0];
      if (incentive.status !== 'active') throw new Error('Incentive is not active');

      if (incentive.budget_total) {
        const remaining = parseFloat(incentive.budget_total) - parseFloat(incentive.budget_spent);
        const awardValue = input.rewardValue || incentive.reward_value || 0;
        if (remaining < awardValue) throw new Error('Incentive budget exhausted');

        await client.query(
          'UPDATE incentives SET budget_spent = budget_spent + $1 WHERE id = $2',
          [awardValue, input.incentiveId],
        );
      }

      const awardQuery = `
        INSERT INTO incentive_awards (incentive_id, user_id, user_name, reward_value, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const { rows: awardRows } = await client.query(awardQuery, [
        input.incentiveId,
        input.userId,
        input.userName,
        input.rewardValue || null,
        input.reason || null,
      ]);

      await client.query('COMMIT');

      return {
        id: awardRows[0].id,
        incentiveId: awardRows[0].incentive_id,
        incentiveName: incentive.name,
        userId: awardRows[0].user_id,
        userName: awardRows[0].user_name,
        rewardValue: awardRows[0].reward_value ? parseFloat(awardRows[0].reward_value) : undefined,
        reason: awardRows[0].reason as string | undefined,
        status: awardRows[0].status,
        awardedAt: (awardRows[0].awarded_at as Date).toISOString(),
        fulfilledAt: awardRows[0].fulfilled_at ? (awardRows[0].fulfilled_at as Date).toISOString() : undefined,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listIncentiveAwards(params: PaginationParams & { incentiveId?: string; userId?: string; status?: string }): Promise<PaginatedResponse<IncentiveAward>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.incentiveId) { conditions.push(`ia.incentive_id = $${paramIndex++}`); values.push(params.incentiveId); }
    if (params.userId) { conditions.push(`ia.user_id = $${paramIndex++}`); values.push(params.userId); }
    if (params.status) { conditions.push(`ia.status = $${paramIndex++}`); values.push(params.status); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM incentive_awards ia ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `
      SELECT ia.*, i.name AS incentive_name
      FROM incentive_awards ia
      LEFT JOIN incentives i ON ia.incentive_id = i.id
      ${whereClause}
      ORDER BY ia.awarded_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => ({
        id: r.id,
        incentiveId: r.incentive_id,
        incentiveName: r.incentive_name,
        userId: r.user_id,
        userName: r.user_name,
        rewardValue: r.reward_value ? parseFloat(r.reward_value) : undefined,
        reason: r.reason as string | undefined,
        status: r.status,
        awardedAt: (r.awarded_at as Date).toISOString(),
        fulfilledAt: r.fulfilled_at ? (r.fulfilled_at as Date).toISOString() : undefined,
      })),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async updateIncentiveStatus(id: string, status: string): Promise<Incentive | null> {
    const { rows } = await this.pool.query(
      'UPDATE incentives SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    );
    return rows.length > 0 ? this.mapIncentive(rows[0]) : null;
  }

  async fulfillIncentiveAward(id: string): Promise<IncentiveAward | null> {
    const { rows } = await this.pool.query(
      "UPDATE incentive_awards SET status = 'fulfilled', fulfilled_at = NOW() WHERE id = $1 RETURNING *",
      [id],
    );
    if (rows.length === 0) return null;
    const award = rows[0];
    return {
      id: award.id,
      incentiveId: award.incentive_id,
      incentiveName: '',
      userId: award.user_id,
      userName: award.user_name,
      rewardValue: award.reward_value ? parseFloat(award.reward_value) : undefined,
      reason: award.reason as string | undefined,
      status: award.status,
      awardedAt: (award.awarded_at as Date).toISOString(),
      fulfilledAt: award.fulfilled_at ? (award.fulfilled_at as Date).toISOString() : undefined,
    };
  }

  // ==================== Mentors ====================

  async registerMentor(input: {
    userId: string;
    userName: string;
    bio?: string;
    expertise?: string[];
    availability?: string;
  }): Promise<Mentor> {
    const query = `
      INSERT INTO mentors (user_id, user_name, bio, expertise, availability)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        user_name = EXCLUDED.user_name,
        bio = EXCLUDED.bio,
        expertise = EXCLUDED.expertise,
        availability = EXCLUDED.availability,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      input.userId,
      input.userName,
      input.bio || null,
      input.expertise || [],
      input.availability || null,
    ];
    const { rows } = await this.pool.query(query, values);
    return this.mapMentor(rows[0]);
  }

  async getMentor(userId: string): Promise<Mentor | null> {
    const { rows } = await this.pool.query('SELECT * FROM mentors WHERE user_id = $1', [userId]);
    return rows.length > 0 ? this.mapMentor(rows[0]) : null;
  }

  async listMentors(params: PaginationParams & { expertise?: string; isActive?: boolean }): Promise<PaginatedResponse<Mentor>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.isActive !== undefined) { conditions.push(`is_active = $${paramIndex++}`); values.push(params.isActive); }
    if (params.expertise) { conditions.push(`$${paramIndex} = ANY(expertise)`); values.push(params.expertise); paramIndex++; }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM mentors ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM mentors ${whereClause} ORDER BY rating_avg DESC, mentee_count DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapMentor(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async updateMentorActive(userId: string, isActive: boolean): Promise<Mentor | null> {
    const { rows } = await this.pool.query(
      'UPDATE mentors SET is_active = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [isActive, userId],
    );
    return rows.length > 0 ? this.mapMentor(rows[0]) : null;
  }

  async updateMentorRating(userId: string, rating: number): Promise<void> {
    await this.pool.query(`
      UPDATE mentors
      SET rating_avg = ((rating_avg * rating_count) + $1) / (rating_count + 1),
          rating_count = rating_count + 1,
          updated_at = NOW()
      WHERE user_id = $2
    `, [rating, userId]);
  }

  async incrementMenteeCount(userId: string): Promise<void> {
    await this.pool.query('UPDATE mentors SET mentee_count = mentee_count + 1, updated_at = NOW() WHERE user_id = $1', [userId]);
  }

  // ==================== Best Practices ====================

  async createBestPractice(input: {
    title: string;
    description: string;
    category: string;
    content: Record<string, unknown>;
    authorId: string;
    authorName: string;
    tags?: string[];
  }): Promise<BestPractice> {
    const query = `
      INSERT INTO best_practices (title, description, category, content, author_id, author_name, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      input.title,
      input.description,
      input.category,
      JSON.stringify(input.content),
      input.authorId,
      input.authorName,
      input.tags || [],
    ];
    const { rows } = await this.pool.query(query, values);
    return this.mapBestPractice(rows[0]);
  }

  async getBestPractice(id: string): Promise<BestPractice | null> {
    const { rows } = await this.pool.query('SELECT * FROM best_practices WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    await this.pool.query('UPDATE best_practices SET view_count = view_count + 1 WHERE id = $1', [id]);
    return this.mapBestPractice(rows[0]);
  }

  async listBestPractices(params: PaginationParams & { category?: string; status?: string; verified?: boolean }): Promise<PaginatedResponse<BestPractice>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.category) { conditions.push(`category = $${paramIndex++}`); values.push(params.category); }
    if (params.status) { conditions.push(`status = $${paramIndex++}`); values.push(params.status); }
    if (params.verified !== undefined) { conditions.push(`is_verified = $${paramIndex++}`); values.push(params.verified); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM best_practices ${whereClause}`;
    const { rows: countRows } = await this.pool.query(countQuery, values);
    const total = parseInt(countRows[0].count, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);
    const dataQuery = `SELECT * FROM best_practices ${whereClause} ORDER BY upvote_count DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const { rows } = await this.pool.query(dataQuery, values);

    return {
      data: rows.map((r) => this.mapBestPractice(r)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async verifyBestPractice(id: string, verifiedBy: string): Promise<BestPractice | null> {
    const query = `
      UPDATE best_practices SET is_verified = true, verified_by = $1, verified_at = NOW(), status = 'published' WHERE id = $2 RETURNING *;
    `;
    const { rows } = await this.pool.query(query, [verifiedBy, id]);
    return rows.length > 0 ? this.mapBestPractice(rows[0]) : null;
  }

  async upvoteBestPractice(id: string): Promise<BestPractice | null> {
    const { rows } = await this.pool.query(
      'UPDATE best_practices SET upvote_count = upvote_count + 1 WHERE id = $1 RETURNING *',
      [id],
    );
    return rows.length > 0 ? this.mapBestPractice(rows[0]) : null;
  }

  async updateBestPracticeStatus(id: string, status: string): Promise<BestPractice | null> {
    const { rows } = await this.pool.query(
      'UPDATE best_practices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    );
    return rows.length > 0 ? this.mapBestPractice(rows[0]) : null;
  }

  // ==================== Simple array-returning helpers ====================

  /** 获取所有可用徽章（不分页） */
  async getAllBadges(): Promise<Badge[]> {
    const { rows } = await this.pool.query('SELECT * FROM badges WHERE is_active = true ORDER BY created_at DESC');
    return rows.map((r) => this.mapBadge(r));
  }

  /** 获取用户的所有激励记录 */
  async getUserIncentives(userId: string): Promise<IncentiveAward[]> {
    const query = `
      SELECT ia.*, i.name AS incentive_name
      FROM incentive_awards ia
      LEFT JOIN incentives i ON ia.incentive_id = i.id
      WHERE ia.user_id = $1
      ORDER BY ia.awarded_at DESC;
    `;
    const { rows } = await this.pool.query(query, [userId]);
    return rows.map((r) => ({
      id: r.id,
      incentiveId: r.incentive_id,
      incentiveName: r.incentive_name,
      userId: r.user_id,
      userName: r.user_name,
      rewardValue: r.reward_value ? parseFloat(r.reward_value) : undefined,
      reason: r.reason as string | undefined,
      status: r.status,
      awardedAt: (r.awarded_at as Date).toISOString(),
      fulfilledAt: r.fulfilled_at ? (r.fulfilled_at as Date).toISOString() : undefined,
    }));
  }

  /** 获取所有活跃导师（不分页） */
  async getAllMentors(): Promise<Mentor[]> {
    const { rows } = await this.pool.query('SELECT * FROM mentors WHERE is_active = true ORDER BY rating_avg DESC, mentee_count DESC');
    return rows.map((r) => this.mapMentor(r));
  }

  /** 获取所有已发布的最佳实践（不分页） */
  async getAllBestPractices(): Promise<BestPractice[]> {
    const { rows } = await this.pool.query("SELECT * FROM best_practices WHERE status = 'published' ORDER BY upvote_count DESC, created_at DESC");
    return rows.map((r) => this.mapBestPractice(r));
  }

  // ==================== Row Mappers ====================

  private mapBadge(row: Record<string, unknown>): Badge {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      iconUrl: row.icon_url as string | undefined,
      category: row.category as string | undefined,
      criteria: (row.criteria as Record<string, unknown>) || {},
      level: row.level as BadgeLevel,
      isActive: row.is_active as boolean,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  private mapUserBadge(row: Record<string, unknown>): UserBadge {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      badgeId: row.badge_id as string,
      badgeName: row.badge_name as string,
      badgeLevel: row.badge_level as string,
      badgeIconUrl: row.badge_icon_url as string | undefined,
      awardedAt: (row.awarded_at as Date).toISOString(),
      awardedBy: row.awarded_by as string | undefined,
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }

  private mapIncentive(row: Record<string, unknown>): Incentive {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as IncentiveType,
      rewardType: row.reward_type as RewardType,
      rewardValue: row.reward_value ? parseFloat(row.reward_value as string) : undefined,
      eligibilityCriteria: (row.eligibility_criteria as Record<string, unknown>) || {},
      budgetTotal: row.budget_total ? parseFloat(row.budget_total as string) : undefined,
      budgetSpent: parseFloat(row.budget_spent as string),
      status: row.status as string,
      startDate: row.start_date ? (row.start_date as Date).toISOString() : undefined,
      endDate: row.end_date ? (row.end_date as Date).toISOString() : undefined,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapMentor(row: Record<string, unknown>): Mentor {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      bio: row.bio as string | undefined,
      expertise: (row.expertise as string[]) || [],
      availability: row.availability as string | undefined,
      ratingAvg: parseFloat(row.rating_avg as string),
      ratingCount: row.rating_count as number,
      menteeCount: row.mentee_count as number,
      isActive: row.is_active as boolean,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapBestPractice(row: Record<string, unknown>): BestPractice {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      category: row.category as string,
      content: (row.content as Record<string, unknown>) || {},
      authorId: row.author_id as string,
      authorName: row.author_name as string,
      tags: (row.tags as string[]) || [],
      isVerified: row.is_verified as boolean,
      verifiedBy: row.verified_by as string | undefined,
      verifiedAt: row.verified_at ? (row.verified_at as Date).toISOString() : undefined,
      upvoteCount: row.upvote_count as number,
      viewCount: row.view_count as number,
      status: row.status as string,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

export default CommunityAdvancedService;
