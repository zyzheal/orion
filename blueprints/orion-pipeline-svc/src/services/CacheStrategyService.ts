/**
 * CacheStrategyService - Business logic for dependency cache management
 */

import { DatabasePool } from '../utils/database';
import { CacheStrategyRepository } from '../repositories/CacheStrategyRepository';
import type {
  CacheStrategy,
  CacheStrategyCreateInput,
  CacheStrategyUpdateInput,
  CacheStrategyFilter,
  CacheRecommendation,
  CacheType,
} from '../models/CacheStrategy';
import pino from 'pino';

const logger = pino({ name: 'CacheStrategyService' });

// Default cache recommendations by language/runtime
const DEFAULT_RECOMMENDATIONS: Record<CacheType, Omit<CacheRecommendation, 'type'>> = {
  npm: {
    keyTemplate: 'npm:{{hashFiles(package-lock.json)}}',
    paths: ['node_modules', '.npm'],
    restoreKeys: ['npm:', 'npm-cache:'],
    maxAge: 7 * 24 * 3600, // 7 days
    reason: 'npm uses package-lock.json for reproducible builds',
  },
  pip: {
    keyTemplate: 'pip:{{hashFiles(requirements.txt)}}',
    paths: ['.cache/pip', '__pycache__'],
    restoreKeys: ['pip-'],
    maxAge: 7 * 24 * 3600,
    reason: 'pip uses requirements.txt for dependency locking',
  },
  maven: {
    keyTemplate: 'maven:{{hashFiles(pom.xml)}}',
    paths: ['.m2/repository'],
    restoreKeys: ['maven-'],
    maxAge: 7 * 24 * 3600,
    reason: 'Maven local repository contains all dependencies',
  },
  gradle: {
    keyTemplate: 'gradle:{{hashFiles(build.gradle, settings.gradle)}}',
    paths: ['.gradle/caches', 'build'],
    restoreKeys: ['gradle-'],
    maxAge: 7 * 24 * 3600,
    reason: 'Gradle caches dependencies and build outputs',
  },
  custom: {
    keyTemplate: 'custom:{{hashFiles(.cache-key)}}',
    paths: ['.cache'],
    restoreKeys: [],
    maxAge: 24 * 3600, // 1 day
    reason: 'Custom cache configuration',
  },
};

