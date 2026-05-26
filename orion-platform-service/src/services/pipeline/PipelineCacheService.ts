/**
 * PipelineCacheService - Pipeline execution cache acceleration
 *
 * F015: Cache acceleration for pipeline execution paths.
 *
 * Caches:
 * - Pipeline YAML/JSON parsed configs (avoid re-parsing)
 * - Pipeline run history (recent runs for comparison)
 * - SCM webhook payloads (deduplication)
 * - Stage execution templates (reusable stage configs)
 */

import { CacheStrategyService } from '../cache/CacheStrategyService';

export class PipelineCacheService {
  private cache: CacheStrategyService;

  constructor(cache: CacheStrategyService) {
    this.cache = cache;
  }

  // ─── Pipeline Config Cache ─────────────────────────────────────────────

  /**
   * Cache a parsed pipeline config.
   * Key format: `pipeline:config:{pipelineId}`
   * TTL: 5 minutes (configs change infrequently)
   */
  async cacheParsedPipelineConfig(
    pipelineId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    await this.cache.set(
      `pipeline:config:${pipelineId}`,
      config,
      5 * 60 * 1000, // 5 min
    );
  }

  /**
   * Get cached parsed pipeline config.
   */
  async getCachedParsedConfig(
    pipelineId: string,
  ): Promise<Record<string, unknown> | undefined> {
    return this.cache.get<Record<string, unknown>>(`pipeline:config:${pipelineId}`);
  }

  /**
   * Invalidate parsed pipeline config.
   */
  async invalidateParsedConfig(pipelineId: string): Promise<void> {
    await this.cache.delete(`pipeline:config:${pipelineId}`);
  }

  // ─── Pipeline Run History Cache ────────────────────────────────────────

  /**
   * Cache recent pipeline runs for quick comparison.
   * Key format: `pipeline:runs:{pipelineId}:recent`
   * TTL: 2 minutes
   */
  async cacheRecentRuns(
    pipelineId: string,
    runs: Array<Record<string, unknown>>,
  ): Promise<void> {
    await this.cache.set(
      `pipeline:runs:${pipelineId}:recent`,
      runs,
      2 * 60 * 1000, // 2 min
    );
  }

  /**
   * Get cached recent runs.
   */
  async getCachedRecentRuns(
    pipelineId: string,
  ): Promise<Array<Record<string, unknown>> | undefined> {
    return this.cache.get<Array<Record<string, unknown>>>(
      `pipeline:runs:${pipelineId}:recent`,
    );
  }

  // ─── SCM Webhook Payload Cache (Deduplication) ─────────────────────────

  /**
   * Cache SCM webhook payload for deduplication.
   * Key format: `pipeline:webhook:{sha}:{event}`
   * TTL: 10 minutes
   */
  async cacheWebhookPayload(
    sha: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.cache.set(
      `pipeline:webhook:${sha}:${event}`,
      payload,
      10 * 60 * 1000, // 10 min
    );
  }

  /**
   * Check if webhook payload was recently received (deduplication).
   */
  async hasRecentWebhookPayload(
    sha: string,
    event: string,
  ): Promise<boolean> {
    const existing = await this.cache.get<Record<string, unknown>>(
      `pipeline:webhook:${sha}:${event}`,
    );
    return existing !== undefined;
  }

  // ─── Stage Template Cache ─────────────────────────────────────────────

  /**
   * Cache a stage execution template.
   * Key format: `pipeline:stage-template:{type}`
   * TTL: 30 minutes (stage templates are static)
   */
  async cacheStageTemplate(
    type: string,
    template: Record<string, unknown>,
  ): Promise<void> {
    await this.cache.set(
      `pipeline:stage-template:${type}`,
      template,
      30 * 60 * 1000, // 30 min
    );
  }

  /**
   * Get cached stage template.
   */
  async getCachedStageTemplate(
    type: string,
  ): Promise<Record<string, unknown> | undefined> {
    return this.cache.get<Record<string, unknown>>(`pipeline:stage-template:${type}`);
  }

  // ─── Pipeline Execution Cache (orLoad pattern) ────────────────────────

  /**
   * Get or load parsed config with automatic caching.
   * This is the primary method for pipeline config loading.
   */
  async getOrLoadConfig<T>(
    pipelineId: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.cache.getOrLoad(
      `pipeline:config:${pipelineId}`,
      loader,
      5 * 60 * 1000,
    );
  }

  // ─── Bulk Invalidation ────────────────────────────────────────────────

  /**
   * Invalidate all pipeline-related cache entries for a given pipeline.
   */
  async invalidatePipeline(pipelineId: string): Promise<void> {
    await Promise.all([
      this.cache.delete(`pipeline:config:${pipelineId}`),
      this.cache.delete(`pipeline:runs:${pipelineId}:recent`),
      // Runs and stage templates are shared, so we don't invalidate by pipeline
    ]);
  }

  /**
   * Invalidate all stage template cache.
   */
  async invalidateAllStageTemplates(): Promise<void> {
    const count = this.cache.deleteByPattern('pipeline:stage-template:*');
    return;
  }

  /**
   * Invalidate all pipeline cache entries.
   */
  async invalidateAll(): Promise<void> {
    const count1 = this.cache.deleteByPattern('pipeline:config:*');
    const count2 = this.cache.deleteByPattern('pipeline:runs:*');
    const count3 = this.cache.deleteByPattern('pipeline:webhook:*');
    const count4 = this.cache.deleteByPattern('pipeline:stage-template:*');
    return;
  }
}
