/**
 * TenantQuotaService - 租户配额管理服务
 *
 * 功能：
 * - Runner 配额检查
 * - 资源使用量统计
 * - 配额超限告警
 *
 * PostgreSQL Repository 持久化：
 * - 配额配置通过 TenantQuotaRepository 持久化到 tenant_quotas 表
 * - 使用量数据持久化到 tenant_quotas.usage (JSONB) 列
 * - 内存 Map 作为写透缓存，保证读写性能
 */

import { EventEmitter } from 'events';
import { TenantQuotaRepository, TenantQuotaEntity } from '../../repositories/TenantQuotaRepository';
import { createLogger } from '../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'TenantQuotaService' });

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
 *
 * 配额配置和使用量数据均通过 PostgreSQL 持久化。
 * 使用量存储在 tenant_quotas.usage (JSONB) 列中。
 * 内存 Map 作为写透缓存，保证读写性能。
 */
export class TenantQuotaService extends EventEmitter {
  private repository: TenantQuotaRepository;
  // 使用量写透缓存：同步方法写入此处，异步方法从此处读取
  // 持久化到 tenant_quotas.usage JSONB 列
  private usage: Map<string, TenantUsage> = new Map();
  private alertThreshold: number = ALERT_THRESHOLD_PERCENT;
  // 标记是否已从 DB 加载过使用量数据（仅加载一次）
  private usageLoadedFromDb: boolean = false;

  constructor(repository: TenantQuotaRepository) {
    super();
    if (!repository) throw new Error('TenantQuotaRepository is required');
    this.repository = repository;
  }

  // ─── DB 持久化辅助方法 ───────────────────────────────────────────────

