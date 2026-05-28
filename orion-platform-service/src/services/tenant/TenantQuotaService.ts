/**
 * TenantQuotaService - 租户配额管理服务
 *
 * 功能：
 * - Runner 配额检查
 * - 资源使用量统计
 * - 配额超限告警
 */

import { EventEmitter } from 'events';
import { TenantQuotaRepository, TenantQuotaEntity } from '../../repositories/TenantQuotaRepository';
import pino from 'pino';

const logger = pino({ name: 'LTenant-LQuota-LService' });

export interface TenantQuota {
  tenantId: number;
  maxPipelines: number;
  maxPipelineRunsPerDay: number;
  maxConcurrentRuns: number;
  maxTasksPerPipeline: number;
  maxRunners: number;
  maxCpuCores: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxNamespaces: number;
  apiRateLimit: number;
  apiRateLimitWindowSeconds: number;
}

export interface TenantUsage {
  tenantId: number;
  resourceType: string;
  resourceKey: string;
  currentValue: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  quotaLimit: number;
  remaining: number;
  message?: string;
}

export interface QuotaAlert {
  tenantId: number;
  resourceType: string;
  currentUsage: number;
  quotaLimit: number;
  thresholdPercent: number;
  timestamp: Date;
}

const DEFAULT_QUOTA: TenantQuota = {
  tenantId: 0,
  maxPipelines: 100,
  maxPipelineRunsPerDay: 1000,
  maxConcurrentRuns: 10,
  maxTasksPerPipeline: 50,
  maxRunners: 5,
  maxCpuCores: 16,
  maxMemoryGb: 32,
  maxStorageGb: 100,
  maxNamespaces: 10,
  apiRateLimit: 1000,
  apiRateLimitWindowSeconds: 60,
};

const ALERT_THRESHOLD_PERCENT = 80;

/**
 * TenantQuotaService - 租户配额服务
 */
