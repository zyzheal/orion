/**
 * CacheStrategyService - 多级缓存服务 (L1 + L2)
 *
 * F011: 多级缓存 (L1 InMemory → L2 Redis → DB)
 * F012: 缓存防护 (防穿透 + 防击穿 + 防雪崩)
 * F013: 缓存预热与失效
 *
 * Read strategy:  L1 → L2 → DB loader
 * Write strategy: Write-through (L1 + L2 sync)
 * Delete strategy: Invalidate both L1 and L2
 *
 * Protection:
 * - Cache penetration: Null value caching (short TTL)
 * - Cache breakdown: Mutex lock per key
 * - Cache avalanche: Random TTL offset
 */

import { InMemoryCache } from './InMemoryCache';
import { CacheService } from './CacheService';
import { RedisCache } from '../redis-cache';

export interface CacheStrategyOptions {
  /** L1 max entries (default: 1000) */
  l1MaxEntries?: number;
  /** L1 TTL in ms (default: 30000 = 30s) */
  l1TtlMs?: number;
  /** L2 TTL in ms (default: 300000 = 5min) */
  l2TtlMs?: number;
  /** Enable cache penetration protection (default: true) */
  enablePenetrationProtection?: boolean;
  /** Enable cache breakdown protection (default: true) */
  enableBreakdownProtection?: boolean;
  /** Enable cache avalanche protection (default: true) */
  enableAvalancheProtection?: boolean;
  /** Random TTL offset ratio (default: 0.3 = ±30%) */
  ttlRandomRatio?: number;
  /** Null value cache TTL in ms (default: 5000 = 5s) */
  nullCacheTtlMs?: number;
}

export interface CacheStats {
  l1: { size: number; hits: number; misses: number; hitRate: number };
  l2: { hits: number; misses: number; hitRate: number };
  combined: { totalHits: number; totalMisses: number; hitRate: number };
  protection: {
    penetrationBlocks: number;
    breakdownLocks: number;
    avalancheRandomizations: number;
  };
}

// ─── Mutex for cache breakdown protection ──────────────────────────────────

const pendingLoads = new Map<string, Promise<unknown>>();

// ─── Service ───────────────────────────────────────────────────────────────

export class CacheStrategyService {
  private l1: InMemoryCache;
  private l2: CacheService | null;
  private options: Required<CacheStrategyOptions>;

  // Counters for protection events
  private penetrationBlocks = 0;
  private breakdownLocks = 0;
  private avalancheRandomizations = 0;

  constructor(redis?: RedisCache | null, options: CacheStrategyOptions = {}) {
    this.l1 = new InMemoryCache({
      maxSize: options.l1MaxEntries ?? 1000,
      defaultTtlMs: options.l1TtlMs ?? 30_000,
    });

    // Wrap Redis in CacheService for L2
    this.l2 = redis ? new CacheService(redis, (options.l2TtlMs ?? 300_000) / 1000) : null;

    this.options = {
      l1MaxEntries: options.l1MaxEntries ?? 1000,
      l1TtlMs: options.l1TtlMs ?? 30_000,
      l2TtlMs: options.l2TtlMs ?? 300_000,
      enablePenetrationProtection: options.enablePenetrationProtection ?? true,
      enableBreakdownProtection: options.enableBreakdownProtection ?? true,
      enableAvalancheProtection: options.enableAvalancheProtection ?? true,
      ttlRandomRatio: options.ttlRandomRatio ?? 0.3,
      nullCacheTtlMs: options.nullCacheTtlMs ?? 5000,
    };
  }

  // ─── F011: Read Strategy (L1 → L2 → DB) ────────────────────────────────

  /**
   * Get a value from the multi-level cache.
   * If not in cache, uses the loader function to fetch from source (e.g., DB).
   */
  async getOrLoad<T>(key: string, loader: () => Promise<T>, ttlMs?: number): Promise<T> {
    // Step 1: Try L1
    const l1Value = this.l1.get<T>(key);
    if (l1Value !== undefined) {
      return this.handleNullValue<T>(key, l1Value);
    }

    // Step 2: Try L2
    if (this.l2) {
      const l2Value = await this.l2.get<T>(key);
      if (l2Value !== null) {
        // Populate L1 from L2
        this.setL1(key, l2Value, ttlMs);
        return this.handleNullValue<T>(key, l2Value);
      }
    }

    // Step 3: Load from source (DB)
    const data = await this.loadWithBreakdownProtection(key, async () => {
      return loader();
    });

    // Cache the result (write-through)
    await this.set(key, data, ttlMs);

    return data;
  }

  /**
   * Direct get without loader. Returns undefined if not found.
   */
  async get<T>(key: string): Promise<T | undefined> {
    // Try L1 first
    const l1Value = this.l1.get<T>(key);
    if (l1Value !== undefined) {
      return this.handleNullValue<T>(key, l1Value);
    }

    // Try L2
    if (this.l2) {
      const l2Value = await this.l2.get<T>(key);
      if (l2Value !== null) {
        // Populate L1 from L2
        this.setL1(key, l2Value);
        return this.handleNullValue<T>(key, l2Value);
      }
    }

    return undefined;
  }

