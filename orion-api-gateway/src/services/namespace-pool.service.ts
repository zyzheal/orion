/**
 * Namespace Pool 管理服务
 *
 * 实现租户到 Namespace 池的分配算法：
 * - 100 个 Namespace 池，每池容纳 10 个租户
 * - 支持自动分配、查询、回收
 * - 追踪池资源使用率
 *
 * 命名规范：orion-tenant-pool-{001-100}
 */

import { Redis } from 'ioredis';
import { redisClient } from '../utils/redis';

/**
 * Namespace 池信息
 */
export interface NamespacePool {
  id: string;              // 池 ID，如：orion-tenant-pool-001
  poolIndex: number;       // 池索引 (1-100)
  tenantRange: {           // 租户范围
    start: number;         // 起始租户序号
    end: number;           // 结束租户序号
  };
  tenantCount: number;     // 当前租户数
  maxTenants: number;      // 最大租户数 (10)
  resourceUsage: {         // 资源使用率
    cpuPercent: number;
    memoryPercent: number;
  };
  status: 'active' | 'full' | 'maintenance';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 租户分配信息
 */
export interface TenantAllocation {
  tenantId: string;
  tenantSeq: number;       // 租户序号 (1-1000)
  poolId: string;
  poolIndex: number;
  allocatedAt: Date;
}

/**
 * Namespace 池管理器
 */
export class NamespacePoolManager {
  private redis: Redis | null = null;
  private readonly POOL_PREFIX = 'namespace:pool:';
  private readonly ALLOCATION_PREFIX = 'namespace:allocation:';
  private readonly MAX_POOLS = 100;
  private readonly MAX_TENANTS_PER_POOL = 10;

  constructor() {
    const client = redisClient.getClient();
    if (client) {
      this.redis = client;
    }
  }

  /**
   * 设置 Redis 客户端
   */
  setRedisClient(client: Redis): void {
    this.redis = client;
  }

  /**
   * 根据租户 ID 计算池索引
   * 规则：每 10 个租户共享一个池
   * t001-t010 -> pool-001
   * t011-t020 -> pool-002
   * t991-t1000 -> pool-100
   */
  calculatePoolIndex(tenantSeq: number): number {
    return Math.ceil(tenantSeq / this.MAX_TENANTS_PER_POOL);
  }

  /**
   * 生成池 ID
   */
  generatePoolId(poolIndex: number): string {
    return `orion-tenant-pool-${String(poolIndex).padStart(3, '0')}`;
  }

