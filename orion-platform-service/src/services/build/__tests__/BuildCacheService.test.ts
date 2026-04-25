/**
 * BuildCacheService 单元测试
 *
 * Uses in-memory mock repositories to test business logic without a real database.
 */

import { BuildCacheService } from '../BuildCacheService';
import {
  BuildCacheConfigRepository,
  BuildCacheEntryRepository,
} from '../../../repositories/BuildCacheRepository';
import {
  CacheLevel,
  CacheStatus,
  CacheCleanupPolicy,
  CacheStorageType,
  BuildCacheConfig,
  CacheEntry,
} from '../../../models/BuildCache';

// ==================== In-Memory Mock Repositories ====================

class MockConfigRepository extends BuildCacheConfigRepository {
  private store: Map<string, BuildCacheConfig> = new Map();

  constructor() {
    super({ query: async () => ({ rows: [], rowCount: 0 }) });
  }

  async findById(id: string): Promise<BuildCacheConfig | undefined> {
    return this.store.get(id);
  }

  async findByLevelAndTarget(
    level: CacheLevel,
    targetId?: string,
  ): Promise<BuildCacheConfig | undefined> {
    for (const config of this.store.values()) {
      if (config.level === level && (config.targetId || '') === (targetId || '')) {
        return config;
      }
    }
    return undefined;
  }