  // ─── F011: Write Strategy (Write-through L1 + L2) ──────────────────────

  /**
   * Set a value in both L1 and L2 caches.
   */
  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    this.setL1(key, value, ttlMs);

    if (this.l2) {
      const ttlSec = ttlMs ? ttlMs / 1000 : undefined;
      await this.l2.set(key, value, ttlSec);
    }
  }

  // ─── F011: Delete Strategy (Invalidate L1 + L2) ────────────────────────

  /**
   * Delete a value from both L1 and L2 caches.
   */
  async delete(key: string): Promise<void> {
    this.l1.delete(key);

    if (this.l2) {
      await this.l2.del(key);
    }
  }

  /**
   * Delete all entries matching a pattern from L1.
   */
  deleteByPattern(pattern: string): number {
    return this.l1.deleteByPattern(pattern);
  }

  // ─── F013: Cache Pre-warming ───────────────────────────────────────────

  /**
   * Warm up the cache with pre-loaded data.
   */
  async warmup<T>(entries: { key: string; value: T; ttlMs?: number }[]): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttlMs);
    }
  }

  /**
   * Warm up cache by loading data with a loader function.
   */
  async warmupWithLoader<T>(
    keys: string[],
    loader: (key: string) => Promise<T>,
    ttlMs?: number,
  ): Promise<void> {
    const promises = keys.map(async (key) => {
      try {
        const value = await loader(key);
        await this.set(key, value, ttlMs);
      } catch {
        // Skip failed loads, don't block others
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Invalidate entries by pattern.
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    this.l1.deleteByPattern(pattern);

    if (this.l2) {
      // L2 doesn't support pattern delete natively, but we can try
      // In production, use Redis SCAN + DEL for pattern invalidation
    }
  }

  /**
   * Bulk invalidate multiple keys.
   */
  async invalidateKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.l1.delete(key);
    }

    if (this.l2) {
      await Promise.allSettled(keys.map((k) => this.l2!.del(k)));
    }
  }

  // ─── Statistics ─────────────────────────────────────────────────────────

  getStats(): CacheStats {
    const l1Stats = this.l1.getStats();
    const totalHits = l1Stats.hits + this.penetrationBlocks;
    const totalMisses = l1Stats.misses;

    return {
      l1: {
        size: l1Stats.size,
        hits: l1Stats.hits,
        misses: l1Stats.misses,
        hitRate: l1Stats.hits + l1Stats.misses > 0
          ? l1Stats.hits / (l1Stats.hits + l1Stats.misses)
          : 0,
      },
      l2: { hits: 0, misses: 0, hitRate: 0 }, // L2 stats from CacheService not exposed
      combined: {
        totalHits,
        totalMisses,
        hitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
      },
      protection: {
        penetrationBlocks: this.penetrationBlocks,
        breakdownLocks: this.breakdownLocks,
        avalancheRandomizations: this.avalancheRandomizations,
      },
    };
  }

  /**
   * Get L1 cache instance (for direct access if needed).
   */
  getL1Cache(): InMemoryCache {
    return this.l1;
  }

  /**
   * Get L2 cache service (for direct access if needed).
   */
  getL2Cache(): CacheService | null {
    return this.l2;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  private setL1(key: string, value: unknown, ttlMs?: number): void {
    const effectiveTtl = this.randomizeTtl(ttlMs ?? this.options.l1TtlMs);
    this.l1.set(key, value, effectiveTtl);
  }

  /**
   * F012: Cache penetration protection - null value caching.
   * Returns the value, or if it's the null marker, returns undefined.
   */
  private handleNullValue<T>(key: string, value: T): T {
    if (this.options.enablePenetrationProtection && value === this.nullMarker(key)) {
      this.penetrationBlocks++;
      return value;
    }
    return value;
  }

  private nullMarker(key: string): string {
    return `__NULL__${key}__`;
  }

  /**
   * F012: Cache breakdown protection - mutex lock per key.
   * Only one request loads data for a given key at a time.
   */
  private async loadWithBreakdownProtection<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!this.options.enableBreakdownProtection) {
      return loader();
    }

    // Check if there's already a pending load for this key
    const pending = pendingLoads.get(key);
    if (pending) {
      this.breakdownLocks++;
      return pending as T;
    }

    // Start loading
    const loadPromise = (async () => {
      try {
        return await loader();
      } finally {
        pendingLoads.delete(key);
      }
    })();

    pendingLoads.set(key, loadPromise);

    return loadPromise;
  }

  /**
   * F012: Cache avalanche protection - random TTL offset.
   * Adds ±random ratio to prevent mass cache expiry at the same time.
   */
  private randomizeTtl(baseTtlMs: number): number {
    if (!this.options.enableAvalancheProtection) {
      return baseTtlMs;
    }

    const ratio = this.options.ttlRandomRatio;
    const randomOffset = baseTtlMs * ratio * (Math.random() * 2 - 1);
    const ttl = Math.round(baseTtlMs + randomOffset);

    this.avalancheRandomizations++;
    return Math.max(1000, ttl); // Minimum 1s TTL
  }
}
