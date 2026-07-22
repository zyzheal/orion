/**
 * PipelineCacheService Tests
 *
 * F015: Cache acceleration for pipeline execution
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PipelineCacheService } from '../PipelineCacheService';
import { CacheStrategyService } from '../../cache/CacheStrategyService';

describe('PipelineCacheService', () => {
  let cacheService: CacheStrategyService;
  let pipelineCache: PipelineCacheService;

  beforeEach(() => {
    cacheService = new CacheStrategyService(null); // No Redis for tests
    pipelineCache = new PipelineCacheService(cacheService);
  });

  describe('Parsed Pipeline Config', () => {
    it('should cache and retrieve parsed config', async () => {
      const config = { name: 'test', stages: [] };
      await pipelineCache.cacheParsedPipelineConfig('pipeline-1', config);

      const retrieved = await pipelineCache.getCachedParsedConfig('pipeline-1');
      expect(retrieved).toEqual(config);
    });

    it('should return undefined for missing config', async () => {
      const result = await pipelineCache.getCachedParsedConfig('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should invalidate config', async () => {
      const config = { name: 'test', stages: [] };
      await pipelineCache.cacheParsedPipelineConfig('pipeline-1', config);
      await pipelineCache.invalidateParsedConfig('pipeline-1');

      const result = await pipelineCache.getCachedParsedConfig('pipeline-1');
      expect(result).toBeUndefined();
    });
  });

  describe('Recent Runs', () => {
    it('should cache recent runs', async () => {
      const runs = [
        { id: 'run-1', status: 'success' },
        { id: 'run-2', status: 'failed' },
      ];
      await pipelineCache.cacheRecentRuns('pipeline-1', runs);

      const retrieved = await pipelineCache.getCachedRecentRuns('pipeline-1');
      expect(retrieved).toEqual(runs);
    });
  });

  describe('Webhook Payload Deduplication', () => {
    it('should cache webhook payload', async () => {
      const payload = { sha: 'abc123', action: 'push' };
      await pipelineCache.cacheWebhookPayload('abc123', 'push', payload);

      const has = await pipelineCache.hasRecentWebhookPayload('abc123', 'push');
      expect(has).toBe(true);
    });

    it('should return false for non-cached webhook', async () => {
      const has = await pipelineCache.hasRecentWebhookPayload('nonexistent', 'push');
      expect(has).toBe(false);
    });
  });

  describe('Stage Template', () => {
    it('should cache stage template', async () => {
      const template = { type: 'build', image: 'node:18' };
      await pipelineCache.cacheStageTemplate('build', template);

      const retrieved = await pipelineCache.getCachedStageTemplate('build');
      expect(retrieved).toEqual(template);
    });
  });

  describe('getOrLoadConfig', () => {
    it('should load and cache config', async () => {
      let loadCalled = 0;
      const result = await pipelineCache.getOrLoadConfig(
        'pipeline-1',
        async () => {
          loadCalled++;
          return { name: 'test', stages: [] };
        },
      );

      expect(result).toEqual({ name: 'test', stages: [] });
      expect(loadCalled).toBe(1);

      // Second call should use cache
      const result2 = await pipelineCache.getOrLoadConfig(
        'pipeline-1',
        async () => {
          loadCalled++;
          return { name: 'cached', stages: [] };
        },
      );
      expect(result2).toEqual({ name: 'test', stages: [] });
      expect(loadCalled).toBe(1); // Still 1, cached
    });
  });

  describe('Bulk Invalidation', () => {
    it('should invalidate all pipeline cache entries', async () => {
      // Add some entries
      await pipelineCache.cacheParsedPipelineConfig('p1', { name: 'p1' });
      await pipelineCache.cacheParsedPipelineConfig('p2', { name: 'p2' });
      await pipelineCache.cacheRecentRuns('p1', [{ id: 'run-1' }]);
      await pipelineCache.cacheStageTemplate('build', { type: 'build' });

      // Invalidate all
      await pipelineCache.invalidateAll();

      // Verify all cleared
      expect(await pipelineCache.getCachedParsedConfig('p1')).toBeUndefined();
      expect(await pipelineCache.getCachedParsedConfig('p2')).toBeUndefined();
      expect(await pipelineCache.getCachedRecentRuns('p1')).toBeUndefined();
      expect(await pipelineCache.getCachedStageTemplate('build')).toBeUndefined();
    });
  });
});
