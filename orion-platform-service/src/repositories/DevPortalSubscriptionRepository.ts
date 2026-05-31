/**
 * DevPortalSubscriptionRepository
 * Data access layer for API subscriptions and usage records.
 * Replaces in-memory Maps in APISubscriptionService.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

// ==================== API Subscription ====================

export interface DevPortalSubscriptionEntity {
  id: string;
  tenantId: string;
  userId: string;
  apiName: string;
  planName: string;
  quotaPerDay: number;
  quotaPerMonth: number;
  usedToday: number;
  usedThisMonth: number;
  status: string;
  reason: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectReason: string | null;
  apiKey: string;
  expiresAt: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class DevPortalSubscriptionRepository extends BaseRepository<DevPortalSubscriptionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'devportal_api_subscriptions');
  }

  async create(data: Omit<DevPortalSubscriptionEntity, 'created_at' | 'updated_at'> & Partial<Pick<DevPortalSubscriptionEntity, 'id'>>): Promise<DevPortalSubscriptionEntity> {
    const columns = ['id', 'tenant_id', 'user_id', 'api_name', 'plan_name', 'quota_per_day', 'quota_per_month', 'used_today', 'used_this_month', 'status', 'reason', 'approved_by', 'approved_at', 'reject_reason', 'api_key', 'expires_at'];
    const values = [data.id, data.tenantId, data.userId, data.apiName, data.planName, data.quotaPerDay, data.quotaPerMonth, data.usedToday, data.usedThisMonth, data.status, data.reason, data.approvedBy, data.approvedAt, data.rejectReason, data.apiKey, data.expiresAt];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, options?: { userId?: string; apiName?: string; status?: string }): Promise<DevPortalSubscriptionEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options?.userId) {
      query += ` AND user_id = $${paramIdx++}`;
      params.push(options.userId);
    }
    if (options?.apiName) {
      query += ` AND api_name = $${paramIdx++}`;
      params.push(options.apiName);
    }
    if (options?.status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findDuplicate(tenantId: string, userId: string, apiName: string): Promise<DevPortalSubscriptionEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND user_id = $2 AND api_name = $3 AND status IN ('pending', 'approved') LIMIT 1`,
      [tenantId, userId, apiName],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async incrementUsage(id: string): Promise<void> {
    await this.db.query(
      `UPDATE ${this.tableName} SET used_today = used_today + 1, used_this_month = used_this_month + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async updateStatus(id: string, status: string, extra?: { approvedBy?: string; rejectReason?: string }): Promise<DevPortalSubscriptionEntity> {
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: unknown[] = [status];
    let paramIdx = 2;

    if (extra?.approvedBy) {
      updates.push(`approved_by = $${paramIdx++}`);
      params.push(extra.approvedBy);
      updates.push(`approved_at = NOW()`);
    }
    if (extra?.rejectReason) {
      updates.push(`reject_reason = $${paramIdx++}`);
      params.push(extra.rejectReason);
    }

    params.push(id);
    const result = await this.db.query(
      `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.NOT_FOUND);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DevPortalSubscriptionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      apiName: row.api_name,
      planName: row.plan_name,
      quotaPerDay: row.quota_per_day,
      quotaPerMonth: row.quota_per_month,
      usedToday: row.used_today,
      usedThisMonth: row.used_this_month,
      status: row.status,
      reason: row.reason ?? '',
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectReason: row.reject_reason,
      apiKey: row.api_key,
      expiresAt: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Usage Records ====================

export interface DevPortalUsageRecordEntity {
  id: string;
  subscriptionId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  created_at: Date;
}

export class DevPortalUsageRecordRepository extends BaseRepository<DevPortalUsageRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'devportal_usage_records');
  }

  async create(data: Omit<DevPortalUsageRecordEntity, 'createdAt'> & Partial<Pick<DevPortalUsageRecordEntity, 'id'>>): Promise<DevPortalUsageRecordEntity> {
    const columns = ['id', 'subscription_id', 'timestamp', 'endpoint', 'method', 'status_code', 'latency_ms'];
    const values = [data.id, data.subscriptionId, data.timestamp, data.endpoint, data.method, data.statusCode, data.latencyMs];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findBySubscription(subscriptionId: string, options?: { limit?: number; offset?: number }): Promise<DevPortalUsageRecordEntity[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE subscription_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
      [subscriptionId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countBySubscription(subscriptionId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE subscription_id = $1`,
      [subscriptionId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): DevPortalUsageRecordEntity {
    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      timestamp: row.timestamp,
      endpoint: row.endpoint,
      method: row.method,
      statusCode: row.status_code,
      latencyMs: row.latency_ms,
      created_at: row.created_at,
    };
  }
}
