/**
 * InMemoryCache - L1 内存缓存层
 *
 * F010: Local hot data cache with TTL auto-expiry and LRU eviction.
 *
 * Features:
 * - TTL auto-expiry (per-key)
 * - LRU eviction when capacity reached
 * - Thread-safe concurrent reads/writes (via Map)
 * - Configurable max size (default: 1000 entries)
 */

export interface InMemoryCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
}

export interface InMemoryCacheOptions {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Default TTL in milliseconds (default: 60000 = 1 minute) */
  defaultTtlMs?: number;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;  // timestamp in ms
  lastAccessedAt: number;  // timestamp in ms, for LRU
}

export class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTtlMs: number;

  // Stats counters
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(options: InMemoryCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000;
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL expiry
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.expirations++;
      this.misses++;
      return undefined;
    }

    // Update LRU timestamp
    entry.lastAccessedAt = Date.now();
    this.hits++;
    return entry.value as T;
  }

  /**
   * Set a value in the cache. Evicts LRU entry if at capacity.
   */
  set(key: string, value: unknown, ttlMs?: number): void {
    // If key already exists, just update
    if (this.store.has(key)) {
      this.store.set(key, {
        value,
        expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
        lastAccessedAt: Date.now(),
      });
      return;
    }

    // Evict LRU entry if at capacity
    if (this.store.size >= this.maxSize) {
      this.evictLRU();
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      lastAccessedAt: Date.now(),
    });
  }

  /**
   * Delete a cached value.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Delete entries matching a pattern (e.g., 'user:*').
   */
  deleteByPattern(pattern: string): number {
    const regex = this.patternToRegex(pattern);
    let count = 0;

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get cache statistics.
   */
  getStats(): InMemoryCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  /**
   * Clean up expired entries. Returns number of expired entries removed.
   */
  cleanupExpired(): number {
    let count = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        this.expirations++;
        count++;
      }
    }

    return count;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private evictLRU(): void {
    let lruKey: string | undefined;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.store.delete(lruKey);
      this.evictions++;
    }
  }

  private patternToRegex(pattern: string): RegExp {
    // Simple glob pattern: * matches anything
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`);
  }
}