  /**
   * 从 DB 加载所有租户的使用量数据到内存 Map（冷启动恢复）
   * 仅在首次异步读取时执行一次，后续读取直接使用内存缓存
   */
  private async loadUsageFromDb(): Promise<void> {
    if (this.usageLoadedFromDb) return;
    try {
      const { entities } = await this.repository.findAll({ limit: 10000 });
      for (const entity of entities) {
        if (entity.usage && typeof entity.usage === 'object') {
          for (const [key, raw] of Object.entries(entity.usage)) {
            const entry = raw as Record<string, unknown>;
            this.usage.set(key, {
              tenantId: Number(entry.tenantId),
              resourceType: String(entry.resourceType),
              resourceKey: String(entry.resourceKey),
              currentValue: Number(entry.currentValue) || 0,
              windowStart: new Date(entry.windowStart as string),
              windowEnd: new Date(entry.windowEnd as string),
            });
          }
        }
      }
      this.usageLoadedFromDb = true;
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err }, '[TenantQuotaService] Failed to load usage from DB, using in-memory only');
      this.usageLoadedFromDb = true;
    }
  }

  /**
   * 将指定租户的使用量数据持久化到 tenant_quotas.usage JSONB 列
   * 作为 fire-and-forget 调用，不阻塞主流程
   */
  private async persistTenantUsage(tenantId: number): Promise<void> {
    try {
      const tenantUsage: Record<string, TenantUsage> = {};
      const prefix = `${tenantId}:`;
      for (const [key, value] of this.usage.entries()) {
        if (key.startsWith(prefix)) {
          tenantUsage[key] = value;
        }
      }

      const entity = await this.repository.findByTenantId(String(tenantId));
      if (entity) {
        await this.repository.update(entity.id, { usage: tenantUsage as Record<string, unknown> });
      }
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err, tenantId }, '[TenantQuotaService] Failed to persist usage to DB');
    }
  }

  /**
   * 重置 DB 中指定租户的使用量数据
   */
  private async resetTenantUsageInDb(tenantId: number): Promise<void> {
    try {
      const entity = await this.repository.findByTenantId(String(tenantId));
      if (entity) {
        await this.repository.update(entity.id, { usage: {} });
      }
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err, tenantId }, '[TenantQuotaService] Failed to reset usage in DB');
    }
  }

  /**
   * 清理 DB 中过期的使用量条目
   */
  private async cleanupExpiredUsageInDb(affectedTenants: Set<number>): Promise<void> {
    try {
      for (const tenantId of affectedTenants) {
        const entity = await this.repository.findByTenantId(String(tenantId));
        if (entity?.usage && typeof entity.usage === 'object') {
          const now = new Date();
          const cleaned: Record<string, unknown> = {};
          for (const [key, raw] of Object.entries(entity.usage)) {
            const entry = raw as Record<string, unknown>;
            const windowEnd = new Date(entry.windowEnd as string);
            if (windowEnd >= now) {
              cleaned[key] = entry;
            }
          }
          await this.repository.update(entity.id, { usage: cleaned });
        }
      }
    } catch (err) {
      logger.warn({ traceId: getCurrentTraceId(), err }, '[TenantQuotaService] Failed to cleanup expired usage in DB');
    }
  }

  // ─── 配额配置方法 ────────────────────────────────────────────────────

  /**
   * 获取租户配额配置
   */
  async getQuota(tenantId: number, tenantUuid?: string): Promise<TenantQuota> {
    if (tenantUuid && this.isUuid(tenantUuid)) {
      const uuidEntity = await this.repository.findByTenantId(tenantUuid);
      if (uuidEntity) {
        return this.mapEntityToQuota(uuidEntity);
      }
    }
    if (tenantId > 0) {
      const entity = await this.repository.findByTenantId(String(tenantId));
      if (entity) {
        return this.mapEntityToQuota(entity);
      }
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
    this.emit('quota:updated', quota);
  }

  // ─── 配额检查方法 ────────────────────────────────────────────────────

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

  async checkRunnerQuota(tenantId: number, requestedRunners: number = 1): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'runners', requestedRunners);
  }

  async checkConcurrentRunsQuota(
    tenantId: number,
    requestedRuns: number = 1
  ): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'concurrent_runs', requestedRuns);
  }

  async checkNamespaceQuota(
    tenantId: number,
    requestedNamespaces: number = 1
  ): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'namespaces', requestedNamespaces);
  }

  async checkPipelineQuota(tenantId: number, requestedPipelines: number = 1): Promise<QuotaCheckResult> {
    return this.checkQuota(tenantId, 'pipelines', requestedPipelines);
  }

  async checkApiRateLimit(tenantId: number): Promise<QuotaCheckResult> {
    await this.loadUsageFromDb();

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

  // ─── 使用量记录方法 ──────────────────────────────────────────────────

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

    this.persistTenantUsage(tenantId).catch(() => {});
  }

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

  async getCurrentUsage(tenantId: number, resourceType: string): Promise<number> {
    await this.loadUsageFromDb();

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

  private countResource(tenantId: number, resourceType: string): number {
    let count = 0;
    for (const [key, usage] of this.usage.entries()) {
      if (key.startsWith(`${tenantId}:${resourceType}:`)) {
        count += usage.currentValue;
      }
    }
    return count;
  }

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
    logger.warn({ traceId: getCurrentTraceId(), tenantId, resourceType, currentUsage, quotaLimit, thresholdPercent: thresholdPercent.toFixed(1) },
      '[TenantQuotaService] Quota alert');
  }

  async getUsageReport(tenantId: number): Promise<{
    quota: TenantQuota;
    usage: Record<string, number>;
    alerts: QuotaAlert[];
  }> {
    await this.loadUsageFromDb();

    const quota = await this.getQuota(tenantId);
    const usage: Record<string, number> = {};

    for (const resourceType of ['pipelines', 'concurrent_runs', 'runners', 'namespaces']) {
      usage[resourceType] = this.countResource(tenantId, resourceType);
    }

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

  setAlertThreshold(percent: number): void {
    this.alertThreshold = percent;
  }

  cleanupExpiredUsage(): number {
    const now = new Date();
    let cleaned = 0;
    const affectedTenants = new Set<number>();

    for (const [key, usage] of this.usage.entries()) {
      if (usage.windowEnd < now) {
        this.usage.delete(key);
        affectedTenants.add(usage.tenantId);
        cleaned++;
      }
    }

    this.emit('usage:cleanup', cleaned);

    if (affectedTenants.size > 0) {
      this.cleanupExpiredUsageInDb(affectedTenants).catch(() => {});
    }

    return cleaned;
  }

  resetTenantUsage(tenantId: number): void {
    for (const [key] of this.usage.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.usage.delete(key);
      }
    }
    this.emit('usage:reset', tenantId);

    this.resetTenantUsageInDb(tenantId).catch(() => {});
  }
}
