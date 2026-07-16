/**
 * FallbackStorageService — 三层降级策略缓存服务
 *
 * 实现 Redis → PostgreSQL → Memory 的自动降级与恢复策略。
 * 上层不可用时自动降级到下层，上层恢复后自动升级。
 * 所有降级/恢复行为均记录日志。
 *
 * Tier 优先级（高 → 低）：
 *   L2: Redis (CacheService) — 最快，支持 TTL
 *   L3: PostgreSQL (CacheRepository) — 持久化，支持 TTL
 *   L4: InMemoryCache — LRU 淘汰，最终兜底
 *
 * Read 策略: 从当前活跃层级 → 下层逐级尝试
 * Write 策略: Write-through (所有可用层同步写入)
 * Delete 策略: 所有可用层同步删除
 *
 * 降级检测：
 *   - 基于各层级的 isHealthy() 健康检查
 *   - 上层 unhealthy → 自动降级到下一层
 *   - 每 30 秒健康检查 → 上层恢复 → 自动升级
 */

import { CacheService } from './cache/CacheService';
import { OrionError, ErrorCode } from '../errors';
import { CacheRepository } from './cache/CacheRepository';
import { InMemoryCache } from './cache/InMemoryCache';
import { RedisCache } from './redis-cache';
import { DatabasePool } from './database';
import { createLogger } from '../utils/logger';

export interface LoggerLike {
  info: (obj: unknown, msg: string) => void;
  warn: (obj: unknown, msg: string) => void;
  error: (obj: unknown, msg: string) => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type TierLevel = 'redis' | 'postgres' | 'memory';

export interface TierHealth {
  available: boolean;
  lastCheck: number;
  lastSuccess: number;
  lastFailure: number;
}

export interface FallbackStorageStats {
  activeTier: TierLevel;
  degraded: boolean;
  tiers: Record<TierLevel, TierHealth>;
  totalOps: number;
  degradationCount: number;
  recoveryCount: number;
}

export interface FallbackStorageOptions {
  redis?: RedisCache | null;
  database?: DatabasePool | null;
  l4MaxEntries?: number;
  l4DefaultTtlMs?: number;
  healthCheckIntervalMs?: number;
  tenantId?: string;
  logger?: LoggerLike;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class FallbackStorageService {
  private l2: CacheService | null;
  private l3: CacheRepository | null;
  private l4: InMemoryCache;

  private tierHealth: Record<TierLevel, TierHealth>;
  private activeTier: TierLevel;
  private degraded: boolean;

  private healthCheckIntervalMs: number;
  private tenantId: string;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private logger: LoggerLike;

  private totalOps = 0;
  private degradationCount = 0;
  private recoveryCount = 0;

  constructor(options: FallbackStorageOptions = {}) {
    // L2: Redis
    this.l2 = options.redis ? new CacheService(options.redis) : null;

    // L3: PostgreSQL
    this.l3 = options.database ? new CacheRepository(options.database) : null;

    // L4: InMemory
    this.l4 = new InMemoryCache({
      maxSize: options.l4MaxEntries ?? 1000,
      defaultTtlMs: options.l4DefaultTtlMs ?? 60_000,
    });

    if (!options.tenantId) {
      throw new OrionError('[FallbackStorage] tenantId is required and must be provided in options', ErrorCode.VALIDATION_ERROR);
    }
    this.tenantId = options.tenantId;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 30_000;
    this.logger = options.logger ?? createLogger('fallback-storage');

    // 初始健康状态：检查每层是否可初始化
    this.tierHealth = {
      redis: { available: this.l2 !== null && this.l2 !== undefined, lastCheck: Date.now(), lastSuccess: Date.now(), lastFailure: 0 },
      postgres: { available: this.l3 !== null && this.l3 !== undefined, lastCheck: Date.now(), lastSuccess: Date.now(), lastFailure: 0 },
      memory: { available: true, lastCheck: Date.now(), lastSuccess: Date.now(), lastFailure: 0 },
    };

    // 初始活跃层级：从最高可用层开始
    this.activeTier = this.getHighestAvailableTier();
    this.degraded = false;

    // 启动健康检查定时器
    this.startHealthCheck();
  }

  // ─── Core Operations ──────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    this.totalOps++;

    // 从当前活跃层级向下尝试
    const tiers = this.getTierOrder(this.activeTier);
    for (const tier of tiers) {
      // 跳过不健康的层级（除非是 memory 兜底层）
      if (tier !== 'memory' && !this.tierHealth[tier].available) continue;

      try {
        const value = await this.getFromTier<T>(tier, key);
        if (value !== null && value !== undefined) {
          this.recordSuccess(tier);
          return value;
        }
        // null/undefined = cache miss，继续下一层
      } catch (error) {
        this.recordFailure(tier, error);
      }
    }

    return null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.totalOps++;

    // Write-through: 写入所有健康可用层级
    const tiers = this.getAvailableTiers();
    for (const tier of tiers) {
      if (tier !== 'memory' && !this.tierHealth[tier].available) continue;

      try {
        await this.setToTier(tier, key, value, ttlSeconds);
        this.recordSuccess(tier);
      } catch (error) {
        this.recordFailure(tier, error);
      }
    }
  }

