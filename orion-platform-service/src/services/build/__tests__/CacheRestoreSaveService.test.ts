/**
 * CacheRestoreSaveService Tests
 *
 * Tests for cache restore/save lifecycle and configuration merging.
 */

import { CacheRestoreSaveService, StageCacheConfig } from '../CacheRestoreSaveService';

describe('CacheRestoreSaveService', () => {
  let service: CacheRestoreSaveService;

  beforeEach(() => {
    service = new CacheRestoreSaveService();
  });

  describe('mergeCacheConfigs', () => {
    test('should use stage config when all levels provided', () => {
      const global: StageCacheConfig = { enabled: false, key: 'global-key', paths: ['global/**'] };
      const pipeline: StageCacheConfig = { enabled: true, key: 'pipeline-key', paths: ['pipeline/**'] };
      const stage: StageCacheConfig = { enabled: true, key: 'stage-key', paths: ['stage/**'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, pipeline, stage);

      expect(result.enabled).toBe(true);
      expect(result.key).toBe('stage-key');
      expect(result.paths).toEqual(['stage/**']);
    });

    test('should fall back to pipeline config when stage not provided', () => {
      const global: StageCacheConfig = { enabled: false, key: 'global-key', paths: ['global/**'] };
      const pipeline: StageCacheConfig = { enabled: true, key: 'pipeline-key', paths: ['pipeline/**'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, pipeline, undefined);

      expect(result.key).toBe('pipeline-key');
      expect(result.paths).toEqual(['pipeline/**']);
    });

    test('should fall back to global config when only global provided', () => {
      const global: StageCacheConfig = { enabled: true, key: 'global-key', paths: ['node_modules/**'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, undefined, undefined);

      expect(result.enabled).toBe(true);
      expect(result.key).toBe('global-key');
      expect(result.paths).toEqual(['node_modules/**']);
    });

    test('should default to disabled when no config provided', () => {
      const result = CacheRestoreSaveService.mergeCacheConfigs();

      expect(result.enabled).toBe(false);
      expect(result.key).toBe('');
      expect(result.paths).toEqual([]);
    });

    test('should merge restoreKeys from different levels', () => {
      const global: StageCacheConfig = { enabled: true, key: 'k', paths: ['p'], restoreKeys: ['global-*'] };
      const stage: StageCacheConfig = { enabled: true, key: 'k', paths: ['p'], restoreKeys: ['stage-*'] };

      const result = CacheRestoreSaveService.mergeCacheConfigs(global, undefined, stage);

      expect(result.restoreKeys).toEqual(['stage-*']);
    });
  });

  describe('restoreCache', () => {
    test('should return not restored when cache is disabled', async () => {
      const config: StageCacheConfig = { enabled: false, key: 'test-key', paths: ['node_modules'] };

      const result = await service.restoreCache(config, '/tmp/test');

      expect(result.restored).toBe(false);
      expect(result.durationMs).toBe(0);
    });

    test('should attempt restore when enabled (may fail if no cache exists)', async () => {
      const config: StageCacheConfig = {
        enabled: true,
        key: 'test-nonexistent-key',
        paths: ['node_modules'],
      };

      const result = await service.restoreCache(config, '/tmp/test-cache-restore');

      expect(result).toBeDefined();
      expect(typeof result.restored).toBe('boolean');
    });
  });

  describe('saveCache', () => {
    test('should return not saved when cache is disabled', async () => {
      const config: StageCacheConfig = { enabled: false, key: 'test-key', paths: ['node_modules'] };

      const result = await service.saveCache(config, '/tmp/test');

      expect(result.saved).toBe(false);
      expect(result.durationMs).toBe(0);
    });

    test('should attempt save when enabled', async () => {
      const config: StageCacheConfig = {
        enabled: true,
        key: 'test-save-key',
        paths: ['package.json'],
      };

      const result = await service.saveCache(config, process.cwd());

      expect(result).toBeDefined();
      expect(typeof result.saved).toBe('boolean');
    });
  });
});
