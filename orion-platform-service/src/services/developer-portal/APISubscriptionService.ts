/**
 * APISubscriptionService - 开发者门户 API 订阅管理
 *
 * 管理 API 订阅审批流程和用量追踪。
 * 包含：订阅申请、审批/拒绝、用量记录、配额管理。
 */

import { randomUUID } from 'crypto';
import {
  DevPortalSubscriptionRepository,
  DevPortalUsageRecordRepository,
} from '../../repositories/DevPortalSubscriptionRepository';

// ==================== Type Definitions ====================

export type SubscriptionStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'cancelled';

export interface APISubscription {
  id: string;
  tenantId: string;
  userId: string;
  apiName: string;
  planName: string;
  quotaPerDay: number;
  quotaPerMonth: number;
  usedToday: number;
  usedThisMonth: number;
  status: SubscriptionStatus;
  reason: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectReason: string | null;
  apiKey: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionCreateInput {
  tenantId: string;
  userId: string;
  apiName: string;
  planName?: string;
  quotaPerDay?: number;
  quotaPerMonth?: number;
  reason?: string;
}

export interface SubscriptionApprovalInput {
  approvedBy: string;
  rejectReason?: string;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
}

export class APISubscriptionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'APISubscriptionServiceError';
  }
}

// ==================== Service ====================