export class CacheStrategyService {
  private repository: CacheStrategyRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new CacheStrategyRepository(pool);
  }

  /**
   * Create a new cache strategy
   */
  async create(input: CacheStrategyCreateInput): Promise<CacheStrategy> {
    logger.info({ tenantId: input.tenantId, type: input.type, name: input.name }, 'Creating cache strategy');
    return this.repository.create(input);
  }

  /**
   * Get cache strategy by ID
   */
  async getById(tenantId: string, id: string): Promise<CacheStrategy | null> {
    return this.repository.findById(tenantId, id);
  }

  /**
   * List cache strategies with filters
   */
  async list(filter: CacheStrategyFilter): Promise<{ data: CacheStrategy[]; total: number }> {
    return this.repository.findAll(filter);
  }

  /**
   * Get enabled strategies by type
   */
  async getByType(tenantId: string, type: CacheType): Promise<CacheStrategy[]> {
    return this.repository.findByType(tenantId, type);
  }

  /**
   * Update cache strategy
   */
  async update(tenantId: string, id: string, input: CacheStrategyUpdateInput): Promise<CacheStrategy | null> {
    logger.info({ tenantId, id, input }, 'Updating cache strategy');
    return this.repository.update(tenantId, id, input);
  }

  /**
   * Delete cache strategy
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    logger.info({ tenantId, id }, 'Deleting cache strategy');
    return this.repository.delete(tenantId, id);
  }

  /**
   * Get recommended cache configuration for a type
   */
  async getRecommendedCache(type: CacheType): Promise<CacheRecommendation> {
    const defaultConfig = DEFAULT_RECOMMENDATIONS[type];
    if (!defaultConfig) {
      throw new Error(`Unknown cache type: ${type}`);
    }

    return {
      type,
      ...defaultConfig,
    };
  }

  /**
   * Get all recommended caches
   */
  async getAllRecommendations(): Promise<CacheRecommendation[]> {
    const types: CacheType[] = ['npm', 'pip', 'maven', 'gradle', 'custom'];
    return types.map((type) => ({
      type,
      ...DEFAULT_RECOMMENDATIONS[type],
    }));
  }

  /**
   * Create recommended cache strategy for a type
   */
  async createRecommendedCache(
    tenantId: string,
    type: CacheType,
    name: string,
    createdBy?: string
  ): Promise<CacheStrategy> {
    const recommendation = await this.getRecommendedCache(type);

    return this.create({
      tenantId,
      name,
      type,
      keyTemplate: recommendation.keyTemplate,
      paths: recommendation.paths,
      restoreKeys: recommendation.restoreKeys,
      maxAge: recommendation.maxAge,
      enabled: true,
      createdBy,
    });
  }

  /**
   * Record cache hit
   */
  async recordHit(tenantId: string, strategyId: string): Promise<void> {
    await this.repository.recordHit(tenantId, strategyId);
  }

  /**
   * Record cache miss
   */
  async recordMiss(tenantId: string, strategyId: string): Promise<void> {
    await this.repository.recordMiss(tenantId, strategyId);
  }

  /**
   * Get cache statistics for a strategy
   */
  async getCacheStats(tenantId: string, strategyId: string): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    lastHitAt?: Date;
  }> {
    const stats = await this.repository.getStats(tenantId, strategyId);
    if (!stats) {
      return { hits: 0, misses: 0, hitRate: 0 };
    }

    const hits = parseInt(stats.hits, 10) || 0;
    const misses = parseInt(stats.misses, 10) || 0;
    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;

    return {
      hits,
      misses,
      hitRate,
      lastHitAt: stats.last_hit_at,
    };
  }

  /**
   * Get all cache statistics for a tenant
   */
  async getAllCacheStats(tenantId: string): Promise<{
    strategyId: string;
    strategyName: string;
    hits: number;
    misses: number;
    hitRate: number;
    lastHitAt?: Date;
  }[]> {
    const { data: strategies } = await this.list({ tenantId, limit: 100 });

    const results = [];
    for (const strategy of strategies) {
      const stats = await this.getCacheStats(tenantId, strategy.id);
      results.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        ...stats,
      });
    }

    return results;
  }

  /**
   * Warm cache (simulate pre-population)
   * In a real implementation, this would trigger actual cache warming
   */
  async warmCache(tenantId: string, strategyId: string): Promise<{ success: boolean; message: string }> {
    const strategy = await this.getById(tenantId, strategyId);
    if (!strategy) {
      return { success: false, message: 'Strategy not found' };
    }

    if (!strategy.enabled) {
      return { success: false, message: 'Strategy is disabled' };
    }

    logger.info({ tenantId, strategyId, type: strategy.type }, 'Warming cache');

    // In a real implementation, this would:
    // 1. Trigger a pipeline run to populate the cache
    // 2. Or fetch and store cache artifacts
    // For now, we just log the intention

    return {
      success: true,
      message: `Cache warming initiated for ${strategy.name} (${strategy.type})`,
    };
  }

  /**
   * Generate cache key from template
   */
  generateCacheKey(keyTemplate: string, context: Record<string, string>): string {
    let key = keyTemplate;

    // Replace {{hashFiles(...)}} placeholders
    // In a real implementation, this would compute actual file hashes
    const hashFilePattern = /\{\{hashFiles\(([^)]+)\)\}\}/g;
    key = key.replace(hashFilePattern, (_match, filePattern) => {
      // Simulated hash - in reality would compute from actual files
      return `simulated-hash-${filePattern.replace(/[^a-z0-9]/g, '-')}`;
    });

    // Replace other placeholders
    for (const [contextKey, value] of Object.entries(context)) {
      key = key.replace(new RegExp(`\\{\\{${contextKey}\\}\\}`, 'g'), value);
    }

    return key;
  }
}