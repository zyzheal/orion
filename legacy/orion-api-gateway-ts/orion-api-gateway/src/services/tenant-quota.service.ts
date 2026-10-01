/**
 * 租户配额管理服务
 *
 * 使用 Redis 管理租户资源配额，包括：
 * - CPU/内存使用量追踪
 * - Runner 并发数控制
 * - API 调用频率限制
 * - Token 配额管理
 * - 队列深度管理
 */

import { Redis } from 'ioredis';
import { redisClient } from '../utils/redis';
import { TenantQuota, TenantTier, DEFAULT_QUOTAS } from '../middleware/tenant';

/**
 * 配额使用记录
 */
export interface QuotaUsage {
  tenantId: string;
  cpuUsed: number;        // CPU 已使用 (m)
  memoryUsed: number;     // 内存已使用 (Mi)
  runnersActive: number;  // 当前活跃 Runner 数
  queueDepth: number;     // 队列深度
  tokenUsed: number;      // Token 已使用
  apiCalls: number;       // API 调用次数
  hoursUsed: number;      // 执行时长已使用 (小时)
  lastUpdated: Date;
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quotaType?: string;
  current?: number;
  limit?: number;
  remaining?: number;
}

/**
 * 配额预警信息
 */
export interface QuotaAlert {
  tenantId: string;
  quotaType: string;
  usagePercent: number;
  threshold: number;
  alertedAt: Date;
}

/**
 * 租户配额服务类
 */
export class TenantQuotaService {
  private redis: Redis | null = null;
  private readonly KEY_PREFIX = 'tenant:quota:';
  private readonly ALERT_THRESHOLD_WARNING = 0.85; // 85% 预警
  private readonly ALERT_THRESHOLD_CRITICAL = 0.95; // 95% 严重预警

  constructor() {
    const client = redisClient.getClient();
    if (client) {
      this.redis = client;
    }
  }

  /**
   * 设置 Redis 客户端（用于测试或延迟初始化）
   */
  setRedisClient(client: Redis): void {
    this.redis = client;
  }

  /**
   * 获取配额键
   */
  private getKey(tenantId: string, suffix: string): string {
    return `${this.KEY_PREFIX}${tenantId}:${suffix}`;
  }

  /**
   * 初始化租户配额
   */
  async initQuota(tenantId: string, tier: TenantTier = 'standard'): Promise<void> {
    if (!this.redis) {
      return;
    }

    const quota = DEFAULT_QUOTAS[tier];
    const baseKey = this.getKey(tenantId, 'usage');

    const usage: QuotaUsage = {
      tenantId,
      cpuUsed: 0,
      memoryUsed: 0,
      runnersActive: 0,
      queueDepth: 0,
      tokenUsed: 0,
      apiCalls: 0,
      hoursUsed: 0,
      lastUpdated: new Date(),
    };

    await this.redis.set(baseKey, JSON.stringify(usage));
  }

