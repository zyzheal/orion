/**
 * BuildCache 模型测试
 */
import {
  generateCacheKey,
  createBuildCacheConfig,
  updateBuildCacheConfig,
  createCacheEntry,
  recordCacheHit,
  CacheLevel,
  CacheStorageType,
  CacheCleanupPolicy,
  CacheStatus,
} from '../BuildCache';

describe('BuildCache', () => {
  describe('generateCacheKey', () => {
    it('should replace hash placeholder', () => {
      const key = generateCacheKey('cache-{{hash}}', 'abc123');
      expect(key).toBe('cache-abc123');
    });

    it('should use default pattern', () => {
      const key = generateCacheKey(undefined, 'xyz');
      expect(key).toBe('cache-xyz');
    });
  });

  describe('createBuildCacheConfig', () => {
    it('should create config with required fields', () => {
      const config = createBuildCacheConfig({
        level: CacheLevel.PIPELINE,
        cachePaths: ['/app/node_modules'],
      });

      expect(config.id).toBeDefined();
      expect(config.level).toBe(CacheLevel.PIPELINE);
      expect(config.status).toBe(CacheStatus.ENABLED);
      expect(config.storageType).toBe(CacheStorageType.LOCAL_VOLUME);
      expect(config.maxAgeDays).toBe(30);
      expect(config.cleanupPolicy).toBe(CacheCleanupPolicy.LRU);
      expect(config.cachePaths).toEqual(['/app/node_modules']);
    });

    it('should accept custom values', () => {
      const config = createBuildCacheConfig({
        level: CacheLevel.TASK,
        targetId: 'task-1',
        status: CacheStatus.DISABLED,
        storageType: CacheStorageType.S3,
        storagePath: 's3://cache/',
        maxTotalSize: '10Gi',
        maxAgeDays: 7,
        cleanupPolicy: CacheCleanupPolicy.TTL,
        cacheKeyPattern: '{{hash}}-custom',
        cachePaths: ['/tmp/cache'],
        description: 'test cache',
      });

      expect(config.targetId).toBe('task-1');
      expect(config.status).toBe(CacheStatus.DISABLED);
      expect(config.storageType).toBe(CacheStorageType.S3);
      expect(config.maxTotalSize).toBe('10Gi');
      expect(config.maxAgeDays).toBe(7);
      expect(config.cleanupPolicy).toBe(CacheCleanupPolicy.TTL);
      expect(config.description).toBe('test cache');
    });
  });

  describe('updateBuildCacheConfig', () => {
    it('should update specified fields', () => {
      const config = createBuildCacheConfig({
        level: CacheLevel.GLOBAL,
        cachePaths: ['/cache'],
      });

      const updated = updateBuildCacheConfig(config, {
        status: CacheStatus.DISABLED,
        maxAgeDays: 60,
      });

      expect(updated.status).toBe(CacheStatus.DISABLED);
      expect(updated.maxAgeDays).toBe(60);
      expect(updated.level).toBe(CacheLevel.GLOBAL);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('createCacheEntry', () => {
    it('should create entry with defaults', () => {
      const entry = createCacheEntry('config-1', 'abc123', '/cache/abc123');

      expect(entry.id).toBeDefined();
      expect(entry.configId).toBe('config-1');
      expect(entry.cacheKey).toBe('cache-abc123');
      expect(entry.hash).toBe('abc123');
      expect(entry.storagePath).toBe('/cache/abc123');
      expect(entry.hitCount).toBe(0);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('recordCacheHit', () => {
    it('should increment hitCount', () => {
      const entry = createCacheEntry('config-1', 'abc', '/cache/abc');
      const updated = recordCacheHit(entry);

      expect(updated.hitCount).toBe(1);
      expect(updated.lastHitAt).toBeInstanceOf(Date);
    });

    it('should accumulate hits', () => {
      let entry = createCacheEntry('config-1', 'abc', '/cache/abc');
      entry = recordCacheHit(entry);
      entry = recordCacheHit(entry);
      entry = recordCacheHit(entry);

      expect(entry.hitCount).toBe(3);
    });
  });

  describe('enums', () => {
    it('CacheLevel should have correct values', () => {
      expect(CacheLevel.GLOBAL).toBe('global');
      expect(CacheLevel.PIPELINE).toBe('pipeline');
      expect(CacheLevel.TASK).toBe('task');
    });

    it('CacheStorageType should have correct values', () => {
      expect(CacheStorageType.LOCAL_VOLUME).toBe('local-volume');
      expect(CacheStorageType.S3).toBe('s3');
      expect(CacheStorageType.NFS).toBe('nfs');
    });

    it('CacheCleanupPolicy should have correct values', () => {
      expect(CacheCleanupPolicy.LRU).toBe('lru');
      expect(CacheCleanupPolicy.TTL).toBe('ttl');
      expect(CacheCleanupPolicy.MANUAL).toBe('manual');
      expect(CacheCleanupPolicy.NEVER).toBe('never');
    });

    it('CacheStatus should have correct values', () => {
      expect(CacheStatus.ENABLED).toBe('enabled');
      expect(CacheStatus.DISABLED).toBe('disabled');
    });
  });
});