  async findAllWithFilters(options?: {
    level?: CacheLevel;
    status?: CacheStatus;
    limit?: number;
    offset?: number;
  }): Promise<BuildCacheConfig[]> {
    let result = Array.from(this.store.values());
    if (options?.level) result = result.filter(c => c.level === options.level);
    if (options?.status) result = result.filter(c => c.status === options.status);
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  async createConfig(data: {
    level: CacheLevel;
    targetId?: string;
    status: CacheStatus;
    storageType: CacheStorageType;
    storagePath?: string;
    maxTotalSize?: string;
    maxAgeDays?: number;
    cleanupPolicy: CacheCleanupPolicy;
    cacheKeyPattern?: string;
    cachePaths: string[];
    description?: string;
  }): Promise<BuildCacheConfig> {
    const now = new Date();
    const config: BuildCacheConfig = {
      id: `config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level: data.level,
      targetId: data.targetId,
      status: data.status,
      storageType: data.storageType,
      storagePath: data.storagePath,
      maxTotalSize: data.maxTotalSize,
      maxAgeDays: data.maxAgeDays,
      cleanupPolicy: data.cleanupPolicy,
      cacheKeyPattern: data.cacheKeyPattern,
      cachePaths: data.cachePaths,
      description: data.description,
      createdAt: now,
    };
    this.store.set(config.id, config);
    return config;
  }

  async updateConfig(id: string, data: Partial<Record<string, unknown>>): Promise<BuildCacheConfig> {
    const config = this.store.get(id);
    if (!config) throw new Error(`Config '${id}' not found`);
    const updated = { ...config, updatedAt: new Date() };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        // Map snake_case back to camelCase for the entity
        const camelKey = key === 'storage_type' ? 'storageType' :
          key === 'storage_path' ? 'storagePath' :
          key === 'max_total_size' ? 'maxTotalSize' :
          key === 'max_age_days' ? 'maxAgeDays' :
          key === 'cleanup_policy' ? 'cleanupPolicy' :
          key === 'cache_key_pattern' ? 'cacheKeyPattern' :
          key === 'cache_paths' ? 'cachePaths' :
          key;
        (updated as any)[camelKey] = value;
      }
    }
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

class MockEntryRepository extends BuildCacheEntryRepository {
  private store: Map<string, CacheEntry> = new Map();

  constructor() {
    super({ query: async () => ({ rows: [], rowCount: 0 }) });
  }

  async findById(id: string): Promise<CacheEntry | undefined> {
    return this.store.get(id);
  }

  async findByCacheKey(configId: string, cacheKey: string): Promise<CacheEntry | undefined> {
    for (const entry of this.store.values()) {
      if (entry.configId === configId && entry.cacheKey === cacheKey) {
        return entry;
      }
    }
    return undefined;
  }

  async findByConfigId(configId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<CacheEntry[]> {
    let result = Array.from(this.store.values()).filter(e => e.configId === configId);
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  async findAllWithFilter(options?: {
    configId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CacheEntry[]> {
    let result = Array.from(this.store.values());
    if (options?.configId) result = result.filter(e => e.configId === options.configId);
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [id, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(id);
        count++;
      }
    }
    return count;
  }

  async deleteByConfigId(configId: string): Promise<number> {
    let count = 0;
    for (const [id, entry] of this.store.entries()) {
      if (entry.configId === configId) {
        this.store.delete(id);
        count++;
      }
    }
    return count;
  }

  async findLRUEntries(configId: string): Promise<CacheEntry[]> {
    return Array.from(this.store.values())
      .filter(e => e.configId === configId)
      .sort((a, b) => {
        const aTime = a.lastHitAt?.getTime() || a.createdAt.getTime();
        const bTime = b.lastHitAt?.getTime() || b.createdAt.getTime();
        return aTime - bTime;
      });
  }

  async recordHit(id: string): Promise<CacheEntry> {
    const entry = this.store.get(id);
    if (!entry) throw new Error(`Cache entry '${id}' not found`);
    const updated = {
      ...entry,
      hitCount: entry.hitCount + 1,
      lastHitAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async createEntry(data: {
    configId: string;
    cacheKey: string;
    hash: string;
    size?: number;
    storagePath: string;
    hitCount?: number;
    lastHitAt?: Date;
    expiresAt?: Date;
  }): Promise<CacheEntry> {
    const now = new Date();
    const entry: CacheEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      configId: data.configId,
      cacheKey: data.cacheKey,
      hash: data.hash,
      size: data.size,
      storagePath: data.storagePath,
      hitCount: data.hitCount || 0,
      lastHitAt: data.lastHitAt,
      expiresAt: data.expiresAt,
      createdAt: now,
    };
    this.store.set(entry.id, entry);
    return entry;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

// ==================== Tests ====================

describe('BuildCacheService', () => {
  let service: BuildCacheService;

  beforeEach(() => {
    const configRepo = new MockConfigRepository();
    const entryRepo = new MockEntryRepository();
    service = new BuildCacheService(configRepo, entryRepo);
  });

  describe('createConfig', () => {
    it('should create a cache config', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules', '.cache'],
        storageType: CacheStorageType.LOCAL_VOLUME,
        maxTotalSize: '10Gi',
        maxAgeDays: 30,
        cleanupPolicy: CacheCleanupPolicy.LRU,
      });

      expect(config).toBeDefined();
      expect(config.level).toBe(CacheLevel.GLOBAL);
      expect(config.status).toBe(CacheStatus.ENABLED);
      expect(config.cachePaths).toEqual(['node_modules', '.cache']);
      expect(config.maxAgeDays).toBe(30);
    });

    it('should create a pipeline-level config', async () => {
      const config = await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'pipeline-123',
        cachePaths: ['dist'],
      });

      expect(config.level).toBe(CacheLevel.PIPELINE);
      expect(config.targetId).toBe('pipeline-123');
    });

    it('should throw error for duplicate config', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      await expect(
        service.createConfig({
          level: CacheLevel.GLOBAL,
          cachePaths: ['other'],
        })
      ).rejects.toThrow('Cache config already exists');
    });

    it('should require cachePaths', async () => {
      const config = await service.createConfig({
        level: CacheLevel.TASK,
        targetId: 'task-456',
        cachePaths: ['.cache'],
      });
      expect(config.cachePaths).toEqual(['.cache']);
    });
  });

  describe('getConfig', () => {
    it('should return config by ID', async () => {
      const created = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      const found = await service.getConfig(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.getConfig('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getConfigByLevelAndTarget', () => {
    it('should find config by level and target', async () => {
      await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'pipeline-abc',
        cachePaths: ['dist'],
      });

      const found = await service.getConfigByLevelAndTarget(
        CacheLevel.PIPELINE,
        'pipeline-abc'
      );
      expect(found).toBeDefined();
      expect(found?.targetId).toBe('pipeline-abc');
    });

    it('should find global config without target', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      const found = await service.getConfigByLevelAndTarget(CacheLevel.GLOBAL);
      expect(found).toBeDefined();
      expect(found?.level).toBe(CacheLevel.GLOBAL);
    });
  });

  describe('updateConfig', () => {
    it('should update config properties', async () => {
      const created = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      const updated = await service.updateConfig(created.id, {
        status: CacheStatus.DISABLED,
        maxAgeDays: 60,
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(CacheStatus.DISABLED);
      expect(updated?.maxAgeDays).toBe(60);
    });
  });

  describe('deleteConfig', () => {
    it('should delete a config', async () => {
      const created = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      const deleted = await service.deleteConfig(created.id);
      expect(deleted).toBe(true);

      const found = await service.getConfig(created.id);
      expect(found).toBeNull();
    });
  });

  describe('listConfigs', () => {
    it('should return all configs', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });
      await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'p1',
        cachePaths: ['dist'],
      });

      const configs = await service.listConfigs();
      expect(configs.length).toBe(2);
    });

    it('should filter by level', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });
      await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'p1',
        cachePaths: ['dist'],
      });

      const globalConfigs = await service.listConfigs({ level: CacheLevel.GLOBAL });
      expect(globalConfigs.every(c => c.level === CacheLevel.GLOBAL)).toBe(true);
    });
  });

  // ==================== 三级级联测试 ====================

  describe('isCacheEnabled (cascade)', () => {
    it('should check task level first', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        status: CacheStatus.ENABLED,
      });
      await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'pipeline-1',
        cachePaths: ['dist'],
        status: CacheStatus.ENABLED,
      });
      await service.createConfig({
        level: CacheLevel.TASK,
        targetId: 'task-1',
        cachePaths: ['.cache'],
        status: CacheStatus.DISABLED,
      });

      const enabled = await service.isCacheEnabled('pipeline-1', 'task-1');
      expect(enabled).toBe(false);
    });

    it('should fall back to pipeline level if no task config', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        status: CacheStatus.DISABLED,
      });
      await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'pipeline-1',
        cachePaths: ['dist'],
        status: CacheStatus.ENABLED,
      });

      const enabled = await service.isCacheEnabled('pipeline-1');
      expect(enabled).toBe(true);
    });

    it('should fall back to global level if no pipeline config', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        status: CacheStatus.ENABLED,
      });

      const enabled = await service.isCacheEnabled('non-existent-pipeline');
      expect(enabled).toBe(true);
    });

    it('should return true by default if no config exists', async () => {
      const enabled = await service.isCacheEnabled('new-pipeline');
      expect(enabled).toBe(true);
    });
  });

  describe('getEffectiveConfig (cascade)', () => {
    it('should return task level config when available', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['global-cache'],
      });
      await service.createConfig({
        level: CacheLevel.TASK,
        targetId: 'task-1',
        cachePaths: ['task-cache'],
      });

      const config = await service.getEffectiveConfig('pipeline-1', 'task-1');
      expect(config).toBeDefined();
      expect(config?.cachePaths).toEqual(['task-cache']);
    });

    it('should return pipeline config when no task config', async () => {
      await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['global-cache'],
      });
      await service.createConfig({
        level: CacheLevel.PIPELINE,
        targetId: 'pipeline-1',
        cachePaths: ['pipeline-cache'],
      });

      const config = await service.getEffectiveConfig('pipeline-1');
      expect(config?.cachePaths).toEqual(['pipeline-cache']);
    });
  });

  // ==================== 缓存条目管理 ====================

  describe('Cache Entry Management', () => {
    it('should create a cache entry', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      const entry = await service.createCacheEntry(
        config.id,
        'abc123',
        '/cache/abc123'
      );

      expect(entry).toBeDefined();
      expect(entry.configId).toBe(config.id);
      expect(entry.hash).toBe('abc123');
      expect(entry.hitCount).toBe(0);
    });

    it('should generate cache key from pattern', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        cacheKeyPattern: 'build-{{hash}}-v1',
      });

      const entry = await service.createCacheEntry(
        config.id,
        'abc123',
        '/cache/abc123'
      );

      expect(entry.cacheKey).toBe('build-abc123-v1');
    });

    it('should find cache entry by key', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');
      const entry = await service.getCacheEntryByKey(config.id, 'cache-hash1');

      expect(entry).toBeDefined();
      expect(entry?.hitCount).toBe(1);
    });

    it('should return null for expired entry', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        maxAgeDays: 0,
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');

      const entry = await service.getCacheEntryByKey(config.id, 'cache-hash1');
      expect(entry).toBeNull();
    });

    it('should list cache entries', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');
      await service.createCacheEntry(config.id, 'hash2', '/cache/hash2');

      const entries = await service.listCacheEntries({ configId: config.id });
      expect(entries.length).toBe(2);
    });
  });

  // ==================== 缓存清理 ====================

  describe('Cache Cleanup', () => {
    it('should cleanup expired entries', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        maxAgeDays: 0,
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');
      await service.createCacheEntry(config.id, 'hash2', '/cache/hash2');

      const cleaned = await service.cleanupExpired();
      expect(cleaned).toBeGreaterThan(0);
    });

    it('should cleanup LRU entries', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');
      await service.createCacheEntry(config.id, 'hash2', '/cache/hash2');
      await service.createCacheEntry(config.id, 'hash3', '/cache/hash3');

      await service.getCacheEntryByKey(config.id, 'cache-hash3');

      const cleaned = await service.cleanupLRU(config.id, 1);
      expect(cleaned).toBe(2);
    });

    it('should clear all entries for a config', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');
      await service.createCacheEntry(config.id, 'hash2', '/cache/hash2');

      const cleaned = await service.clearConfigCache(config.id);
      expect(cleaned).toBe(2);

      const entries = await service.listCacheEntries({ configId: config.id });
      expect(entries.length).toBe(0);
    });
  });

  // ==================== 辅助函数测试 ====================

  describe('computeDependencyHash', () => {
    it('should compute a deterministic hash', async () => {
      const hash1 = service.computeDependencyHash(
        ['package.json', 'yarn.lock'],
        { 'package.json': 'aaa', 'yarn.lock': 'bbb' }
      );
      const hash2 = service.computeDependencyHash(
        ['yarn.lock', 'package.json'],
        { 'package.json': 'aaa', 'yarn.lock': 'bbb' }
      );

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different files', async () => {
      const hash1 = service.computeDependencyHash(
        ['package.json'],
        { 'package.json': 'aaa' }
      );
      const hash2 = service.computeDependencyHash(
        ['package.json'],
        { 'package.json': 'bbb' }
      );

      expect(hash1).not.toBe(hash2);
    });
  });
});