  async del(key: string): Promise<void> {
    this.totalOps++;

    // 从所有健康可用层级删除
    const tiers = this.getAvailableTiers();
    for (const tier of tiers) {
      if (tier !== 'memory' && !this.tierHealth[tier].available) continue;

      try {
        await this.delFromTier(tier, key);
        this.recordSuccess(tier);
      } catch (error) {
        this.recordFailure(tier, error);
      }
    }
  }

  /**
   * Cache-aside pattern: try cache, if miss → load from DB → cache → return.
   */
  async getOrLoad<T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const data = await loader();
    await this.set(key, data, ttlSeconds);
    return data;
  }

  // ─── Tier-level Operations ────────────────────────────────────────────────

  private async getFromTier<T>(tier: TierLevel, key: string): Promise<T | null | undefined> {
    switch (tier) {
      case 'redis':
        if (!this.l2) return null;
        return await this.l2.get<T>(key);
      case 'postgres':
        if (!this.l3) return null;
        const pgEntry = await this.l3.get(this.tenantId, key);
        return pgEntry ? (pgEntry.value as T) : null;
      case 'memory':
        return this.l4.get<T>(key);
    }
  }

  private async setToTier(tier: TierLevel, key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    switch (tier) {
      case 'redis':
        if (!this.l2) return;
        await this.l2.set(key, value, ttlSeconds);
        break;
      case 'postgres':
        if (!this.l3) return;
        await this.l3.set(this.tenantId, key, value as Record<string, any>, ttlSeconds ?? 3600);
        break;
      case 'memory':
        const ttlMs = ttlSeconds ? ttlSeconds * 1000 : undefined;
        this.l4.set(key, value, ttlMs);
        break;
    }
  }

  private async delFromTier(tier: TierLevel, key: string): Promise<void> {
    switch (tier) {
      case 'redis':
        if (!this.l2) return;
        await this.l2.del(key);
        break;
      case 'postgres':
        if (!this.l3) return;
        await this.l3.delete(this.tenantId, key);
        break;
      case 'memory':
        this.l4.delete(key);
        break;
    }
  }

  // ─── Health & Degradation ────────────────────────────────────────────────

  private getHighestAvailableTier(): TierLevel {
    if (this.tierHealth.redis.available) return 'redis';
    if (this.tierHealth.postgres.available) return 'postgres';
    return 'memory';
  }

  private getAvailableTiers(): TierLevel[] {
    const tiers: TierLevel[] = [];
    if (this.tierHealth.redis.available) tiers.push('redis');
    if (this.tierHealth.postgres.available) tiers.push('postgres');
    tiers.push('memory'); // Always available
    return tiers;
  }

  private getTierOrder(fromTier: TierLevel): TierLevel[] {
    const allTiers: TierLevel[] = ['redis', 'postgres', 'memory'];
    const startIdx = allTiers.indexOf(fromTier);
    return allTiers.slice(startIdx);
  }

  private recordSuccess(tier: TierLevel): void {
    const health = this.tierHealth[tier];
    health.lastSuccess = Date.now();
  }

  private recordFailure(tier: TierLevel, error: unknown): void {
    const health = this.tierHealth[tier];
    health.lastFailure = Date.now();
  }

  private markTierUnavailable(tier: TierLevel): void {
    if (this.tierHealth[tier].available) {
      this.tierHealth[tier].available = false;
      this.checkDegradation(tier);
    }
  }