  /**
   * 获取租户配额使用量
   */
  async getUsage(tenantId: string): Promise<QuotaUsage | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const baseKey = this.getKey(tenantId, 'usage');
      const data = await this.redis.get(baseKey);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated),
      };
    } catch (error) {
      console.error(`Failed to get quota usage for tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * 更新配额使用量
   */
  async updateUsage(tenantId: string, updates: Partial<QuotaUsage>): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const baseKey = this.getKey(tenantId, 'usage');
      const current = await this.getUsage(tenantId);

      const updated: QuotaUsage = {
        tenantId,
        cpuUsed: updates.cpuUsed ?? current?.cpuUsed ?? 0,
        memoryUsed: updates.memoryUsed ?? current?.memoryUsed ?? 0,
        runnersActive: updates.runnersActive ?? current?.runnersActive ?? 0,
        queueDepth: updates.queueDepth ?? current?.queueDepth ?? 0,
        tokenUsed: updates.tokenUsed ?? current?.tokenUsed ?? 0,
        apiCalls: updates.apiCalls ?? current?.apiCalls ?? 0,
        hoursUsed: updates.hoursUsed ?? current?.hoursUsed ?? 0,
        lastUpdated: new Date(),
      };

      await this.redis.set(baseKey, JSON.stringify(updated));
    } catch (error) {
      console.error(`Failed to update quota usage for tenant ${tenantId}:`, error);
    }
  }

  /**
   * 增加 Runner 计数
   */
  async incrementRunners(tenantId: string, count: number = 1): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'runners');
    const newValue = await this.redis.incrby(key, count);

    // 设置过期时间（防止泄漏）
    await this.redis.expire(key, 3600);

    // 同步更新使用量
    await this.updateUsage(tenantId, { runnersActive: newValue });

    return newValue;
  }

  /**
   * 减少 Runner 计数
   */
  async decrementRunners(tenantId: string, count: number = 1): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'runners');
    const newValue = await this.redis.incrby(key, -count);

    // 同步更新使用量
    await this.updateUsage(tenantId, { runnersActive: Math.max(0, newValue) });

    return Math.max(0, newValue);
  }

  /**
   * 获取当前 Runner 数
   */
  async getRunnersCount(tenantId: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'runners');
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * 增加 Token 使用量
   */
  async incrementTokens(tenantId: string, count: number): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'tokens:daily');
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${key}:${today}`;

    const newValue = await this.redis.incrby(dailyKey, count);

    // 设置过期时间（24 小时）
    await this.redis.expire(dailyKey, 86400);

    // 同步更新使用量
    const usage = await this.getUsage(tenantId);
    await this.updateUsage(tenantId, {
      tokenUsed: (usage?.tokenUsed ?? 0) + count,
    });

    return newValue;
  }

  /**
   * 获取今日 Token 使用量
   */
  async getTokenUsage(tenantId: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'tokens:daily');
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${key}:${today}`;

    const value = await this.redis.get(dailyKey);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * 增加 API 调用计数（用于 QPS 限制）
   */
  async incrementApiCalls(tenantId: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const now = Date.now();
    const key = this.getKey(tenantId, `api:qps:${now}`);

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 1); // 1 秒过期
    }

    // 同步更新总调用数
    const usage = await this.getUsage(tenantId);
    await this.updateUsage(tenantId, {
      apiCalls: (usage?.apiCalls ?? 0) + 1,
    });

    return count;
  }

  /**
   * 获取当前 QPS
   */
  async getCurrentQps(tenantId: string): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const now = Date.now();
    const key = this.getKey(tenantId, `api:qps:${now}`);
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * 增加队列深度
   */
  async incrementQueue(tenantId: string, count: number = 1): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'queue');
    const newValue = await this.redis.incrby(key, count);

    // 同步更新使用量
    await this.updateUsage(tenantId, { queueDepth: newValue });

    return newValue;
  }

  /**
   * 减少队列深度
   */
  async decrementQueue(tenantId: string, count: number = 1): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    const key = this.getKey(tenantId, 'queue');
    const newValue = await this.redis.incrby(key, -count);

    // 同步更新使用量
    await this.updateUsage(tenantId, { queueDepth: Math.max(0, newValue) });

    return Math.max(0, newValue);
  }

  /**
   * 检查 Runner 配额
   */
  async checkRunnerQuota(tenantId: string, quota: TenantQuota): Promise<QuotaCheckResult> {
    const current = await this.getRunnersCount(tenantId);

    if (current >= quota.concurrentRunners) {
      return {
        allowed: false,
        reason: '并发 Runner 数已达上限',
        quotaType: 'concurrentRunners',
        current,
        limit: quota.concurrentRunners,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      quotaType: 'concurrentRunners',
      current,
      limit: quota.concurrentRunners,
      remaining: quota.concurrentRunners - current,
    };
  }

  /**
   * 检查 Token 配额
   */
  async checkTokenQuota(tenantId: string, quota: TenantQuota): Promise<QuotaCheckResult> {
    const current = await this.getTokenUsage(tenantId);

    if (current >= quota.dailyTokenQuota) {
      return {
        allowed: false,
        reason: '今日 Token 配额已耗尽',
        quotaType: 'dailyTokenQuota',
        current,
        limit: quota.dailyTokenQuota,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      quotaType: 'dailyTokenQuota',
      current,
      limit: quota.dailyTokenQuota,
      remaining: quota.dailyTokenQuota - current,
    };
  }

  /**
   * 检查 QPS 配额
   */
  async checkQpsQuota(tenantId: string, quota: TenantQuota): Promise<QuotaCheckResult> {
    const current = await this.getCurrentQps(tenantId);

    if (current >= quota.apiQps) {
      return {
        allowed: false,
        reason: `API 调用频率超限 (${quota.apiQps} QPS)`,
        quotaType: 'apiQps',
        current,
        limit: quota.apiQps,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      quotaType: 'apiQps',
      current,
      limit: quota.apiQps,
      remaining: quota.apiQps - current,
    };
  }

  /**
   * 检查队列深度配额
   */
  async checkQueueQuota(tenantId: string, quota: TenantQuota): Promise<QuotaCheckResult> {
    const usage = await this.getUsage(tenantId);
    const current = usage?.queueDepth ?? 0;

    if (current >= quota.queueDepth) {
      return {
        allowed: false,
        reason: `队列深度已达上限 (${quota.queueDepth})`,
        quotaType: 'queueDepth',
        current,
        limit: quota.queueDepth,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      quotaType: 'queueDepth',
      current,
      limit: quota.queueDepth,
      remaining: quota.queueDepth - current,
    };
  }

  /**
   * 综合配额检查
   */
  async checkAllQuotas(tenantId: string, quota: TenantQuota): Promise<QuotaCheckResult> {
    const checks = [
      await this.checkRunnerQuota(tenantId, quota),
      await this.checkTokenQuota(tenantId, quota),
      await this.checkQpsQuota(tenantId, quota),
      await this.checkQueueQuota(tenantId, quota),
    ];

    for (const check of checks) {
      if (!check.allowed) {
        return check;
      }
    }

    return { allowed: true };
  }

  /**
   * 检查配额使用率并返回预警
   */
  async checkQuotaAlerts(tenantId: string, quota: TenantQuota): Promise<QuotaAlert[]> {
    const alerts: QuotaAlert[] = [];
    const usage = await this.getUsage(tenantId);

    if (!usage) {
      return alerts;
    }

    // 检查 Runner 使用率
    if (quota.concurrentRunners > 0) {
      const percent = usage.runnersActive / quota.concurrentRunners;
      if (percent >= this.ALERT_THRESHOLD_WARNING) {
        alerts.push({
          tenantId,
          quotaType: 'concurrentRunners',
          usagePercent: percent * 100,
          threshold: this.ALERT_THRESHOLD_WARNING * 100,
          alertedAt: new Date(),
        });
      }
    }

    // 检查 Token 使用率
    if (quota.dailyTokenQuota > 0) {
      const percent = usage.tokenUsed / quota.dailyTokenQuota;
      if (percent >= this.ALERT_THRESHOLD_WARNING) {
        alerts.push({
          tenantId,
          quotaType: 'dailyTokenQuota',
          usagePercent: percent * 100,
          threshold: this.ALERT_THRESHOLD_WARNING * 100,
          alertedAt: new Date(),
        });
      }
    }

    // 检查队列使用率
    if (quota.queueDepth > 0) {
      const percent = usage.queueDepth / quota.queueDepth;
      if (percent >= this.ALERT_THRESHOLD_WARNING) {
        alerts.push({
          tenantId,
          quotaType: 'queueDepth',
          usagePercent: percent * 100,
          threshold: this.ALERT_THRESHOLD_WARNING * 100,
          alertedAt: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * 获取所有租户配额状态（用于监控）
   */
  async getAllTenantsQuotaStatus(tenantIds: string[]): Promise<Map<string, QuotaUsage>> {
    const result = new Map<string, QuotaUsage>();

    for (const tenantId of tenantIds) {
      const usage = await this.getUsage(tenantId);
      if (usage) {
        result.set(tenantId, usage);
      }
    }

    return result;
  }

  /**
   * 重置租户配额（用于测试或手动重置）
   */
  async resetQuota(tenantId: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const keys = [
      this.getKey(tenantId, 'usage'),
      this.getKey(tenantId, 'runners'),
      this.getKey(tenantId, 'tokens:daily'),
      this.getKey(tenantId, 'queue'),
    ];

    for (const key of keys) {
      await this.redis.del(key);
    }
  }
}

// 导出单例
export const tenantQuotaService = new TenantQuotaService();
