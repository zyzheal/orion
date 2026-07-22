/**
 * PermissionCache - Redis-backed permission decision cache
 *
 * 缓存权限评估结果，减少重复授权检查的开销。
 *
 * 缓存策略：
 * - Key 格式: perm:{userId}:{resourceType}:{action}
 * - TTL: 默认 5 分钟（可配置）
 * - 仅缓存 allow 决策（deny 不缓存，避免误判）
 * - 角色变更/策略变更时主动失效
 *
 * 性能目标：
 * - 缓存命中时 < 1ms
 * - 命中率 > 80%（典型读多写少场景）
 */

import { CacheService } from '../cache/CacheService';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface PermissionCacheKey {
  userId: string;
  resourceType: string;
  action: string;
  tenantId?: string;
}

export interface PermissionCacheEntry {
  allowed: boolean;
  reason: string;
  source: string;
  cachedAt: number; // timestamp
}

export interface PermissionCacheStats {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
}

export class PermissionCache {
  private cache: CacheService;
  private stats: PermissionCacheStats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  private ttl: number;

  constructor(cache: CacheService | null, ttlSeconds: number = 300) {
    this.cache = cache || new CacheService(null);
    this.ttl = ttlSeconds;
  }

  /**
   * 构建缓存 key
   */
  private buildKey(key: PermissionCacheKey): string {
    const tenant = key.tenantId || getCurrentTenantId();
    return `perm:${tenant}:${key.userId}:${key.resourceType}:${key.action}`;
  }

  /**
   * 获取缓存的权限决策
   */
  async get(key: PermissionCacheKey): Promise<PermissionCacheEntry | null> {
    const cacheKey = this.buildKey(key);
    const entry = await this.cache.get<PermissionCacheEntry>(cacheKey);
    if (entry) {
      this.stats.hits++;
      return entry;
    }
    this.stats.misses++;
    return null;
  }

  /**
   * 缓存权限决策结果
   * 仅缓存 allow 决策，deny 不缓存（避免策略变更后误放行）
   */
  async set(key: PermissionCacheKey, entry: PermissionCacheEntry): Promise<void> {
    // 只缓存 allow 决策
    if (!entry.allowed) return;

    const cacheKey = this.buildKey(key);
    await this.cache.set(cacheKey, entry, this.ttl);
    this.stats.sets++;
  }

  /**
   * 失效单个用户的缓存
   * 用于角色变更、策略变更时调用
   */
  async invalidateUser(userId: string, tenantId?: string): Promise<void> {
    const pattern = `perm:${tenantId || '*'}:${userId}:*`;
    await this.cache.invalidate(pattern);
    this.stats.invalidations++;
  }

  /**
   * 失效整个租户的缓存
   * 用于大规模策略变更时调用
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    const pattern = `perm:${tenantId}:*`;
    await this.cache.invalidate(pattern);
    this.stats.invalidations++;
  }

  /**
   * 失效整个缓存
   * 用于系统级权限变更时调用
   */
  async invalidateAll(): Promise<void> {
    await this.cache.invalidate('perm:*');
    this.stats.invalidations++;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): PermissionCacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    } as PermissionCacheStats & { hitRate: number };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  }
}
