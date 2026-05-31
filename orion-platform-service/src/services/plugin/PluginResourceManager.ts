/**
 * Plugin Resource Manager
 *
 * 负责管理插件执行的资源配额：
 * - CPU 配额分配
 * - 内存配额分配
 * - 并发执行限制
 * - 配额回收机制
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import {
  ResourceQuota,
  DEFAULT_QUOTA,
  SECURITY_LEVEL_QUOTAS,
  ResourceUsage,
  ExecutionContext,
} from './types';
import { PluginResourceQuotaRepository } from '../../repositories/PluginResourceQuotaRepository';
import { PluginTenantQuotaRepository } from '../../repositories/PluginTenantQuotaRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 配额分配记录
 */
interface QuotaAllocation {
  taskId: string;
  pluginId: string;
  tenantId?: string;
  allocatedAt: Date;
  quota: ResourceQuota;
  currentUsage: ResourceUsage;
}

/**
 * 资源统计
 */
interface ResourceStats {
  totalAllocated: number;
  cpuCoresUsed: number;
  memoryBytesUsed: number;
  activeExecutions: number;
  peakConcurrency: number;
}

/**
 * Plugin Resource Manager
 */
export class PluginResourceManager extends EventEmitter {
  private allocations: Map<string, QuotaAllocation> = new Map();
  private globalQuota: ResourceQuota;
  private stats: ResourceStats;

  /** Plugin quotas - migrated to repository */
  private quotaRepository?: PluginResourceQuotaRepository;
  private pluginQuotas: Map<string, ResourceQuota> = new Map(); // in-memory cache

  // Per-tenant quota tracking
  private tenantAllocations: Map<string, number> = new Map(); // tenantId -> active count (runtime)

  /** Tenant quotas - migrated to repository */
  private tenantQuotaRepository?: PluginTenantQuotaRepository;
  private tenantQuotas: Map<string, ResourceQuota> = new Map(); // in-memory cache
  private defaultTenantQuota: ResourceQuota;

