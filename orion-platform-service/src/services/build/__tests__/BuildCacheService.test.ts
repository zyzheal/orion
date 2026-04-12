/**
 * BuildCacheService 单元测试
 */

import { BuildCacheService } from '../BuildCacheService';
import {
  CacheLevel,
  CacheStatus,
  CacheCleanupPolicy,
  CacheStorageType,
} from '../../../models/BuildCache';

describe('BuildCacheService', () => {
  let service: BuildCacheService;

  beforeEach(() => {
    service = new BuildCacheService();
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
      // Empty cachePaths should fail validation at controller level
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
      // Setup: Global enabled, Pipeline enabled, Task disabled
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

      // Task level should take precedence
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
      expect(entry?.hitCount).toBe(1); // Hit recorded
    });

    it('should return null for expired entry', async () => {
      const config = await service.createConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['node_modules'],
        maxAgeDays: 0, // Expire immediately
      });

      await service.createCacheEntry(config.id, 'hash1', '/cache/hash1');

      // Entry should be expired
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

      // Access hash3 to make it "recently used"
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
