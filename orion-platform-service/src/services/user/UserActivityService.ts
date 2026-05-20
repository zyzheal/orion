/**
 * UserActivityService - 操作日志服务
 *
 * 记录和查询用户操作行为日志
 */

import { DatabasePool } from '../database';

/**
 * 用户操作活动日志
 */
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * 创建操作日志的输入参数
 */
export interface CreateActivityInput {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 查询活动日志的选项
 */
export interface GetActivitiesOptions {
  limit?: number;
  offset?: number;
  resourceType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

export class UserActivityService {
  constructor(private pool: DatabasePool) {}

  /**
   * 记录用户操作日志
   *
   * @param activity - 操作日志内容（不含 id 和 createdAt）
   * @returns 完整的用户操作日志（含自动生成的 id 和 createdAt）
   */
  async logActivity(activity: CreateActivityInput): Promise<UserActivity> {
    const id = crypto.randomUUID();
    const createdAt = new Date();

    // 处理 details 字段，确保为 JSONB 格式
    const detailsJson = activity.details ? JSON.stringify(activity.details) : '{}';

    const result = await this.pool.query(
      `INSERT INTO user_activities (
        id, user_id, action, resource_type, resource_id,
        details, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, user_id as "userId", action, resource_type as "resourceType",
                resource_id as "resourceId", details, ip_address as "ipAddress",
                user_agent as "userAgent", created_at as "createdAt"`,
      [
        id,
        activity.userId,
        activity.action,
        activity.resourceType || null,
        activity.resourceId || null,
        detailsJson,
        activity.ipAddress || null,
        activity.userAgent || null,
        createdAt,
      ],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.userId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      details: row.details,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }

  /**
   * 获取用户的操作日志列表
   *
   * @param userId - 用户ID
   * @param limit - 返回记录数量限制（默认 20）
   * @param offset - 偏移量（默认 0）
   * @returns 用户操作日志数组
   */
  async getActivities(userId: string, limit: number = 20, offset: number = 0): Promise<UserActivity[]> {
    const result = await this.pool.query(
      `SELECT id, user_id as "userId", action, resource_type as "resourceType",
              resource_id as "resourceId", details, ip_address as "ipAddress",
              user_agent as "userAgent", created_at as "createdAt"
       FROM user_activities
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      details: row.details,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    }));
  }

  /**
   * 高级查询：根据条件获取操作日志
   *
   * @param userId - 用户ID
   * @param options - 查询选项
   * @returns 用户操作日志数组
   */
  async getActivitiesByOptions(userId: string, options: GetActivitiesOptions): Promise<UserActivity[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(options.resourceType);
    }

    if (options.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(options.action);
    }

    if (options.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(options.endDate);
    }

    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    params.push(limit, offset);

    const result = await this.pool.query(
      `SELECT id, user_id as "userId", action, resource_type as "resourceType",
              resource_id as "resourceId", details, ip_address as "ipAddress",
              user_agent as "userAgent", created_at as "createdAt"
       FROM user_activities
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      details: row.details,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    }));
  }

  /**
   * 获取用户的操作日志总数
   *
   * @param userId - 用户ID
   * @returns 日志总数
   */
  async getActivityCount(userId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM user_activities WHERE user_id = $1',
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * 获取用户最近一次操作
   *
   * @param userId - 用户ID
   * @returns 最近的操作日志
   */
  async getLastActivity(userId: string): Promise<UserActivity | null> {
    const result = await this.pool.query(
      `SELECT id, user_id as "userId", action, resource_type as "resourceType",
              resource_id as "resourceId", details, ip_address as "ipAddress",
              user_agent as "userAgent", created_at as "createdAt"
       FROM user_activities
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.userId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      details: row.details,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }
}