  /**
   * 解析租户序号从租户 ID
   * 支持格式：t001, t002, ..., t1000
   * 或：tenant-001, tenant-002, 等
   */
  parseTenantSeq(tenantId: string): number | null {
    // 匹配 t001, t002 等格式
    const match = tenantId.match(/^t(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }

    // 匹配 tenant-001, tenant-002 等格式
    const match2 = tenantId.match(/^tenant-(\d+)$/i);
    if (match2) {
      return parseInt(match2[1], 10);
    }

    return null;
  }

  /**
   * 为租户分配 Namespace 池
   * 返回分配的池 ID 和分配信息
   */
  async allocatePool(tenantId: string): Promise<TenantAllocation | null> {
    if (!this.redis) {
      // Redis 不可用时，返回默认分配
      return this.createDefaultAllocation(tenantId);
    }

    try {
      // 解析租户序号
      let tenantSeq = this.parseTenantSeq(tenantId);
      if (tenantSeq === null) {
        tenantSeq = await this.generateTenantSeq(tenantId);
      }
      const poolIndex = this.calculatePoolIndex(tenantSeq);
      const poolId = this.generatePoolId(poolIndex);

      // 检查池是否存在
      const poolKey = this.getPoolKey(poolId);
      const poolExists = await this.redis.exists(poolKey);

      if (!poolExists) {
        // 创建新池
        await this.createPool(poolIndex);
      }

      // 检查池是否已满
      const pool = await this.getPool(poolId);
      if (pool && pool.status === 'full') {
        // 池已满，尝试分配到下一个有空位的池
        const availablePool = await this.findAvailablePool();
        if (availablePool) {
          return this.assignTenantToPool(tenantId, tenantSeq, availablePool.poolIndex);
        }
        return null; // 无可用池
      }

      // 分配租户到池
      return this.assignTenantToPool(tenantId, tenantSeq, poolIndex);
    } catch (error) {
      console.error('Failed to allocate namespace pool:', error);
      return this.createDefaultAllocation(tenantId);
    }
  }

  /**
   * 生成租户序号（对于非标准格式的租户 ID）
   */
  private async generateTenantSeq(tenantId: string): Promise<number> {
    if (!this.redis) {
      return 1;
    }

    // 检查是否已有分配
    const allocationKey = this.getAllocationKey(tenantId);
    const existing = await this.redis.get(allocationKey);
    if (existing) {
      const allocation: TenantAllocation = JSON.parse(existing);
      return allocation.tenantSeq;
    }

    // 生成新序号（基于 hash）
    const hash = this.hashCode(tenantId);
    return (Math.abs(hash) % (this.MAX_POOLS * this.MAX_TENANTS_PER_POOL)) + 1;
  }

  /**
   * 创建默认分配
   */
  private createDefaultAllocation(tenantId: string): TenantAllocation {
    const tenantSeq = this.parseTenantSeq(tenantId) || 1;
    const poolIndex = this.calculatePoolIndex(tenantSeq);
    return {
      tenantId,
      tenantSeq,
      poolId: this.generatePoolId(poolIndex),
      poolIndex,
      allocatedAt: new Date(),
    };
  }

  /**
   * 将租户分配到池
   */
  private async assignTenantToPool(
    tenantId: string,
    tenantSeq: number,
    poolIndex: number
  ): Promise<TenantAllocation> {
    if (!this.redis) {
      return this.createDefaultAllocation(tenantId);
    }

    const poolId = this.generatePoolId(poolIndex);
    const allocation: TenantAllocation = {
      tenantId,
      tenantSeq,
      poolId,
      poolIndex,
      allocatedAt: new Date(),
    };

    // 保存分配信息
    const allocationKey = this.getAllocationKey(tenantId);
    await this.redis.set(allocationKey, JSON.stringify(allocation));

    // 更新池的租户计数
    const poolKey = this.getPoolKey(poolId);
    await this.redis.hincrby(poolKey, 'tenantCount', 1);
    await this.redis.hset(poolKey, 'updatedAt', new Date().toISOString());

    // 检查池是否已满
    const tenantCount = parseInt(await this.redis.hget(poolKey, 'tenantCount') || '0', 10);
    if (tenantCount >= this.MAX_TENANTS_PER_POOL) {
      await this.redis.hset(poolKey, 'status', 'full');
    }

    return allocation;
  }

  /**
   * 创建新池
   */
  private async createPool(poolIndex: number): Promise<void> {
    if (!this.redis) return;

    const poolId = this.generatePoolId(poolIndex);
    const poolKey = this.getPoolKey(poolId);
    const now = new Date().toISOString();

    const poolData = {
      id: poolId,
      poolIndex: poolIndex.toString(),
      tenantRangeStart: ((poolIndex - 1) * this.MAX_TENANTS_PER_POOL + 1).toString(),
      tenantRangeEnd: (poolIndex * this.MAX_TENANTS_PER_POOL).toString(),
      tenantCount: '0',
      maxTenants: this.MAX_TENANTS_PER_POOL.toString(),
      cpuPercent: '0',
      memoryPercent: '0',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.redis.hmset(poolKey, poolData);
  }

  /**
   * 获取池信息
   */
  async getPool(poolId: string): Promise<NamespacePool | null> {
    if (!this.redis) return null;

    try {
      const poolKey = this.getPoolKey(poolId);
      const data = await this.redis.hgetall(poolKey);

      if (!data || !data.id) {
        return null;
      }

      return {
        id: data.id,
        poolIndex: parseInt(data.poolIndex, 10),
        tenantRange: {
          start: parseInt(data.tenantRangeStart, 10),
          end: parseInt(data.tenantRangeEnd, 10),
        },
        tenantCount: parseInt(data.tenantCount, 10),
        maxTenants: parseInt(data.maxTenants, 10),
        resourceUsage: {
          cpuPercent: parseFloat(data.cpuPercent),
          memoryPercent: parseFloat(data.memoryPercent),
        },
        status: data.status as NamespacePool['status'],
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    } catch (error) {
      console.error('Failed to get pool info:', error);
      return null;
    }
  }

  /**
   * 查找可用池
   */
  async findAvailablePool(): Promise<NamespacePool | null> {
    if (!this.redis) return null;

    // 遍历所有池，找到第一个有空位的
    for (let i = 1; i <= this.MAX_POOLS; i++) {
      const poolId = this.generatePoolId(i);
      const pool = await this.getPool(poolId);

      if (pool && pool.status === 'active' && pool.tenantCount < pool.maxTenants) {
        return pool;
      }
    }

    return null;
  }

  /**
   * 获取租户的分配信息
   */
  async getTenantAllocation(tenantId: string): Promise<TenantAllocation | null> {
    if (!this.redis) return null;

    try {
      const allocationKey = this.getAllocationKey(tenantId);
      const data = await this.redis.get(allocationKey);

      if (!data) {
        return null;
      }

      const allocation: TenantAllocation = JSON.parse(data);
      return {
        ...allocation,
        allocatedAt: new Date(allocation.allocatedAt),
      };
    } catch (error) {
      console.error('Failed to get tenant allocation:', error);
      return null;
    }
  }

  /**
   * 回收租户分配
   */
  async deallocatePool(tenantId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const allocation = await this.getTenantAllocation(tenantId);
      if (!allocation) return;

      // 删除分配记录
      const allocationKey = this.getAllocationKey(tenantId);
      await this.redis.del(allocationKey);

      // 更新池计数
      const poolKey = this.getPoolKey(allocation.poolId);
      await this.redis.hincrby(poolKey, 'tenantCount', -1);
      await this.redis.hset(poolKey, 'updatedAt', new Date().toISOString());

      // 如果池从 full 变为 active
      const tenantCount = parseInt(await this.redis.hget(poolKey, 'tenantCount') || '0', 10);
      if (tenantCount < this.MAX_TENANTS_PER_POOL) {
        await this.redis.hset(poolKey, 'status', 'active');
      }
    } catch (error) {
      console.error('Failed to deallocate namespace pool:', error);
    }
  }

  /**
   * 获取所有池状态
   */
  async getAllPools(): Promise<NamespacePool[]> {
    if (!this.redis) return [];

    const pools: NamespacePool[] = [];
    for (let i = 1; i <= this.MAX_POOLS; i++) {
      const poolId = this.generatePoolId(i);
      const pool = await this.getPool(poolId);
      if (pool) {
        pools.push(pool);
      }
    }
    return pools;
  }

  /**
   * 获取池统计信息
   */
  async getPoolStats(): Promise<{
    totalPools: number;
    activePools: number;
    fullPools: number;
    totalTenants: number;
    utilizationPercent: number;
  }> {
    const pools = await this.getAllPools();

    return {
      totalPools: pools.length,
      activePools: pools.filter(p => p.status === 'active').length,
      fullPools: pools.filter(p => p.status === 'full').length,
      totalTenants: pools.reduce((sum, p) => sum + p.tenantCount, 0),
      utilizationPercent: (pools.reduce((sum, p) => sum + p.tenantCount, 0) / (this.MAX_POOLS * this.MAX_TENANTS_PER_POOL)) * 100,
    };
  }

  /**
   * 初始化池（系统启动时调用）
   */
  async initializePools(): Promise<void> {
    if (!this.redis) return;

    // 检查是否已初始化
    const initKey = 'namespace:pools:initialized';
    const initialized = await this.redis.get(initKey);
    if (initialized === 'true') return;

    // 创建所有池
    for (let i = 1; i <= this.MAX_POOLS; i++) {
      await this.createPool(i);
    }

    await this.redis.set(initKey, 'true');
  }

  /**
   * 辅助函数：字符串 hash
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * 辅助函数：获取 Redis 键
   */
  private getPoolKey(poolId: string): string {
    return `${this.POOL_PREFIX}${poolId}`;
  }

  private getAllocationKey(tenantId: string): string {
    return `${this.ALLOCATION_PREFIX}${tenantId}`;
  }
}

// 导出单例
export const namespacePoolManager = new NamespacePoolManager();
