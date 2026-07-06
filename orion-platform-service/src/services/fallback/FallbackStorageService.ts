/**
 * FallbackStorageService — 统一回退存储服务
 *
 * 为使用 `new Map()` 做缓存/fallback storage 的服务提供统一的抽象层。
 *
 * Features:
 *   - 命名空间隔离（prefix）：同一进程内多服务互不干扰
 *   - TTL 逐条过期 + 定期清理
 *   - LRU 淘汰（maxSize 上限）
 *   - 可选 PostgreSQL 持久化（persistToDb）
 *   - 批量操作（mget / mset）
 *   - flushToDb / loadFromDb 生命周期接口
 *
 * Usage:
 *   const store = new FallbackStorageService({ prefix: 'tenant-quota', maxSize: 500, ttlMs: 300_000, persistToDb: true });
 *   await store.set('key', value);
 *   const v = await store.get('key');
 *   await store.flushToDb();
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { FallbackStorageRepository } from '../../repositories/FallbackStorageRepository';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FallbackStorageOptions {
  /** 命名空间前缀，最终 key = `${prefix}:${key}` */
  prefix: string;
  /** 最大条目数（0 = 不限制） */
  maxSize?: number;
  /** 默认 TTL（毫秒），0 = 永不过期 */
  ttlMs?: number;
  /** 是否自动持久化到 PostgreSQL */
  persistToDb?: boolean;
  /** tenant_id（persistToDb=true 时必填） */
  tenantId?: string;
}

interface StoredEntry {
  value: unknown;
  /** 过期时间戳（ms），Infinity = 永不过期 */
  expiresAt: number;
  /** 最后访问时间（ms），用于 LRU */
  lastAccessedAt: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SimpleFallbackStorage {
  private readonly prefix: string;
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  /** 内部存储：key = 原始 key（不含 prefix），value = entry */
  private readonly store = new Map<string, StoredEntry>();

  private readonly persistToDb: boolean;
  private readonly tenantId: string;
  private repository: FallbackStorageRepository | null = null;

  /** 定期清理定时器 */
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly cleanupIntervalMs: number;

  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private dbErrors = 0;

  private readonly logger = createLogger('fallback-storage');

  constructor(options: FallbackStorageOptions) {
    this.prefix = options.prefix;
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtlMs = options.ttlMs ?? 300_000; // 5 minutes
    this.persistToDb = options.persistToDb ?? false;
    this.tenantId = options.tenantId ?? '';
    this.cleanupIntervalMs = 60_000; // every 60s

    if (this.persistToDb && !this.tenantId) {
      throw new OrionError(`[FallbackStorage:${this.prefix}] persistToDb=true requires tenantId`, ErrorCode.INTERNAL_ERROR);
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * start() — 启动服务，初始化 PostgreSQL repository（如需要）并启动定期清理。
   * 在服务初始化完成后调用。
   */
  start(repository: FallbackStorageRepository | null = null): void {
    // Always accept the repository if provided (used by PromotionService which
    // passes persistToDb=false but still wants DB fallback reads via repository)
    if (repository) {
      this.repository = repository;
    } else if (this.persistToDb) {
      this.logger.warn({ prefix: this.prefix }, '[FallbackStorage] persistToDb=true but no repository provided, DB ops will no-op');
    }

    // 定期清理过期/超量条目
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
      this.evictLRUIfNeeded();
    }, this.cleanupIntervalMs);

    this.logger.info(
      { prefix: this.prefix, maxSize: this.maxSize, ttlMs: this.defaultTtlMs, persistToDb: this.persistToDb },
      '[FallbackStorage] Started'
    );
  }

  /**
   * stop() — 停止服务，清除定时器。
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.logger.info({ prefix: this.prefix }, '[FallbackStorage] Stopped');
  }

  // ─── Core CRUD ─────────────────────────────────────────────────────────────

  /**
   * get — 根据原始 key 读取值（不含 prefix）。
   * @param key 原始 key
   * @returns 存储值，不存在或已过期返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      // DB fallback
      if (this.persistToDb && this.repository) {
        return await this.loadSingleFromDb<T>(key);
      }
      return null;
    }

    // TTL 检查
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.expirations++;
      this.misses++;
      if (this.persistToDb && this.repository) {
        await this.repository.delete(this.tenantId, this.prefix, key).catch(() => { this.dbErrors++; });
      }
      return null;
    }

    // 更新 LRU
    entry.lastAccessedAt = Date.now();
    this.hits++;
    return entry.value as T;
  }

  /**
   * set — 写入值（不含 prefix）。
   * @param key 原始 key
   * @param value 任意值
   * @param ttlMs 可选 TTL（覆盖默认值）
   */
  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const now = Date.now();
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl > 0 ? now + ttl : Infinity;

    // LRU 淘汰检查
    if (this.maxSize > 0 && !this.store.has(key) && this.store.size >= this.maxSize) {
      this.evictLRU();
    }

    this.store.set(key, {
      value,
      expiresAt,
      lastAccessedAt: now,
    });

    // 异步持久化到 PostgreSQL（不阻塞调用方）
    if (this.persistToDb && this.repository) {
      this.persistToDbSilently(key, value, ttl);
    }
  }

  /**
   * delete — 删除 key。
   */
  async delete(key: string): Promise<void> {
    const existed = this.store.delete(key);
    if (existed && this.persistToDb && this.repository) {
      await this.repository.delete(this.tenantId, this.prefix, key).catch(() => { this.dbErrors++; });
    }
  }

