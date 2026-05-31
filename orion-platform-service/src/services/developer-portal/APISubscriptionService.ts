/**
 * APISubscriptionService - 开发者门户 API 订阅管理
 *
 * 管理 API 订阅审批流程和用量追踪。
 * 包含：订阅申请、审批/拒绝、用量记录、配额管理。
 */

import { randomUUID } from 'crypto';

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
    return subscription;
  }

  /**
   * 获取订阅详情
   */
  async getSubscriptionById(id: string): Promise<APISubscription> {
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
    let subs = Array.from(this.subscriptions.values()).filter((s) => s.tenantId === tenantId);

    if (options?.userId) subs = subs.filter((s) => s.userId === options.userId);
    if (options?.apiName) subs = subs.filter((s) => s.apiName === options.apiName);
    if (options?.status) subs = subs.filter((s) => s.status === options.status);

    subs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
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

    return record;
  }

  /**
   * 获取用量记录
   */
  async getUsageRecords(
    subscriptionId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ data: UsageRecord[]; total: number; page: number; totalPages: number }> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      throw new APISubscriptionServiceError(`Subscription not found: ${subscriptionId}`, 'SUBSCRIPTION_NOT_FOUND');
    }

    const records = (this.usageRecords.get(subscriptionId) ?? [])
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
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
}