export class TenantQuotaService extends EventEmitter {
  private repository: TenantQuotaRepository | null = null;
  // in-memory fallback for tests and environments without DB
  private quotas: Map<number, TenantQuota> = new Map();
  // usage map kept for rate limiting (in-memory by design)
  private usage: Map<string, TenantUsage> = new Map();
  private alertThreshold: number = ALERT_THRESHOLD_PERCENT;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super();
    if (db) {
      this.repository = new TenantQuotaRepository(db);
    }
  }

  /**
   * 获取租户配额配置
   */
  async getQuota(tenantId: number, tenantUuid?: string): Promise<TenantQuota> {
    if (this.repository) {
      // Try UUID first (primary key)
      if (tenantUuid && this.isUuid(tenantUuid)) {
        const uuidEntity = await this.repository.findByTenantId(tenantUuid);
        if (uuidEntity) {
          return this.mapEntityToQuota(uuidEntity);
        }
      }
      // Fallback to numeric ID only if it looks like a valid UUID or short ID
      if (tenantId > 0) {
        const entity = await this.repository.findByTenantId(String(tenantId));
        if (entity) {
          return this.mapEntityToQuota(entity);
        }
      }
    }
    // in-memory fallback (tests / no-DB environments)
    const cached = this.quotas.get(tenantId);
    if (cached) {
      return cached;
    }
    return { ...DEFAULT_QUOTA, tenantId };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private mapEntityToQuota(entity: TenantQuotaEntity): TenantQuota {
    return {
      tenantId: Number(entity.tenantId),
      maxPipelines: entity.maxPipelines,
      maxPipelineRunsPerDay: entity.maxPipelineRunsPerDay,
      maxConcurrentRuns: entity.maxConcurrentBuilds,
      maxTasksPerPipeline: entity.maxTasksPerPipeline,
      maxRunners: entity.maxRunners,
      maxCpuCores: entity.maxCpuCores,
      maxMemoryGb: entity.maxMemoryGb,
      maxStorageGb: entity.maxStorageMb / 1024,
      maxNamespaces: entity.maxProjects,
      apiRateLimit: entity.apiRateLimit,
      apiRateLimitWindowSeconds: entity.apiRateLimitWindowSeconds,
    };
  }

  /**
   * 设置租户配额配置
   */
  async setQuota(quota: TenantQuota): Promise<void> {
    if (this.repository) {
      const existing = await this.repository.findByTenantId(String(quota.tenantId));
      const entityData = {
        maxPipelines: quota.maxPipelines,
        maxApiCallsPerHour: quota.apiRateLimit,
        maxConcurrentBuilds: quota.maxConcurrentRuns,
        maxProjects: quota.maxNamespaces,
        maxStorageMb: quota.maxStorageGb * 1024,
        maxCpuCores: quota.maxCpuCores,
        maxMemoryGb: quota.maxMemoryGb,
        maxTasksPerPipeline: quota.maxTasksPerPipeline,
        maxRunners: quota.maxRunners,
        apiRateLimit: quota.apiRateLimit,
        apiRateLimitWindowSeconds: quota.apiRateLimitWindowSeconds,
        maxPipelineRunsPerDay: quota.maxPipelineRunsPerDay,
        usage: existing?.usage ?? {},
      };
      if (existing) {
        await this.repository.update(existing.id, entityData);
      } else {
        await this.repository.create({
          id: `quota_${quota.tenantId}`,
          tenantId: String(quota.tenantId),
          maxUsers: 100,
          ...entityData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } else {
      // in-memory fallback (tests / no-DB environments)
      this.quotas.set(quota.tenantId, quota);
    }
    this.emit('quota:updated', quota);
  }

  /**
   * 检查配额限制
   */
  async checkQuota(
    tenantId: number,
    resourceType: string,
    requestedValue: number = 1
  ): Promise<QuotaCheckResult> {
    const quota = await this.getQuota(tenantId);
    const currentUsage = await this.getCurrentUsage(tenantId, resourceType);
    const limit = this.getQuotaLimit(quota, resourceType);
    const remaining = limit - currentUsage;

    const allowed = currentUsage + requestedValue <= limit;

    // Check if we need to emit an alert
    const usagePercent = (currentUsage / limit) * 100;
    if (usagePercent >= this.alertThreshold && !allowed) {
      this.emitAlert(tenantId, resourceType, currentUsage, limit, usagePercent);
    }

    return {
      allowed,
      currentUsage,
      quotaLimit: limit,
      remaining,
      message: allowed ? undefined : `Quota exceeded: ${resourceType} limit is ${limit}`,
    };
  }

  /**
   * 检查 Runner 配额
   */
  async checkRunnerQuota(tenantId: number, requestedRunners: number = 1): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'runners', requestedRunners);
  }

  /**
   * 检查并发 Pipeline 运行配额
   */
  async checkConcurrentRunsQuota(
    tenantId: number,
    requestedRuns: number = 1
  ): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'concurrent_runs', requestedRuns);
  }

  /**
   * 检查 Namespace 配额
   */
  async checkNamespaceQuota(
    tenantId: number,
    requestedNamespaces: number = 1
  ): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'namespaces', requestedNamespaces);
  }

  /**
   * 检查 Pipeline 配额
   */
  async checkPipelineQuota(tenantId: number, requestedPipelines: number = 1): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'pipelines', requestedPipelines);
  }

  /**
   * 检查 API 速率限制
   */
  async checkApiRateLimit(tenantId: number): Promise<QuotaCheckResult> {
    const quota = await this.getQuota(tenantId);
    const windowIndex = Math.floor(Date.now() / (quota.apiRateLimitWindowSeconds * 1000));
    const key = `${tenantId}:api_rate:${windowIndex}`;

    const currentUsage = this.usage.get(key)?.currentValue || 0;
    const limit = quota.apiRateLimit;

    return {
      allowed: currentUsage < limit,
      currentUsage,
      quotaLimit: limit,
      remaining: limit - currentUsage,
      message: currentUsage >= limit ? `Rate limit exceeded: ${limit} requests per ${quota.apiRateLimitWindowSeconds}s` : undefined,
    };
  }

  /**
   * 记录资源使用
   */
  recordUsage(
    tenantId: number,
    resourceType: string,
    resourceKey: string,
    value: number,
    windowStart: Date,
    windowEnd: Date
  ): void {
    const key = `${tenantId}:${resourceType}:${resourceKey}`;
    this.usage.set(key, {
      tenantId,
      resourceType,
      resourceKey,
      currentValue: value,
      windowStart,
      windowEnd,
    });
    this.emit('usage:recorded', { tenantId, resourceType, resourceKey, value });
  }

  /**
   * 增加资源使用计数
   */
  incrementUsage(tenantId: number, resourceType: string, resourceKey: string): number {
    const key = `${tenantId}:${resourceType}:${resourceKey}`;
    const current = this.usage.get(key);
    const newValue = (current?.currentValue || 0) + 1;

    this.recordUsage(
      tenantId,
      resourceType,
      resourceKey,
      newValue,
      current?.windowStart || new Date(),
      current?.windowEnd || new Date(Date.now() + 3600000)
    );

    return newValue;
  }

  /**
   * 获取当前使用量
   */
  async getCurrentUsage(tenantId: number, resourceType: string): Promise<number> {
    switch (resourceType) {
      case 'pipelines':
        return this.countResource(tenantId, 'pipelines');
      case 'concurrent_runs':
        return this.countResource(tenantId, 'concurrent_runs');
      case 'runners':
        return this.countResource(tenantId, 'runners');
      case 'namespaces':
        return this.countResource(tenantId, 'namespaces');
      default:
        return 0;
    }
  }

  /**
   * 统计资源数量
   */
  private countResource(tenantId: number, resourceType: string): number {
    let count = 0;
    for (const [key, usage] of this.usage.entries()) {
      if (key.startsWith(`${tenantId}:${resourceType}:`)) {
        count += usage.currentValue;
      }
    }
    return count;
  }

  /**
   * 获取配额限制值
   */
  private getQuotaLimit(quota: TenantQuota, resourceType: string): number {
    switch (resourceType) {
      case 'pipelines':
        return quota.maxPipelines;
      case 'concurrent_runs':
        return quota.maxConcurrentRuns;
      case 'runners':
        return quota.maxRunners;
      case 'namespaces':
        return quota.maxNamespaces;
      case 'pipeline_runs_per_day':
        return quota.maxPipelineRunsPerDay;
      case 'tasks_per_pipeline':
        return quota.maxTasksPerPipeline;
      case 'cpu_cores':
        return quota.maxCpuCores;
      case 'memory_gb':
        return quota.maxMemoryGb;
      case 'storage_gb':
        return quota.maxStorageGb;
      default:
        return 0;
    }
  }

  /**
   * 发送配额告警
   */
  private emitAlert(
    tenantId: number,
    resourceType: string,
    currentUsage: number,
    quotaLimit: number,
    thresholdPercent: number
  ): void {
    const alert: QuotaAlert = {
      tenantId,
      resourceType,
      currentUsage,
      quotaLimit,
      thresholdPercent,
      timestamp: new Date(),
    };

    this.emit('quota:alert', alert);
    logger.warn(`[TenantQuotaService] Quota alert: Tenant ${tenantId} ${resourceType} usage at ${thresholdPercent.toFixed(1)}% (${currentUsage}/${quotaLimit})`);
  }

  /**
   * 获取租户资源使用报告
   */
  async getUsageReport(tenantId: number): Promise<{
    quota: TenantQuota;
    usage: Record<string, number>;
    alerts: QuotaAlert[];
  }> {
    const quota = await this.getQuota(tenantId);
    const usage: Record<string, number> = {};

    // Calculate usage for each resource type
    for (const resourceType of ['pipelines', 'concurrent_runs', 'runners', 'namespaces']) {
      usage[resourceType] = this.countResource(tenantId, resourceType);
    }

    // Calculate usage percentages and generate alerts
    const alerts: QuotaAlert[] = [];
    for (const [type, value] of Object.entries(usage)) {
      const limit = this.getQuotaLimit(quota, type);
      const percent = (value / limit) * 100;
      if (percent >= this.alertThreshold) {
        alerts.push({
          tenantId,
          resourceType: type,
          currentUsage: value,
          quotaLimit: limit,
          thresholdPercent: percent,
          timestamp: new Date(),
        });
      }
    }

    return { quota, usage, alerts };
  }

  /**
   * 设置告警阈值
   */
  setAlertThreshold(percent: number): void {
    this.alertThreshold = percent;
  }

  /**
   * 清理过期使用记录
   */
  cleanupExpiredUsage(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [key, usage] of this.usage.entries()) {
      if (usage.windowEnd < now) {
        this.usage.delete(key);
        cleaned++;
      }
    }

    this.emit('usage:cleanup', cleaned);
    return cleaned;
  }

  /**
   * 重置租户使用量
   */
  resetTenantUsage(tenantId: number): void {
    for (const [key] of this.usage.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.usage.delete(key);
      }
    }
    this.emit('usage:reset', tenantId);
  }
}

// 导出单例实例
export const tenantQuotaService = new TenantQuotaService();