  /**
   * has — 检查 key 是否存在且未过期。
   */
  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * keys — 返回所有未过期的原始 key 列表。
   */
  async keys(): Promise<string[]> {
    const now = Date.now();
    const result: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.expiresAt) {
        result.push(key);
      } else {
        this.store.delete(key);
        this.expirations++;
      }
    }
    return result;
  }

  /**
   * clear — 清空所有条目。
   */
  async clear(): Promise<void> {
    this.store.clear();
    if (this.persistToDb && this.repository) {
      await this.repository.deleteByPrefix(this.tenantId, this.prefix).catch(() => { this.dbErrors++; });
    }
  }

  // ─── Batch ─────────────────────────────────────────────────────────────────

  /**
   * mget — 批量读取。
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  /**
   * mset — 批量写入（Map<key, value>）。
   */
  async mset(entries: Map<string, unknown>): Promise<void> {
    for (const [key, value] of entries.entries()) {
      await this.set(key, value);
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /**
   * flushToDb — 将所有未过期条目显式持久化到 PostgreSQL。
   * 在服务停止前调用可避免数据丢失。
   */
  async flushToDb(): Promise<void> {
    if (!this.persistToDb || !this.repository) {
      this.logger.warn({ prefix: this.prefix }, '[FallbackStorage] flushToDb skipped (persistToDb=false or no repository)');
      return;
    }

    const now = Date.now();
    let flushed = 0;
    let skipped = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        skipped++;
        continue;
      }
      const ttlMs = entry.expiresAt === Infinity ? this.defaultTtlMs : entry.expiresAt - now;
      try {
        await this.repository.upsert(this.tenantId, this.prefix, key, entry.value as Record<string, any>, Math.max(ttlMs, 0));
        flushed++;
      } catch {
        this.dbErrors++;
      }
    }

    this.logger.info(
      { prefix: this.prefix, flushed, skipped },
      '[FallbackStorage] flushToDb completed'
    );
  }

  /**
   * loadFromDb — 从 PostgreSQL 加载所有条目到内存。
   * 在服务启动后调用可预热缓存。
   */
  async loadFromDb(): Promise<void> {
    if (!this.persistToDb || !this.repository) {
      return;
    }

    try {
      const entries = await this.repository.findByPrefix(this.tenantId, this.prefix);
      let loaded = 0;
      let expired = 0;
      const now = Date.now();

      for (const row of entries) {
        if (now > row.expires_at.getTime()) {
          expired++;
          continue;
        }
        this.store.set(row.key, {
          value: row.value,
          expiresAt: row.expires_at.getTime(),
          lastAccessedAt: now,
        });
        loaded++;
      }

      this.logger.info(
        { prefix: this.prefix, loaded, expired },
        '[FallbackStorage] loadFromDb completed'
      );
    } catch {
      this.dbErrors++;
      this.logger.error({ prefix: this.prefix }, '[FallbackStorage] loadFromDb failed');
    }
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  /**
   * getStats — 返回运行时统计信息。
   */
  getStats(): Record<string, unknown> {
    const now = Date.now();
    let liveCount = 0;
    let expiredCount = 0;

    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) expiredCount++;
      else liveCount++;
    }

    return {
      prefix: this.prefix,
      maxSize: this.maxSize,
      liveEntries: liveCount,
      expiredEntries: expiredCount,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) + '%' : 'N/A',
      evictions: this.evictions,
      expirations: this.expirations,
      dbErrors: this.dbErrors,
      persistToDb: this.persistToDb,
    };
  }

  /**
   * size — 返回当前未过期条目数。
   */
  size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (now <= entry.expiresAt) count++;
    }
    return count;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /** 静默持久化（fire-and-forget，不阻塞） */
  private async persistToDbSilently(key: string, value: unknown, ttlMs: number): Promise<void> {
    if (!this.repository) return;
    try {
      await this.repository.upsert(this.tenantId, this.prefix, key, value as Record<string, any>, ttlMs);
    } catch {
      this.dbErrors++;
    }
  }

  /** 从 PostgreSQL 加载单条 */
  private async loadSingleFromDb<T>(key: string): Promise<T | null> {
    if (!this.repository) return null;
    try {
      const row = await this.repository.find(this.tenantId, this.prefix, key);
      if (!row || Date.now() > row.expires_at.getTime()) return null;

      // 写入内存
      const now = Date.now();
      this.store.set(key, {
        value: row.value,
        expiresAt: row.expires_at.getTime(),
        lastAccessedAt: now,
      });
      this.misses++; // DB 读取计为 miss（内存未命中）
      return row.value as T;
    } catch {
      this.dbErrors++;
      return null;
    }
  }

  /** 清理所有已过期条目 */
  private cleanupExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        this.expirations++;
        count++;
      }
    }
    return count;
  }

  /** LRU 淘汰单个条目 */
  private evictLRU(): void {
    if (this.store.size === 0) return;

    let lruKey: string | undefined;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.store.delete(lruKey);
      this.evictions++;
    }
  }

  /** 检查并执行 LRU 淘汰 */
  private evictLRUIfNeeded(): void {
    if (this.maxSize > 0 && this.store.size > this.maxSize) {
      const excess = this.store.size - this.maxSize;
      for (let i = 0; i < excess; i++) {
        this.evictLRU();
      }
    }
  }
}