export class APISubscriptionService {
  private subscriptions: Map<string, APISubscription> = new Map();
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private subscriptionRepo: DevPortalSubscriptionRepository | null = null;
  private usageRepo: DevPortalUsageRecordRepository | null = null;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.subscriptionRepo = new DevPortalSubscriptionRepository(db);
      this.usageRepo = new DevPortalUsageRecordRepository(db);
    }
  }

  /**
   * 创建 API 订阅申请
   */
  async createSubscription(input: SubscriptionCreateInput): Promise<APISubscription> {
    if (!input.userId || input.userId.trim().length === 0) {
      throw new APISubscriptionServiceError('User ID is required', 'INVALID_INPUT');
    }
    if (!input.apiName || input.apiName.trim().length === 0) {
      throw new APISubscriptionServiceError('API name is required', 'INVALID_INPUT');
    }

    // Check for duplicate subscription
    const existing = Array.from(this.subscriptions.values()).find(
      (s) => s.tenantId === input.tenantId && s.userId === input.userId && s.apiName === input.apiName
        && ['pending', 'approved'].includes(s.status)
    );
    if (existing) {
      throw new APISubscriptionServiceError('You already have an active or pending subscription for this API', 'DUPLICATE_SUBSCRIPTION');
    }

    const now = new Date();
    const subscription: APISubscription = {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId.trim(),
      apiName: input.apiName.trim(),
      planName: input.planName ?? 'standard',
      quotaPerDay: input.quotaPerDay ?? 1000,
      quotaPerMonth: input.quotaPerMonth ?? 30000,
      usedToday: 0,
      usedThisMonth: 0,
      status: 'pending',
      reason: input.reason?.trim() ?? '',
      approvedBy: null,
      approvedAt: null,
      rejectReason: null,
      apiKey: this.generateApiKey(),
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(subscription.id, subscription);

    // PostgreSQL 持久化（异步）
    if (this.subscriptionRepo) {
      this.subscriptionRepo.create({
        id: subscription.id,
        tenantId: subscription.tenantId,
        userId: subscription.userId,
        apiName: subscription.apiName,
        planName: subscription.planName,
        quotaPerDay: subscription.quotaPerDay,
        quotaPerMonth: subscription.quotaPerMonth,
        usedToday: 0,
        usedThisMonth: 0,
        status: 'pending',
        reason: subscription.reason,
        approvedBy: null,
        approvedAt: null,
        rejectReason: null,
        apiKey: subscription.apiKey,
        expiresAt: subscription.expiresAt,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    return subscription;
  }

  /**
   * 获取订阅详情
   */
  async getSubscriptionById(id: string): Promise<APISubscription> {
    // Try repository first
    if (this.subscriptionRepo) {
      try {
        const entity = await this.subscriptionRepo.findById(id);
        if (entity) {
          const sub = this.entityToSubscription(entity);
          this.subscriptions.set(id, sub); // update cache
          return sub;
        }
      } catch { /* fallback to Map */ }
    }
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${id}`, 'SUBSCRIPTION_NOT_FOUND');
    }
    return sub;
  }

  /**
   * 列出订阅
   */
  async listSubscriptions(
    tenantId: string,
    options?: { userId?: string; apiName?: string; status?: SubscriptionStatus; page?: number; pageSize?: number }
  ): Promise<{ data: APISubscription[]; total: number; page: number; totalPages: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    // Try repository first
    if (this.subscriptionRepo) {
      try {
        const entities = await this.subscriptionRepo.findByTenant(tenantId, {
          userId: options?.userId,
          apiName: options?.apiName,
          status: options?.status,
        });
        const total = entities.length;
        const start = (page - 1) * pageSize;
        const data = entities.slice(start, start + pageSize).map(e => this.entityToSubscription(e));
        return { data, total, page, totalPages: Math.ceil(total / pageSize) };
      } catch { /* fallback to Map */ }
    }

    let subs = Array.from(this.subscriptions.values()).filter((s) => s.tenantId === tenantId);

    if (options?.userId) subs = subs.filter((s) => s.userId === options.userId);
    if (options?.apiName) subs = subs.filter((s) => s.apiName === options.apiName);
    if (options?.status) subs = subs.filter((s) => s.status === options.status);

    subs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = subs.length;
    const start = (page - 1) * pageSize;
    const data = subs.slice(start, start + pageSize);

    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 审批订阅
   */
  async approveSubscription(id: string, input: SubscriptionApprovalInput): Promise<APISubscription> {
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${id}`, 'SUBSCRIPTION_NOT_FOUND');
    }
    if (sub.status !== 'pending') {
      throw new APISubscriptionServiceError(`Cannot approve subscription in status: ${sub.status}`, 'INVALID_STATUS');
    }

    sub.status = 'approved';
    sub.approvedBy = input.approvedBy;
    sub.approvedAt = new Date();
    sub.updatedAt = new Date();

    // PostgreSQL 持久化（异步）
    if (this.subscriptionRepo) {
      this.subscriptionRepo.updateStatus(id, 'approved', { approvedBy: input.approvedBy }).catch(() => {});
    }

    return sub;
  }

  /**
   * 拒绝订阅
   */
  async rejectSubscription(id: string, input: SubscriptionApprovalInput): Promise<APISubscription> {
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${id}`, 'SUBSCRIPTION_NOT_FOUND');
    }
    if (sub.status !== 'pending') {
      throw new APISubscriptionServiceError(`Cannot reject subscription in status: ${sub.status}`, 'INVALID_STATUS');
    }

    sub.status = 'rejected';
    sub.approvedBy = input.approvedBy;
    sub.rejectReason = input.rejectReason ?? '';
    sub.updatedAt = new Date();

    // PostgreSQL 持久化（异步）
    if (this.subscriptionRepo) {
      this.subscriptionRepo.updateStatus(id, 'rejected', { approvedBy: input.approvedBy, rejectReason: input.rejectReason }).catch(() => {});
    }

    return sub;
  }

  /**
   * 暂停订阅
   */
  async suspendSubscription(id: string): Promise<APISubscription> {
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${id}`, 'SUBSCRIPTION_NOT_FOUND');
    }
    if (sub.status !== 'approved') {
      throw new APISubscriptionServiceError(`Cannot suspend subscription in status: ${sub.status}`, 'INVALID_STATUS');
    }

    sub.status = 'suspended';
    sub.updatedAt = new Date();

    // PostgreSQL 持久化（异步）
    if (this.subscriptionRepo) {
      this.subscriptionRepo.updateStatus(id, 'suspended').catch(() => {});
    }

    return sub;
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(id: string): Promise<APISubscription> {
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${id}`, 'SUBSCRIPTION_NOT_FOUND');
    }

    sub.status = 'cancelled';
    sub.updatedAt = new Date();

    // PostgreSQL 持久化（异步）
    if (this.subscriptionRepo) {
      this.subscriptionRepo.updateStatus(id, 'cancelled').catch(() => {});
    }

    return sub;
  }

  /**
   * 记录 API 调用用量
   */
  async recordUsage(
    subscriptionId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    latencyMs: number
  ): Promise<UsageRecord> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${subscriptionId}`, 'SUBSCRIPTION_NOT_FOUND');
    }
    if (sub.status !== 'approved') {
      throw new APISubscriptionServiceError('Subscription is not active', 'INVALID_STATUS');
    }

    // Check daily quota
    if (sub.usedToday >= sub.quotaPerDay) {
      throw new APISubscriptionServiceError('Daily quota exceeded', 'QUOTA_EXCEEDED');
    }

    const record: UsageRecord = {
      id: randomUUID(),
      subscriptionId,
      timestamp: new Date(),
      endpoint,
      method,
      statusCode,
      latencyMs,
    };

    const records = this.usageRecords.get(subscriptionId) ?? [];
    records.push(record);
    this.usageRecords.set(subscriptionId, records);

    sub.usedToday++;
    sub.usedThisMonth++;
    sub.updatedAt = new Date();

    // PostgreSQL 持久化（异步）
    if (this.usageRepo) {
      this.usageRepo.create({
        id: record.id,
        subscriptionId: record.subscriptionId,
        timestamp: record.timestamp,
        endpoint: record.endpoint,
        method: record.method,
        statusCode: record.statusCode,
        latencyMs: record.latencyMs,
      }).catch(() => {});
    }
    if (this.subscriptionRepo) {
      this.subscriptionRepo.incrementUsage(subscriptionId).catch(() => {});
    }

    return record;
  }

  /**
   * 获取用量记录
   */
  async getUsageRecords(
    subscriptionId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ data: UsageRecord[]; total: number; page: number; totalPages: number }> {
    // Validate subscription exists
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub && this.subscriptionRepo) {
      try {
        const entity = await this.subscriptionRepo.findById(subscriptionId);
        if (!entity) {
          throw new APISubscriptionServiceError(`Subscription not found: ${subscriptionId}`, 'SUBSCRIPTION_NOT_FOUND');
        }
      } catch (e) {
        if (e instanceof APISubscriptionServiceError) throw e;
        // repo failed, check Map
        if (!this.subscriptions.has(subscriptionId)) {
          throw new APISubscriptionServiceError(`Subscription not found: ${subscriptionId}`, 'SUBSCRIPTION_NOT_FOUND');
        }
      }
    } else if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${subscriptionId}`, 'SUBSCRIPTION_NOT_FOUND');
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    // Try repository first
    if (this.usageRepo) {
      try {
        const limit = pageSize;
        const offset = (page - 1) * pageSize;
        const [entities, total] = await Promise.all([
          this.usageRepo.findBySubscription(subscriptionId, { limit, offset }),
          this.usageRepo.countBySubscription(subscriptionId),
        ]);
        const data = entities.map(e => this.entityToUsageRecord(e));
        return { data, total, page, totalPages: Math.ceil(total / pageSize) };
      } catch { /* fallback to Map */ }
    }

    const records = (this.usageRecords.get(subscriptionId) ?? [])
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = records.length;
    const start = (page - 1) * pageSize;
    const data = records.slice(start, start + pageSize);

    return { data, total, page, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 获取用量统计
   */
  async getUsageStats(tenantId: string): Promise<{
    totalSubscriptions: number;
    approved: number;
    pending: number;
    rejected: number;
    suspended: number;
  }> {
    // Try repository first
    if (this.subscriptionRepo) {
      try {
        const entities = await this.subscriptionRepo.findByTenant(tenantId);
        return {
          totalSubscriptions: entities.length,
          approved: entities.filter((s) => s.status === 'approved').length,
          pending: entities.filter((s) => s.status === 'pending').length,
          rejected: entities.filter((s) => s.status === 'rejected').length,
          suspended: entities.filter((s) => s.status === 'suspended').length,
        };
      } catch { /* fallback to Map */ }
    }

    const subs = Array.from(this.subscriptions.values()).filter((s) => s.tenantId === tenantId);
    return {
      totalSubscriptions: subs.length,
      approved: subs.filter((s) => s.status === 'approved').length,
      pending: subs.filter((s) => s.status === 'pending').length,
      rejected: subs.filter((s) => s.status === 'rejected').length,
      suspended: subs.filter((s) => s.status === 'suspended').length,
    };
  }

  // ==================== Internal ====================

  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'orion_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private entityToSubscription(entity: any): APISubscription {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      userId: entity.userId,
      apiName: entity.apiName,
      planName: entity.planName,
      quotaPerDay: entity.quotaPerDay,
      quotaPerMonth: entity.quotaPerMonth,
      usedToday: entity.usedToday ?? 0,
      usedThisMonth: entity.usedThisMonth ?? 0,
      status: entity.status,
      reason: entity.reason ?? '',
      approvedBy: entity.approvedBy ?? null,
      approvedAt: entity.approvedAt ? new Date(entity.approvedAt) : null,
      rejectReason: entity.rejectReason ?? null,
      apiKey: entity.apiKey,
      expiresAt: entity.expiresAt ? new Date(entity.expiresAt) : null,
      createdAt: entity.created_at ? new Date(entity.created_at) : new Date(),
      updatedAt: entity.updated_at ? new Date(entity.updated_at) : new Date(),
    };
  }

  private entityToUsageRecord(entity: any): UsageRecord {
    return {
      id: entity.id,
      subscriptionId: entity.subscriptionId,
      timestamp: entity.timestamp ? new Date(entity.timestamp) : new Date(),
      endpoint: entity.endpoint,
      method: entity.method,
      statusCode: entity.statusCode,
      latencyMs: entity.latencyMs ?? 0,
    };
  }
}
