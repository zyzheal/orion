/**
 * Build Cache Service - 构建缓存管理服务
 *
 * 职责：
 * - 三级缓存开关管理：全局 -> 流水线 -> 任务
 * - 缓存键生成（基于依赖文件 hash）
 * - 缓存存储管理（通过 PostgreSQL Repository）
 * - 缓存清理策略
 *
 * 使用 PostgreSQL Repository 替代 Map() 内存存储，确保数据持久化。
 */

import {
  BuildCacheConfig,
  CacheEntry,
  CacheLevel,
  CacheStatus,
  CacheCleanupPolicy,
  CacheStorageType,
  BuildCacheConfigCreateInput,
  BuildCacheConfigUpdateInput,
  createBuildCacheConfig,
  updateBuildCacheConfig,
  createCacheEntry,
  generateCacheKey,
} from '../../models/BuildCache';
import {
  BuildCacheConfigRepository,
  BuildCacheEntryRepository,
} from '../../repositories/BuildCacheRepository';
import { OrionError, ErrorCode } from '../../../errors';

export class BuildCacheService {
  private configRepo: BuildCacheConfigRepository;
  private entryRepo: BuildCacheEntryRepository;

  constructor(
    configRepo: BuildCacheConfigRepository,
    entryRepo: BuildCacheEntryRepository,
  ) {
    this.configRepo = configRepo;
    this.entryRepo = entryRepo;
  }

