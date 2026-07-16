/**
 * CacheRestoreSaveService 测试
 */

import { CacheRestoreSaveService, StageCacheConfig } from '../../services/build/CacheRestoreSaveService';
import { CacheStorageDriver } from '../../services/build/CacheStorageDriver';

// Mock cache storage driver
class MockCacheDriver implements CacheStorageDriver {
  private cache: Map<string, { paths: string[]; sizeBytes: number }> = new Map();

  async restore(
    key: string,
    restoreKeys: string[],
    targetDir: string
  ): Promise<{ matched: boolean; matchedKey?: string; restoredPaths: string[] }> {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      return { matched: true, matchedKey: key, restoredPaths: entry.paths };
    }
    // prefix match
    for (const rk of restoreKeys) {
      for (const [storedKey, entry] of this.cache.entries()) {
        if (storedKey.startsWith(rk.replace(/\*$/, ''))) {
          return { matched: true, matchedKey: storedKey, restoredPaths: entry.paths };
        }
      }
    }
    return { matched: false, restoredPaths: [] };
  }

  async save(
    key: string,
    paths: string[],
    baseDir: string
  ): Promise<{ saved: boolean; sizeBytes: number }> {
    const sizeBytes = paths.length * 1024;
    this.cache.set(key, { paths, sizeBytes });
    return { saved: true, sizeBytes };
  }

  async cleanup(): Promise<{ removedCount: number; freedBytes: number }> {
    return { removedCount: 0, freedBytes: 0 };
  }

  async stats(): Promise<{ totalEntries: number; totalSizeBytes: number }> {
    return { totalEntries: this.cache.size, totalSizeBytes: 0 };
  }

  clear(): void {
    this.cache.clear();
  }
}

describe('CacheRestoreSaveService', () => {
  let driver: MockCacheDriver;
  let service: CacheRestoreSaveService;

  beforeEach(() => {
    driver = new MockCacheDriver();
    service = new CacheRestoreSaveService(driver);
  });

  describe('restoreCache', () => {
    it('should return not restored when cache is disabled', async () => {
      const config: StageCacheConfig = { enabled: false, key: 'test-key', paths: ['node_modules'] };
      const result = await service.restoreCache(config, '/workspace');

      expect(result.restored).toBe(false);
      expect(result.restoredPaths).toEqual([]);
    });

    it('should restore cache when key matches', async () => {
      await driver.save('test-key', ['node_modules/pkg'], '/workspace');

      const config: StageCacheConfig = { enabled: true, key: 'test-key', paths: ['node_modules'] };
      const result = await service.restoreCache(config, '/workspace');

      expect(result.restored).toBe(true);
      expect(result.matchedKey).toBe('test-key');
      expect(result.restoredPaths).toContain('node_modules/pkg');
    });

    it('should restore cache with prefix match on restoreKeys', async () => {
      await driver.save('npm-abc123', ['node_modules/pkg'], '/workspace');

      const config: StageCacheConfig = {
        enabled: true,
        key: 'npm-xyz789',
        paths: ['node_modules'],
        restoreKeys: ['npm-'],
      };
      const result = await service.restoreCache(config, '/workspace');

      expect(result.restored).toBe(true);
      expect(result.matchedKey).toBe('npm-abc123');
    });

    it('should return not restored when no key matches', async () => {
      const config: StageCacheConfig = { enabled: true, key: 'missing-key', paths: ['node_modules'] };
      const result = await service.restoreCache(config, '/workspace');

      expect(result.restored).toBe(false);
    });
  });

  describe('saveCache', () => {
    it('should return not saved when cache is disabled', async () => {
      const config: StageCacheConfig = { enabled: false, key: 'test-key', paths: ['node_modules'] };
      const result = await service.saveCache(config, '/workspace');

      expect(result.saved).toBe(false);
      expect(result.sizeBytes).toBe(0);
    });

    it('should save cache when enabled', async () => {
      const config: StageCacheConfig = {
        enabled: true,
        key: 'test-key',
        paths: ['node_modules', 'dist'],
      };
      const result = await service.saveCache(config, '/workspace');

      expect(result.saved).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('mergeCacheConfigs', () => {
    it('should prefer stage config over pipeline over global', () => {
      const global: StageCacheConfig = { enabled: true, key: 'global-key', paths: ['global'] };
      const pipeline: StageCacheConfig = { enabled: false, key: 'pipeline-key', paths: ['pipeline'] };
      const stage: StageCacheConfig = { enabled: true, key: 'stage-key', paths: ['stage'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, pipeline, stage);

      expect(result.enabled).toBe(true);
      expect(result.key).toBe('stage-key');
      expect(result.paths).toEqual(['stage']);
    });

    it('should fall back to pipeline when stage is undefined', () => {
      const global: StageCacheConfig = { enabled: false, key: 'global-key', paths: [] };
      const pipeline: StageCacheConfig = { enabled: true, key: 'pipeline-key', paths: ['dist'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, pipeline, undefined);

      expect(result.enabled).toBe(true);
      expect(result.key).toBe('pipeline-key');
      expect(result.paths).toEqual(['dist']);
    });

    it('should fall back to global when both stage and pipeline are undefined', () => {
      const global: StageCacheConfig = { enabled: true, key: 'global-key', paths: ['node_modules'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, undefined, undefined);

      expect(result.enabled).toBe(true);
      expect(result.key).toBe('global-key');
      expect(result.paths).toEqual(['node_modules']);
    });

    it('should default to disabled when nothing is configured', () => {
      const result = CacheRestoreSaveService.mergeCacheConfigs(undefined, undefined, undefined);

      expect(result.enabled).toBe(false);
      expect(result.key).toBe('');
      expect(result.paths).toEqual([]);
    });

    it('should merge restoreKeys preferring stage over pipeline over global', () => {
      const global: StageCacheConfig = { enabled: false, key: '', paths: [], restoreKeys: ['global-'] };
      const pipeline: StageCacheConfig = { enabled: false, key: '', paths: [], restoreKeys: ['pipeline-'] };
      const stage: StageCacheConfig = { enabled: true, key: 'test', paths: ['src'], restoreKeys: ['stage-'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, pipeline, stage);

      expect(result.restoreKeys).toEqual(['stage-']);
    });

    it('should fall back to pipeline restoreKeys when stage has none', () => {
      const global: StageCacheConfig = { enabled: false, key: '', paths: [], restoreKeys: ['global-'] };
      const pipeline: StageCacheConfig = { enabled: true, key: 'test', paths: ['src'], restoreKeys: ['pipeline-'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, pipeline, undefined);

      expect(result.restoreKeys).toEqual(['pipeline-']);
    });
  });
});
