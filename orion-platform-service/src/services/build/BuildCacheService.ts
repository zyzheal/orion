/**
 * Build Cache Service - 构建缓存管理服务
 *
 * 职责：
 * - 三级缓存开关管理：全局 -> 流水线 -> 任务
 * - 缓存键生成（基于依赖文件 hash）
 * - 缓存存储管理（本地卷或远端）
 * - 缓存清理策略
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
  recordCacheHit,
  generateCacheKey,
} from '../../models/BuildCache';

export class BuildCacheService {
  private configs: Map<string, BuildCacheConfig>;
  private entries: Map<string, CacheEntry>;

  constructor() {
    this.configs = new Map();
    this.entries = new Map();
  }

  /**
   * 创建缓存配置
   */
  async createConfig(input: BuildCacheConfigCreateInput): Promise<BuildCacheConfig> {
    // 检查是否已存在相同级别的配置
    const existing = Array.from(this.configs.values()).find(
      cfg => cfg.level === input.level && cfg.targetId === input.targetId
    );
    if (existing) {
      throw new Error(`Cache config already exists for level=${input.level}, target=${input.targetId}`);
    }

    const config = createBuildCacheConfig(input);
    this.configs.set(config.id, config);
    return config;
  }

  /**
   * 获取缓存配置
   */
  async getConfig(id: string): Promise<BuildCacheConfig | null> {
    return this.configs.get(id) || null;
  }

  /**
   * 按级别和目标获取缓存配置
   */
  async getConfigByLevelAndTarget(
    level: CacheLevel,
    targetId?: string
  ): Promise<BuildCacheConfig | null> {
    return Array.from(this.configs.values()).find(
      cfg => cfg.level === level && cfg.targetId === targetId
    ) || null;
  }

  /**
   * 更新缓存配置
   */
  async updateConfig(
    id: string,
    input: BuildCacheConfigUpdateInput
  ): Promise<BuildCacheConfig | null> {
    const config = this.configs.get(id);
    if (!config) {
      return null;
    }

    const updated = updateBuildCacheConfig(config, input);
    this.configs.set(id, updated);
    return updated;
  }

  /**
   * 删除缓存配置
   */
  async deleteConfig(id: string): Promise<boolean> {
    return this.configs.delete(id);
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
    let result = Array.from(this.configs.values());

    if (options?.level) {
      result = result.filter(cfg => cfg.level === options.level);
    }

    if (options?.status) {
      result = result.filter(cfg => cfg.status === options.status);
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
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
    taskId?: string
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
    fileHashes: Record<string, string>
  ): string {
    // 简单实现：将所有文件 hash 拼接后取前 16 位
    const sortedPaths = [...filePaths].sort();
    const combined = sortedPaths.map(p => fileHashes[p] || 'not-found').join(':');

    // 使用简单的 hash 算法（生产环境应使用 crypto.createHash）
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
    storagePath: string
  ): Promise<CacheEntry> {
    const config = this.configs.get(configId);
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

    this.entries.set(entry.id, entry);
    return entry;
  }

  /**
   * 获取缓存条目
   */
  async getCacheEntry(id: string): Promise<CacheEntry | null> {
    return this.entries.get(id) || null;
  }

  /**
   * 按缓存键查找缓存条目
   */
  async getCacheEntryByKey(
    configId: string,
    cacheKey: string
  ): Promise<CacheEntry | null> {
    const entry = Array.from(this.entries.values()).find(
      e => e.configId === configId && e.cacheKey === cacheKey
    );

    if (!entry) return null;

    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt <= new Date()) {
      return null;
    }

    // 记录命中
    return recordCacheHit(entry);
  }

  /**
   * 查询缓存条目
   */
  async listCacheEntries(options?: {
    configId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CacheEntry[]> {
    let result = Array.from(this.entries.values());

    if (options?.configId) {
      result = result.filter(e => e.configId === options.configId);
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 删除缓存条目
   */
  async deleteCacheEntry(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  // ==================== 缓存清理 ====================

  /**
   * 清理过期缓存
   *
   * @returns 清理的条目数量
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.entries.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * 按 LRU 策略清理缓存
   *
   * @param configId 配置 ID
   * @param maxEntries 最大条目数
   * @returns 清理的条目数量
   */
  async cleanupLRU(configId: string, maxEntries: number): Promise<number> {
    const configEntries = Array.from(this.entries.values())
      .filter(e => e.configId === configId)
      .sort((a, b) => {
        // 按最后命中时间排序（未命中的排前面）
        const aTime = a.lastHitAt?.getTime() || a.createdAt.getTime();
        const bTime = b.lastHitAt?.getTime() || b.createdAt.getTime();
        return aTime - bTime;
      });

    if (configEntries.length <= maxEntries) {
      return 0;
    }

    const toDelete = configEntries.slice(0, configEntries.length - maxEntries);
    for (const entry of toDelete) {
      this.entries.delete(entry.id);
    }

    return toDelete.length;
  }

  /**
   * 清理指定配置的所有缓存
   *
   * @param configId 配置 ID
   * @returns 清理的条目数量
   */
  async clearConfigCache(configId: string): Promise<number> {
    let count = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (entry.configId === configId) {
        this.entries.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const buildCacheService = new BuildCacheService();
