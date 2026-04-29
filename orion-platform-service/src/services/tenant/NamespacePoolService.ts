/**
 * NamespacePoolService - K8s Namespace 池管理服务
 *
 * 功能：
 * - Namespace 池分配
 * - 10团队/Namespace分组，100个Namespace池
 * - Namespace 状态管理
 */

import { EventEmitter } from 'events';
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
 * NamespacePoolService - Namespace 池服务
 */
export class NamespacePoolService extends EventEmitter {
  private config: NamespacePoolConfig;
  private repository: NamespaceAllocationRepository | null = null;
  private pool: Map<string, NamespacePoolEntry> = new Map();
  private tenantAllocations: Map<number, Set<string>> = new Map();

  constructor(config: Partial<NamespacePoolConfig> = {}, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (db) {
      this.repository = new NamespaceAllocationRepository(db);
    }
    // For non-DB mode, initialize synchronously
    // For DB mode, call initialize() explicitly
    if (!db) {
      this.initializePoolInMemory();
    }
  }

  /**
   * Initialize pool from database (call when DB is provided)
   */
  async initialize(): Promise<void> {
    await this.initializePoolFromDB();
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
   * 初始化 Namespace 池
   */
  private async initializePool(): Promise<void> {
    if (this.repository) {
      await this.initializePoolFromDB();
    } else {
      this.initializePoolInMemory();
    }
  }

  private async initializePoolFromDB(): Promise<void> {
    const result = await this.repository!.db.query(
      `SELECT * FROM namespace_allocations ORDER BY id ASC`,
    );
    for (const row of result.rows) {
      const entity = this.repository!.mapRowToEntity(row);
      const entry = this.entityToPoolEntry(entity);
      this.pool.set(entry.namespaceName, entry);
      if (entry.status === 'allocated' && entry.tenantId != null) {
        if (!this.tenantAllocations.has(entry.tenantId)) {
          this.tenantAllocations.set(entry.tenantId, new Set());
        }
        this.tenantAllocations.get(entry.tenantId)!.add(entry.namespaceName);
      }
    }
    this.emit('pool:initialized', this.pool.size);
  }

  private initializePoolInMemory(): void {
    // Create 100 namespaces for the pool
    for (let i = 1; i <= this.config.poolSize; i++) {
      const namespaceName = `${this.config.namespacePrefix}${i.toString().padStart(3, '0')}`;
      const entry: NamespacePoolEntry = {
        id: `ns-${i}`,
        namespaceName,
        clusterId: this.config.clusterId,
        tenantId: null,
        status: 'available',
        labels: {
          'orion.io/pool': 'true',
          'orion.io/index': i.toString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.pool.set(namespaceName, entry);
    }

    // Reserve system namespaces
    for (const reserved of this.config.reservedNamespaces) {
      if (this.pool.has(reserved)) {
        const entry = this.pool.get(reserved)!;
        entry.status = 'reserved';
        entry.purpose = 'system';
        this.pool.set(reserved, entry);
      }
    }

    this.emit('pool:initialized', this.config.poolSize);
  }

  /**
   * 分配 Namespace 给租户
   */
  async allocateNamespace(
    tenantId: number,
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): Promise<NamespaceAllocationResult> {
    // Check tenant quota first
    const tenantNamespaces = this.tenantAllocations.get(tenantId) || new Set();
    if (tenantNamespaces.size >= this.getMaxNamespacesPerTenant()) {
      return {
        success: false,
        error: `Tenant ${tenantId} has reached maximum namespace allocation (${tenantNamespaces.size}/${this.getMaxNamespacesPerTenant()})`,
      };
    }

    // Find available namespace
    const availableEntry = this.findAvailableNamespace();
    if (!availableEntry) {
      return {
        success: false,
        error: 'No available namespaces in pool',
      };
    }

    // Persist allocation
    if (this.repository) {
      try {
        const labels = {
          ...availableEntry.labels,
          ...options.labels,
          'orion.io/tenant': tenantId.toString(),
        };
        const entity = await this.repository.allocate(
          availableEntry.id,
          tenantId,
          options.purpose || 'tenant-workspace',
          labels,
        );
        const allocatedEntry = this.entityToPoolEntry(entity);
        this.pool.set(allocatedEntry.namespaceName, allocatedEntry);
        if (!this.tenantAllocations.has(tenantId)) {
          this.tenantAllocations.set(tenantId, new Set());
        }
        this.tenantAllocations.get(tenantId)!.add(allocatedEntry.namespaceName);
        this.emit('namespace:allocated', { tenantId, namespace: allocatedEntry });
        return { success: true, namespace: allocatedEntry };
      } catch (err) {
        return { success: false, error: `Failed to allocate namespace: ${err}` };
      }
    }

    // in-memory fallback
    const allocatedEntry: NamespacePoolEntry = {
      ...availableEntry,
      tenantId,
      status: 'allocated',
      purpose: options.purpose || 'tenant-workspace',
      labels: {
        ...availableEntry.labels,
        ...options.labels,
        'orion.io/tenant': tenantId.toString(),
      },
      allocatedAt: new Date(),
      updatedAt: new Date(),
    };

    this.pool.set(allocatedEntry.namespaceName, allocatedEntry);
    if (!this.tenantAllocations.has(tenantId)) {
      this.tenantAllocations.set(tenantId, new Set());
    }
    this.tenantAllocations.get(tenantId)!.add(allocatedEntry.namespaceName);
    this.emit('namespace:allocated', { tenantId, namespace: allocatedEntry });

    return {
      success: true,
      namespace: allocatedEntry,
    };
  }

  /**
   * 释放 Namespace
   */
  async releaseNamespace(namespaceName: string): Promise<NamespaceAllocationResult> {
    const entry = this.pool.get(namespaceName);
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

    // Persist release
    if (this.repository) {
      try {
        const entity = await this.repository.release(entry.id);
        const releasedEntry = this.entityToPoolEntry(entity);
        releasedEntry.labels = {
          'orion.io/pool': 'true',
          'orion.io/index': entry.labels['orion.io.index'] || '',
        };
        this.pool.set(namespaceName, releasedEntry);
        if (tenantId && this.tenantAllocations.has(tenantId)) {
          this.tenantAllocations.get(tenantId)!.delete(namespaceName);
          if (this.tenantAllocations.get(tenantId)!.size === 0) {
            this.tenantAllocations.delete(tenantId);
          }
        }
        this.emit('namespace:released', { tenantId, namespace: releasedEntry });
        return { success: true, namespace: releasedEntry };
      } catch (err) {
        return { success: false, error: `Failed to release namespace: ${err}` };
      }
    }

    // in-memory fallback
    const releasedEntry: NamespacePoolEntry = {
      ...entry,
      tenantId: null,
      status: 'available',
      purpose: undefined,
      labels: {
        'orion.io/pool': 'true',
        'orion.io/index': entry.labels['orion.io/index'],
      },
      allocatedAt: undefined,
      updatedAt: new Date(),
    };

    this.pool.set(namespaceName, releasedEntry);
    if (tenantId && this.tenantAllocations.has(tenantId)) {
      this.tenantAllocations.get(tenantId)!.delete(namespaceName);
      if (this.tenantAllocations.get(tenantId)!.size === 0) {
        this.tenantAllocations.delete(tenantId);
      }
    }

    this.emit('namespace:released', { tenantId, namespace: releasedEntry });

    return {
      success: true,
      namespace: releasedEntry,
    };
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
  getTenantNamespaces(tenantId: number): NamespacePoolEntry[] {
    const namespaceNames = this.tenantAllocations.get(tenantId) || new Set();
    const namespaces: NamespacePoolEntry[] = [];

    for (const name of namespaceNames) {
      const entry = this.pool.get(name);
      if (entry) {
        namespaces.push(entry);
      }
    }

    return namespaces;
  }

  /**
   * 获取 Namespace 详情
   */
  getNamespace(namespaceName: string): NamespacePoolEntry | null {
    return this.pool.get(namespaceName) || null;
  }

  /**
   * 获取池状态
   */
  getPoolStatus(): {
    total: number;
    available: number;
    allocated: number;
    reserved: number;
    tenantAllocations: Map<number, number>;
  } {
    let available = 0;
    let allocated = 0;
    let reserved = 0;

    for (const entry of this.pool.values()) {
      switch (entry.status) {
        case 'available':
          available++;
          break;
        case 'allocated':
          allocated++;
          break;
        case 'reserved':
          reserved++;
          break;
      }
    }

    const tenantAllocationCounts = new Map<number, number>();
    for (const [tenantId, namespaces] of this.tenantAllocations.entries()) {
      tenantAllocationCounts.set(tenantId, namespaces.size);
    }

    return {
      total: this.config.poolSize,
      available,
      allocated,
      reserved,
      tenantAllocations: tenantAllocationCounts,
    };
  }

  /**
   * 查找可用的 Namespace
   */
  private findAvailableNamespace(): NamespacePoolEntry | null {
    for (const entry of this.pool.values()) {
      if (entry.status === 'available') {
        return entry;
      }
    }
    return null;
  }

  /**
   * 获取每个租户最大 Namespace 数量
   */
  private getMaxNamespacesPerTenant(): number {
    // 10 teams, 100 namespaces pool -> max 10 namespaces per tenant
    return Math.floor(this.config.poolSize / 10);
  }

  /**
   * 更新 Namespace 状态
   */
  updateNamespaceStatus(
    namespaceName: string,
    status: 'available' | 'allocated' | 'reserved',
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): NamespacePoolEntry | null {
    const entry = this.pool.get(namespaceName);
    if (!entry) {
      return null;
    }

    const updatedEntry: NamespacePoolEntry = {
      ...entry,
      status,
      purpose: options.purpose || entry.purpose,
      labels: { ...entry.labels, ...options.labels },
      updatedAt: new Date(),
    };

    this.pool.set(namespaceName, updatedEntry);
    this.emit('namespace:updated', updatedEntry);

    return updatedEntry;
  }

  /**
   * 验证 Namespace 访问权限
   */
  validateNamespaceAccess(namespaceName: string, tenantId: number): boolean {
    const entry = this.pool.get(namespaceName);
    if (!entry) {
      return false;
    }

    // System tenant can access all namespaces
    if (tenantId === 0) {
      return true;
    }

    return entry.tenantId === tenantId;
  }

  /**
   * 获取配置
   */
  getConfig(): NamespacePoolConfig {
    return { ...this.config };
  }

  /**
   * 重新初始化池（用于配置变更）
   */
  reinitialize(config: Partial<NamespacePoolConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pool.clear();
    this.tenantAllocations.clear();
    this.initializePool();
    this.emit('pool:reinitialized', this.config.poolSize);
  }
}

// 导出单例实例
export const namespacePoolService = new NamespacePoolService();