  /**
   * 创建缓存配置
   */
  async createConfig(input: BuildCacheConfigCreateInput): Promise<BuildCacheConfig> {
    // 检查是否已存在相同级别的配置
    const existing = await this.configRepo.findByLevelAndTarget(
      input.level,
      input.targetId,
    );
    if (existing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cache config already exists for level=${input.level}, target=${input.targetId}`);
    }

    const config = createBuildCacheConfig(input);
    return this.configRepo.createConfig({
      level: config.level,
      targetId: config.targetId,
      status: config.status,
      storageType: config.storageType,
      storagePath: config.storagePath,
      maxTotalSize: config.maxTotalSize,
      maxAgeDays: config.maxAgeDays,
      cleanupPolicy: config.cleanupPolicy,
      cacheKeyPattern: config.cacheKeyPattern,
      cachePaths: config.cachePaths,
      description: config.description,
    });
  }

  /**
   * 获取缓存配置
   */
  async getConfig(id: string): Promise<BuildCacheConfig | null> {
    const config = await this.configRepo.findById(id);
    return config || null;
  }

  /**
   * 按级别和目标获取缓存配置
   */
  async getConfigByLevelAndTarget(
    level: CacheLevel,
    targetId?: string,
  ): Promise<BuildCacheConfig | null> {
    const config = await this.configRepo.findByLevelAndTarget(level, targetId);
    return config || null;
  }

  /**
   * 更新缓存配置
   */
  async updateConfig(
    id: string,
    input: BuildCacheConfigUpdateInput,
  ): Promise<BuildCacheConfig | null> {
    const config = await this.configRepo.findById(id);
    if (!config) {
      return null;
    }

    // Map update input to snake_case fields for the repository
    const updateData: Record<string, unknown> = {};
    if (input.status !== undefined) updateData.status = input.status;
    if (input.storageType !== undefined) updateData.storageType = input.storageType;
    if (input.storagePath !== undefined) updateData.storagePath = input.storagePath;
    if (input.maxTotalSize !== undefined) updateData.maxTotalSize = input.maxTotalSize;
    if (input.maxAgeDays !== undefined) updateData.maxAgeDays = input.maxAgeDays;
    if (input.cleanupPolicy !== undefined) updateData.cleanupPolicy = input.cleanupPolicy;
    if (input.cacheKeyPattern !== undefined) updateData.cacheKeyPattern = input.cacheKeyPattern;
    if (input.cachePaths !== undefined) updateData.cachePaths = input.cachePaths;
    if (input.description !== undefined) updateData.description = input.description;

    return this.configRepo.updateConfig(id, updateData);
  }

  /**
   * 删除缓存配置
   */
  async deleteConfig(id: string): Promise<boolean> {
    return this.configRepo.delete(id);
  }

  /**
   * 查询缓存配置列表
   */
  async listConfigs(options?: {
    level?: CacheLevel;
    status?: CacheStatus;
    limit?: number;
    offset?: number;
  }): Promise<BuildCacheConfig[]> {
    return this.configRepo.findAllWithFilters(options);
  }

  /**
   * 获取缓存开关状态（三级级联：任务 -> 流水线 -> 全局）
   *
   * @param pipelineId 流水线 ID
   * @param taskId 任务 ID（可选）
   * @returns 是否启用缓存
   */
  async isCacheEnabled(pipelineId: string, taskId?: string): Promise<boolean> {
    // 1. 优先检查任务级别
    if (taskId) {
      const taskConfig = await this.getConfigByLevelAndTarget(CacheLevel.TASK, taskId);
      if (taskConfig) {
        return taskConfig.status === CacheStatus.ENABLED;
      }
    }

    // 2. 检查流水线级别
    const pipelineConfig = await this.getConfigByLevelAndTarget(CacheLevel.PIPELINE, pipelineId);
    if (pipelineConfig) {
      return pipelineConfig.status === CacheStatus.ENABLED;
    }

    // 3. 检查全局级别
    const globalConfig = await this.getConfigByLevelAndTarget(CacheLevel.GLOBAL);
    if (globalConfig) {
      return globalConfig.status === CacheStatus.ENABLED;
    }

    // 默认启用
    return true;
  }

  /**
   * 获取缓存配置（三级级联）
   *
   * @param pipelineId 流水线 ID
   * @param taskId 任务 ID（可选）
   * @returns 生效的缓存配置
   */
  async getEffectiveConfig(
    pipelineId: string,
    taskId?: string,
  ): Promise<BuildCacheConfig | null> {
    // 1. 优先检查任务级别
    if (taskId) {
      const taskConfig = await this.getConfigByLevelAndTarget(CacheLevel.TASK, taskId);
      if (taskConfig) return taskConfig;
    }

    // 2. 检查流水线级别
    const pipelineConfig = await this.getConfigByLevelAndTarget(CacheLevel.PIPELINE, pipelineId);
    if (pipelineConfig) return pipelineConfig;

    // 3. 检查全局级别
    const globalConfig = await this.getConfigByLevelAndTarget(CacheLevel.GLOBAL);
    return globalConfig;
  }

  // ==================== 缓存条目管理 ====================

  /**
   * 生成缓存键
   *
   * @param config 缓存配置
   * @param hash 依赖文件 hash
   * @returns 缓存键
   */
  generateCacheKey(config: BuildCacheConfig, hash: string): string {
    return generateCacheKey(config.cacheKeyPattern, hash);
  }

  /**
   * 计算依赖文件 hash
   *
   * @param filePaths 依赖文件路径列表
   * @param fileHashes 文件 hash 映射 {path: hash}
   * @returns 合并 hash
   */
  computeDependencyHash(
    filePaths: string[],
    fileHashes: Record<string, string>,
  ): string {
    const sortedPaths = [...filePaths].sort();
    const combined = sortedPaths.map(p => fileHashes[p] || 'not-found').join(':');

    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * 创建缓存条目
   */
  async createCacheEntry(
    configId: string,
    hash: string,
    storagePath: string,
  ): Promise<CacheEntry> {
    const config = await this.getConfig(configId);
    if (!config) {
      throw new Error(`Cache config '${configId}' not found`);
    }

    const cacheKey = generateCacheKey(config.cacheKeyPattern, hash);
    const entry = createCacheEntry(configId, hash, storagePath);
    entry.cacheKey = cacheKey;

    // 设置过期时间
    if (config.maxAgeDays !== undefined && config.maxAgeDays !== null) {
      entry.expiresAt = new Date(Date.now() + config.maxAgeDays * 24 * 60 * 60 * 1000);
    }

    return this.entryRepo.createEntry({
      configId: entry.configId,
      cacheKey: entry.cacheKey,
      hash: entry.hash,
      size: entry.size,
      storagePath: entry.storagePath,
      hitCount: entry.hitCount,
      lastHitAt: entry.lastHitAt,
      expiresAt: entry.expiresAt,
    });
  }

  /**
   * 获取缓存条目
   */
  async getCacheEntry(id: string): Promise<CacheEntry | null> {
    const entry = await this.entryRepo.findById(id);
    return entry || null;
  }

  /**
   * 按缓存键查找缓存条目
   */
  async getCacheEntryByKey(
    configId: string,
    cacheKey: string,
  ): Promise<CacheEntry | null> {
    const entry = await this.entryRepo.findByCacheKey(configId, cacheKey);

    if (!entry) return null;

    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt <= new Date()) {
      return null;
    }

    // 记录命中
    return this.entryRepo.recordHit(entry.id);
  }

  /**
   * 查询缓存条目
   */
  async listCacheEntries(options?: {
    configId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CacheEntry[]> {
    if (options?.configId) {
      return this.entryRepo.findByConfigId(options.configId, {
        limit: options.limit,
        offset: options.offset,
      });
    }
    return this.entryRepo.findAllWithFilter({
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  /**
   * 删除缓存条目
   */
  async deleteCacheEntry(id: string): Promise<boolean> {
    return this.entryRepo.delete(id);
  }

  // ==================== 缓存清理 ====================

  /**
   * 清理过期缓存
   *
   * @returns 清理的条目数量
   */
  async cleanupExpired(): Promise<number> {
    return this.entryRepo.deleteExpired();
  }

  /**
   * 按 LRU 策略清理缓存
   *
   * @param configId 配置 ID
   * @param maxEntries 最大条目数
   * @returns 清理的条目数量
   */
  async cleanupLRU(configId: string, maxEntries: number): Promise<number> {
    const configEntries = await this.entryRepo.findLRUEntries(configId);

    if (configEntries.length <= maxEntries) {
      return 0;
    }

    const toDelete = configEntries.slice(0, configEntries.length - maxEntries);
    let count = 0;
    for (const entry of toDelete) {
      const deleted = await this.entryRepo.delete(entry.id);
      if (deleted) count++;
    }

    return count;
  }

  /**
   * 清理指定配置的所有缓存
   *
   * @param configId 配置 ID
   * @returns 清理的条目数量
   */
  async clearConfigCache(configId: string): Promise<number> {
    return this.entryRepo.deleteByConfigId(configId);
  }
}
