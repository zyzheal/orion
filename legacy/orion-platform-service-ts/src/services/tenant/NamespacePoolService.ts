/**
 * NamespacePoolService - K8s Namespace 池管理服务
 *
 * 功能：
 * - Namespace 池分配
 * - 10团队/Namespace分组，100个Namespace池
 * - Namespace 状态管理
 *
 * PostgreSQL Repository 持久化：
 * - 所有分配/释放操作通过 NamespaceAllocationRepository 持久化
 * - 无内存缓存，所有查询实时走 DB
 */

import { EventEmitter } from 'events';
import { OrionError, ErrorCode } from '../../errors';
import { NamespaceAllocationRepository, NamespaceAllocationEntity } from '../../repositories/NamespaceAllocationRepository';

export interface NamespacePoolEntry {
  id: string;
  namespaceName: string;
  clusterId: string;
  tenantId: number | null;
  status: 'available' | 'allocated' | 'reserved';
  purpose?: string;
  labels: Record<string, string>;
  allocatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NamespaceAllocationResult {
  success: boolean;
  namespace?: NamespacePoolEntry;
  error?: string;
}

export interface NamespacePoolConfig {
  poolSize: number;
  namespacePrefix: string;
  clusterId: string;
  reservedNamespaces: string[];
}

const DEFAULT_CONFIG: NamespacePoolConfig = {
  poolSize: 100,
  namespacePrefix: 'orion-ns-',
  clusterId: 'default',
  reservedNamespaces: ['default', 'kube-system', 'kube-public'],
};

/**
 * NamespacePoolService - Namespace 池服务（PostgreSQL 持久化，无内存缓存）
 */
export class NamespacePoolService extends EventEmitter {
  private config: NamespacePoolConfig;
  private repository: NamespaceAllocationRepository;