  constructor(options?: { globalQuota?: ResourceQuota; defaultTenantQuota?: ResourceQuota; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    super();
    this.globalQuota = options?.globalQuota || {
      cpuCores: 8,
      memoryBytes: 16 * 1024 * 1024 * 1024, // 16GB
      timeoutMs: 300000, // 5 分钟
      maxConcurrent: 50,
    };
    this.defaultTenantQuota = options?.defaultTenantQuota || {
      cpuCores: 2,
      memoryBytes: 4 * 1024 * 1024 * 1024, // 4GB per tenant
      timeoutMs: 120000,
      maxConcurrent: 10,
    };
    this.stats = {
      totalAllocated: 0,
      cpuCoresUsed: 0,
      memoryBytesUsed: 0,
      activeExecutions: 0,
      peakConcurrency: 0,
    };
    if (options?.db) {
      this.quotaRepository = new PluginResourceQuotaRepository(options.db);
      this.tenantQuotaRepository = new PluginTenantQuotaRepository(options.db);
    }
  }

  /**
   * 获取全局配额
   */
  getGlobalQuota(): ResourceQuota {
    return { ...this.globalQuota };
  }

  /**
   * 获取当前资源统计
   */
  getResourceStats(): ResourceStats {
    return { ...this.stats };
  }

  /**
   * 获取可用资源
   */
  getAvailableResources(): {
    cpuCores: number;
    memoryBytes: number;
    concurrencySlots: number;
  } {
    return {
      cpuCores: this.globalQuota.cpuCores - this.stats.cpuCoresUsed,
      memoryBytes: this.globalQuota.memoryBytes - this.stats.memoryBytesUsed,
      concurrencySlots: this.globalQuota.maxConcurrent - this.stats.activeExecutions,
    };
  }

  /**
   * 设置插件配额
   */
  setPluginQuota(pluginId: string, quota: ResourceQuota): void {
    this.pluginQuotas.set(pluginId, quota);

    // Persist to repository
    if (this.quotaRepository) {
      this.quotaRepository.upsertQuota('plugin', pluginId, {
        cpuCores: quota.cpuCores,
        memoryBytes: quota.memoryBytes,
        timeoutMs: quota.timeoutMs,
        maxConcurrent: quota.maxConcurrent,
      }).catch(() => {/* ignore */});
    }

    logger.info({ pluginId, quota }, 'Plugin quota configured');
  }

  /**
   * 获取插件配额
   */
  getPluginQuota(pluginId: string, securityLevel?: string): ResourceQuota {
    // 优先使用自定义配额
    const customQuota = this.pluginQuotas.get(pluginId);
    if (customQuota) {
      return { ...customQuota };
    }

    // 根据安全等级获取配额
    if (securityLevel && SECURITY_LEVEL_QUOTAS[securityLevel]) {
      return { ...SECURITY_LEVEL_QUOTAS[securityLevel] };
    }

    return { ...DEFAULT_QUOTA };
  }

  /**
   * 设置租户配额
   */
  setTenantQuota(tenantId: string, quota: ResourceQuota): void {
    this.tenantQuotas.set(tenantId, quota);

    // Persist to repository
    if (this.tenantQuotaRepository) {
      this.tenantQuotaRepository.upsertQuota(tenantId, {
        cpuCores: quota.cpuCores,
        memoryBytes: quota.memoryBytes,
        timeoutMs: quota.timeoutMs,
        maxConcurrent: quota.maxConcurrent,
      }).catch(err => {
        logger.warn({ tenantId, error: err }, 'Failed to persist tenant quota to repository');
      });
    } else if (this.quotaRepository) {
      // Fallback to generic quota repository
      this.quotaRepository.upsertQuota('tenant', tenantId, {
        cpuCores: quota.cpuCores,
        memoryBytes: quota.memoryBytes,
        timeoutMs: quota.timeoutMs,
        maxConcurrent: quota.maxConcurrent,
      }).catch(() => {/* ignore */});
    }

    logger.info({ tenantId, quota }, 'Tenant quota configured');
  }

  /**
   * 获取租户配额
   */
  async getTenantQuota(tenantId: string): Promise<ResourceQuota> {
    // Check in-memory cache first
    const cached = this.tenantQuotas.get(tenantId);
    if (cached) {
      return { ...cached };
    }

    // Read from repository
    if (this.tenantQuotaRepository) {
      try {
        const entity = await this.tenantQuotaRepository.findByTenantId(tenantId);
        if (entity) {
          const quota: ResourceQuota = {
            cpuCores: entity.cpuCores,
            memoryBytes: entity.memoryBytes,
            timeoutMs: entity.timeoutMs,
            maxConcurrent: entity.maxConcurrent,
          };
          // Update in-memory cache
          this.tenantQuotas.set(tenantId, quota);
          return { ...quota };
        }
      } catch (err) {
        logger.warn({ tenantId, error: err }, 'Failed to read tenant quota from repository');
      }
    }

    return { ...this.defaultTenantQuota };
  }

  /**
   * 获取租户可用资源
   */
  async getTenantAvailableResources(tenantId: string): Promise<{
    cpuCores: number;
    memoryBytes: number;
    concurrencySlots: number;
  }> {
    const tenantQuota = await this.getTenantQuota(tenantId);
    const tenantActive = this.tenantAllocations.get(tenantId) || 0;
    return {
      cpuCores: tenantQuota.cpuCores,
      memoryBytes: tenantQuota.memoryBytes,
      concurrencySlots: tenantQuota.maxConcurrent - tenantActive,
    };
  }

  /**
   * 检查租户配额
   */
  async canAllocateForTenant(tenantId: string, quota: ResourceQuota): Promise<{ canAllocate: boolean; reason?: string }> {
    const tenantQuota = await this.getTenantQuota(tenantId);
    const tenantAvailable = await this.getTenantAvailableResources(tenantId);

    if (tenantAvailable.concurrencySlots <= 0) {
      return {
        canAllocate: false,
        reason: `Tenant ${tenantId} reached max concurrent executions (${tenantQuota.maxConcurrent})`,
      };
    }

    // Also check global quota
    const globalCheck = this.canAllocate(quota);
    if (!globalCheck.canAllocate) {
      return globalCheck;
    }

    return { canAllocate: true };
  }

  /**
   * 分配资源配额（带租户隔离）
   */
  async allocateQuotaForTenant(
    taskId: string,
    pluginId: string,
    tenantId: string,
    securityLevel?: string
  ): Promise<ExecutionContext | null> {
    const quota = this.getPluginQuota(pluginId, securityLevel);

    // Check tenant quota
    const tenantCheck = await this.canAllocateForTenant(tenantId, quota);
    if (!tenantCheck.canAllocate) {
      logger.warn(
        { taskId, pluginId, tenantId, reason: tenantCheck.reason },
        'Failed to allocate quota for tenant'
      );
      this.emit('allocation:failed', {
        taskId,
        pluginId,
        tenantId,
        reason: tenantCheck.reason,
      });
      return null;
    }

    // Track tenant allocation
    const tenantActive = this.tenantAllocations.get(tenantId) || 0;
    this.tenantAllocations.set(tenantId, tenantActive + 1);

    // Use the base allocateQuota logic
    const context = this.allocateQuota(taskId, pluginId, securityLevel);
    if (context) {
      context.tenantId = tenantId;
    }
    return context;
  }

  /**
   * 检查是否可以分配资源
   */
  canAllocate(quota: ResourceQuota): { canAllocate: boolean; reason?: string } {
    const available = this.getAvailableResources();

    if (available.concurrencySlots <= 0) {
      return {
        canAllocate: false,
        reason: `Maximum concurrent executions (${this.globalQuota.maxConcurrent}) reached`,
      };
    }

    if (available.cpuCores < quota.cpuCores) {
      return {
        canAllocate: false,
        reason: `Insufficient CPU: requested ${quota.cpuCores}, available ${available.cpuCores}`,
      };
    }

    if (available.memoryBytes < quota.memoryBytes) {
      return {
        canAllocate: false,
        reason: `Insufficient memory: requested ${this.formatBytes(quota.memoryBytes)}, available ${this.formatBytes(available.memoryBytes)}`,
      };
    }

    return { canAllocate: true };
  }

  /**
   * 分配资源配额
   */
  allocateQuota(
    taskId: string,
    pluginId: string,
    securityLevel?: string,
    tenantId?: string
  ): ExecutionContext | null {
    const quota = this.getPluginQuota(pluginId, securityLevel);

    // 检查是否可以分配
    const check = this.canAllocate(quota);
    if (!check.canAllocate) {
      logger.warn(
        { taskId, pluginId, reason: check.reason },
        'Failed to allocate quota'
      );
      this.emit('allocation:failed', {
        taskId,
        pluginId,
        reason: check.reason,
      });
      return null;
    }

    // 更新统计
    this.stats.cpuCoresUsed += quota.cpuCores;
    this.stats.memoryBytesUsed += quota.memoryBytes;
    this.stats.activeExecutions += 1;
    this.stats.totalAllocated += 1;
    this.stats.peakConcurrency = Math.max(
      this.stats.peakConcurrency,
      this.stats.activeExecutions
    );

    // 创建分配记录
    const allocation: QuotaAllocation = {
      taskId,
      pluginId,
      tenantId,
      allocatedAt: new Date(),
      quota,
      currentUsage: this.createEmptyUsage(),
    };

    this.allocations.set(taskId, allocation);

    const context: ExecutionContext = {
      taskId,
      pluginId,
      pipelineRunId: '',
      stageId: '',
      startedAt: allocation.allocatedAt,
      quota,
    };

    this.emit('allocation:created', { taskId, pluginId, quota });
    logger.info({ taskId, pluginId, quota }, 'Quota allocated');

    return context;
  }

  /**
   * 释放资源配额
   */
  releaseQuota(taskId: string): void {
    const allocation = this.allocations.get(taskId);
    if (!allocation) {
      logger.warn({ taskId }, 'No allocation found to release');
      return;
    }

    // Release the correct tenant's quota slot
    if (allocation.tenantId) {
      const tenantCount = this.tenantAllocations.get(allocation.tenantId) || 0;
      if (tenantCount > 0) {
        if (tenantCount - 1 === 0) {
          this.tenantAllocations.delete(allocation.tenantId);
        } else {
          this.tenantAllocations.set(allocation.tenantId, tenantCount - 1);
        }
      }
    }

    // 更新统计
    this.stats.cpuCoresUsed -= allocation.quota.cpuCores;
    this.stats.memoryBytesUsed -= allocation.quota.memoryBytes;
    this.stats.activeExecutions -= 1;

    // 确保 CPU 和内存使用不为负数
    this.stats.cpuCoresUsed = Math.max(0, this.stats.cpuCoresUsed);
    this.stats.memoryBytesUsed = Math.max(0, this.stats.memoryBytesUsed);

    this.allocations.delete(taskId);

    this.emit('allocation:released', {
      taskId,
      pluginId: allocation.pluginId,
      tenantId: allocation.tenantId,
      duration: Date.now() - allocation.allocatedAt.getTime(),
    });

    logger.info(
      {
        taskId,
        pluginId: allocation.pluginId,
        tenantId: allocation.tenantId,
        durationMs: Date.now() - allocation.allocatedAt.getTime(),
      },
      'Quota released'
    );
  }

  /**
   * 更新资源使用情况
   */
  updateUsage(taskId: string, usage: Partial<ResourceUsage>): void {
    const allocation = this.allocations.get(taskId);
    if (!allocation) {
      logger.warn({ taskId }, 'No allocation found for usage update');
      return;
    }

    allocation.currentUsage = {
      ...allocation.currentUsage,
      ...usage,
      timestamp: new Date(),
    };

    // 检查是否超过配额
    this.checkQuotaViolation(taskId, allocation);
  }

  /**
   * 检查配额违规
   */
  private checkQuotaViolation(taskId: string, allocation: QuotaAllocation): void {
    const { quota, currentUsage } = allocation;

    // 检查内存使用
    const memoryUsedPercent = currentUsage.memoryBytes / quota.memoryBytes;
    if (memoryUsedPercent > 0.9) {
      logger.warn(
        { taskId, memoryUsedPercent },
        'Memory usage approaching limit'
      );
      this.emit('quota:warning', {
        taskId,
        type: 'MEMORY',
        usagePercent: memoryUsedPercent,
      });
    }

    // 检查 CPU 使用（模拟）
    if (currentUsage.cpuPercent > 90) {
      logger.warn({ taskId, cpuPercent: currentUsage.cpuPercent }, 'CPU usage high');
      this.emit('quota:warning', {
        taskId,
        type: 'CPU',
        usagePercent: currentUsage.cpuPercent,
      });
    }
  }

  /**
   * 获取分配详情
   */
  getAllocation(taskId: string): QuotaAllocation | undefined {
    return this.allocations.get(taskId);
  }

  /**
   * 获取所有活跃分配
   */
  getActiveAllocations(): QuotaAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * 强制释放所有分配
   */
  releaseAll(): void {
    const taskIds = Array.from(this.allocations.keys());
    for (const taskId of taskIds) {
      this.releaseQuota(taskId);
    }
    logger.info({ count: taskIds.length }, 'All quotas released');
  }

  /**
   * 创建空的资源使用记录
   */
  private createEmptyUsage(): ResourceUsage {
    return {
      cpuPercent: 0,
      memoryBytes: 0,
      diskBytes: 0,
      networkRxBytes: 0,
      networkTxBytes: 0,
      timestamp: new Date(),
    };
  }

  /**
   * 格式化字节大小
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }
}