  private markTierAvailable(tier: TierLevel): void {
    if (!this.tierHealth[tier].available) {
      this.tierHealth[tier].available = true;
      this.tierHealth[tier].lastSuccess = Date.now();
      this.checkRecovery(tier);
    }
  }

  private checkDegradation(failedTier: TierLevel): void {
    // Find the first available tier at or below the failed tier
    const tierOrder: TierLevel[] = ['redis', 'postgres', 'memory'];
    const failedIdx = tierOrder.indexOf(failedTier);
    let nextAvailable: TierLevel | null = null;
    for (let i = failedIdx; i < tierOrder.length; i++) {
      if (this.tierHealth[tierOrder[i]].available) {
        nextAvailable = tierOrder[i];
        break;
      }
    }

    if (!nextAvailable || nextAvailable === this.activeTier) return;

    // Cascade: mark all tiers between current and next available as unavailable
    const currentIdx = tierOrder.indexOf(this.activeTier);
    for (let i = currentIdx; i < tierOrder.indexOf(nextAvailable); i++) {
      this.tierHealth[tierOrder[i]].available = false;
    }

    this.degrade(failedTier);
  }

  private degrade(failedTier: TierLevel): void {
    this.degraded = true;
    this.degradationCount++;

    // 切换到下一可用层级
    const tierOrder: TierLevel[] = ['redis', 'postgres', 'memory'];
    const currentIdx = tierOrder.indexOf(this.activeTier);
    for (let i = currentIdx + 1; i < tierOrder.length; i++) {
      const nextTier = tierOrder[i];
      if (this.tierHealth[nextTier].available) {
        const prevTier = this.activeTier;
        this.activeTier = nextTier;
        this.logger.warn(
          { from: prevTier, to: nextTier, reason: `${failedTier} unavailable` },
          `[FallbackStorage] Degraded: ${prevTier} → ${nextTier}`
        );
        break;
      }
    }
  }

  private checkRecovery(recoveredTier: TierLevel): void {
    if (!this.degraded) return;

    const tierOrder: TierLevel[] = ['redis', 'postgres', 'memory'];
    const recoveredIdx = tierOrder.indexOf(recoveredTier);
    const currentIdx = tierOrder.indexOf(this.activeTier);

    // 只有当恢复的层级比当前活跃层级更高时才升级
    if (recoveredIdx < currentIdx) {
      this.recover(recoveredTier);
    }
  }

  private recover(recoveredTier: TierLevel): void {
    const prevTier = this.activeTier;
    this.activeTier = recoveredTier;
    this.degraded = false;
    this.recoveryCount++;

    this.logger.info(
      { from: prevTier, to: recoveredTier },
      `[FallbackStorage] Recovered: ${prevTier} → ${recoveredTier}`
    );
  }

  // ─── Health Check ─────────────────────────────────────────────────────────

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  async performHealthCheck(): Promise<void> {
    this.tierHealth.redis.lastCheck = Date.now();
    this.tierHealth.postgres.lastCheck = Date.now();

    // 检查 Redis 健康状态
    if (this.l2) {
      const wasAvailable = this.tierHealth.redis.available;
      const isHealthy = this.l2.isHealthy();

      if (isHealthy && !wasAvailable) {
        this.markTierAvailable('redis');
      } else if (!isHealthy && wasAvailable) {
        this.markTierUnavailable('redis');
      }
    }

    // 检查 PostgreSQL 健康状态（尝试一个简单的查询）
    if (this.l3) {
      const wasAvailable = this.tierHealth.postgres.available;
      try {
        await this.l3.get(this.tenantId, `__health_check_${Date.now()}`);
        if (!wasAvailable) {
          this.markTierAvailable('postgres');
        }
      } catch {
        if (wasAvailable) {
          this.markTierUnavailable('postgres');
        }
      }
    }

    // Memory 层始终可用
    this.tierHealth.memory.available = true;
    this.tierHealth.memory.lastCheck = Date.now();
  }

  // ─── Stats & Info ─────────────────────────────────────────────────────────

  getStats(): FallbackStorageStats {
    return {
      activeTier: this.activeTier,
      degraded: this.degraded,
      tiers: { ...this.tierHealth },
      totalOps: this.totalOps,
      degradationCount: this.degradationCount,
      recoveryCount: this.recoveryCount,
    };
  }

  getActiveTier(): TierLevel {
    return this.activeTier;
  }

  isDegraded(): boolean {
    return this.degraded;
  }
}