  constructor(repository: NamespaceAllocationRepository, config: Partial<NamespacePoolConfig> = {}) {
    super();
    if (!repository) throw new OrionError('NamespaceAllocationRepository is required', ErrorCode.INTERNAL_ERROR);
    this.repository = repository;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize pool - no-op in DB-backed mode (pool state is in DB)
   */
  async initialize(): Promise<void> {
    // Pool state is persisted in PostgreSQL; no in-memory cache to load
  }

  private entityToPoolEntry(entity: NamespaceAllocationEntity): NamespacePoolEntry {
    return {
      id: entity.id,
      namespaceName: entity.namespaceName,
      clusterId: entity.clusterId,
      tenantId: entity.tenantId,
      status: entity.status,
      purpose: entity.purpose,
      labels: entity.labels,
      allocatedAt: entity.allocatedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * 分配 Namespace 给租户
   */
  async allocateNamespace(
    tenantId: string | number,
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): Promise<NamespaceAllocationResult> {
    const tenantKey = typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId;

    // 检查租户是否已达上限
    const currentCount = await this.repository.countByTenant(tenantKey);
    if (currentCount >= this.getMaxNamespacesPerTenant()) {
      return {
        success: false,
        error: `Tenant ${tenantKey} has reached maximum namespace allocation (${currentCount}/${this.getMaxNamespacesPerTenant()})`,
      };
    }

    const availableEntity = await this.repository.findAvailable();
    if (!availableEntity) {
      return {
        success: false,
        error: 'No available namespaces in pool',
      };
    }

    try {
      const labels = {
        ...availableEntity.labels,
        ...options.labels,
        'orion.io/tenant': tenantId.toString(),
      };
      const entity = await this.repository.allocate(
        availableEntity.id,
        tenantKey,
        options.purpose || 'tenant-workspace',
        labels,
      );
      const allocatedEntry = this.entityToPoolEntry(entity);
      this.emit('namespace:allocated', { tenantId: tenantKey, namespace: allocatedEntry });
      return { success: true, namespace: allocatedEntry };
    } catch (err) {
      return { success: false, error: `Failed to allocate namespace: ${err}` };
    }
  }

  /**
   * 释放 Namespace
   */
  async releaseNamespace(namespaceName: string): Promise<NamespaceAllocationResult> {
    const entry = await this.repository.findByNamespaceName(namespaceName);
    if (!entry) {
      return {
        success: false,
        error: `Namespace ${namespaceName} not found in pool`,
      };
    }

    if (entry.status === 'reserved') {
      return {
        success: false,
        error: `Cannot release reserved namespace ${namespaceName}`,
      };
    }

    if (entry.status === 'available') {
      return {
        success: false,
        error: `Namespace ${namespaceName} is already available`,
      };
    }

    const tenantId = entry.tenantId;

    try {
      const entity = await this.repository.release(entry.id);
      const releasedEntry = this.entityToPoolEntry(entity);
      releasedEntry.labels = {
        'orion.io/pool': 'true',
        'orion.io/index': entry.labels['orion.io/index'] || '',
      };
      this.emit('namespace:released', { tenantId, namespace: releasedEntry });
      return { success: true, namespace: releasedEntry };
    } catch (err) {
      return { success: false, error: `Failed to release namespace: ${err}` };
    }
  }

  /**
   * 批量分配 Namespace 给租户
   */
  async allocateNamespaces(
    tenantId: number,
    count: number,
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): Promise<NamespaceAllocationResult[]> {
    const results: NamespaceAllocationResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = await this.allocateNamespace(tenantId, options);
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * 获取租户的 Namespace 分配列表
   */
  async getTenantNamespaces(tenantId: number): Promise<NamespacePoolEntry[]> {
    const entities = await this.repository.findByTenantId(tenantId);
    return entities.map(entity => this.entityToPoolEntry(entity));
  }

  /**
   * 获取 Namespace 详情
   */
  async getNamespace(namespaceName: string): Promise<NamespacePoolEntry | null> {
    const entity = await this.repository.findByNamespaceName(namespaceName);
    if (!entity) return null;
    return this.entityToPoolEntry(entity);
  }

  /**
   * 获取池状态（并发查询统计）
   */
  async getPoolStatus(): Promise<{
    total: number;
    available: number;
    allocated: number;
    reserved: number;
    tenantAllocations: Map<number, number>;
  }> {
    const [availableCount, allocatedCount, reservedCount, tenantAllocationCounts] = await Promise.all([
      this.repository.countByStatus('available'),
      this.repository.countByStatus('allocated'),
      this.repository.countByStatus('reserved'),
      this.repository.countAllocationsByTenant(),
    ]);

    return {
      total: this.config.poolSize,
      available: availableCount,
      allocated: allocatedCount,
      reserved: reservedCount,
      tenantAllocations: tenantAllocationCounts,
    };
  }

  /**
   * 更新 Namespace 状态
   */
  async updateNamespaceStatus(
    namespaceName: string,
    status: 'available' | 'allocated' | 'reserved',
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): Promise<NamespacePoolEntry | null> {
    const entry = await this.repository.findByNamespaceName(namespaceName);
    if (!entry) {
      return null;
    }

    const mergedLabels = { ...entry.labels, ...options.labels };
    const entity = await this.repository.updateStatus(
      entry.id,
      status,
      options.purpose ?? entry.purpose ?? null,
      mergedLabels,
    );
    const updatedEntry = this.entityToPoolEntry(entity);
    this.emit('namespace:updated', updatedEntry);

    return updatedEntry;
  }

  validateNamespaceAccess(namespaceName: string, tenantId: number): Promise<boolean> {
    return this.repository.findByNamespaceName(namespaceName).then(entry => {
      if (!entry) {
        return false;
      }

      if (tenantId === 0) {
        return true;
      }

      return entry.tenantId === tenantId;
    });
  }

  getConfig(): NamespacePoolConfig {
    return { ...this.config };
  }

  /**
   * 重新初始化池（用于配置变更）
   */
  async reinitialize(config: Partial<NamespacePoolConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Pool state is persisted in PostgreSQL; no in-memory cache to clear or reload
    this.emit('pool:reinitialized', this.config.poolSize);
  }

  private getMaxNamespacesPerTenant(): number {
    return Math.floor(this.config.poolSize / 10);
  }
}
