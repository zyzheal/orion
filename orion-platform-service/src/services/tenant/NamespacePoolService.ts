/**
 * NamespacePoolService - K8s Namespace 池管理服务
 *
 * 功能：
 * - Namespace 池分配
 * - 10团队/Namespace分组，100个Namespace池
 * - Namespace 状态管理
 */

import { EventEmitter } from 'events';

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
  private pool: Map<string, NamespacePoolEntry> = new Map();
  private tenantAllocations: Map<number, Set<string>> = new Map();

  constructor(config: Partial<NamespacePoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializePool();
  }

  /**
   * 初始化 Namespace 池
   */
  private initializePool(): void {
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
  allocateNamespace(
    tenantId: number,
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): NamespaceAllocationResult {
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

    // Allocate the namespace
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

    // Update pool
    this.pool.set(allocatedEntry.namespaceName, allocatedEntry);

    // Update tenant allocations
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
  releaseNamespace(namespaceName: string): NamespaceAllocationResult {
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

    // Release the namespace
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

    // Update pool
    this.pool.set(namespaceName, releasedEntry);

    // Update tenant allocations
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
  allocateNamespaces(
    tenantId: number,
    count: number,
    options: { purpose?: string; labels?: Record<string, string> } = {}
  ): NamespaceAllocationResult[] {
    const results: NamespaceAllocationResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = this.allocateNamespace(tenantId, options);
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