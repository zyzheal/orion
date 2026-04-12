/**
 * Build Cache 数据模型
 *
 * 构建缓存配置，支持全局/流水线/任务三级开关
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 缓存级别
 */
export enum CacheLevel {
  GLOBAL = 'global',       // 全局级别
  PIPELINE = 'pipeline',   // 流水线级别
  TASK = 'task',          // 任务级别
}

/**
 * 缓存存储类型
 */
export enum CacheStorageType {
  LOCAL_VOLUME = 'local-volume',    // 本地卷存储
  S3 = 's3',                        // S3 兼容存储
  NFS = 'nfs',                      // NFS 共享存储
}

/**
 * 缓存清理策略
 */
export enum CacheCleanupPolicy {
  LRU = 'lru',              // 最近最少使用
  TTL = 'ttl',              // 按过期时间
  MANUAL = 'manual',        // 手动清理
  NEVER = 'never',          // 不清理
}

/**
 * 缓存状态
 */
export enum CacheStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
}

/**
 * 缓存配置
 */
export interface BuildCacheConfig {
  id: string;
  level: CacheLevel;        // 缓存级别
  targetId?: string;        // 目标ID（流水线ID或任务ID，全局级别为空）
  status: CacheStatus;      // 开关状态
  storageType: CacheStorageType;  // 存储类型
  storagePath?: string;     // 存储路径
  maxTotalSize?: string;    // 最大总容量，如 '10Gi'
  maxAgeDays?: number;      // 缓存最大保留天数
  cleanupPolicy: CacheCleanupPolicy;  // 清理策略
  cacheKeyPattern?: string; // 缓存键模式（支持变量）
  cachePaths: string[];     // 缓存路径列表
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 缓存实例（实际产生的缓存）
 */
export interface CacheEntry {
  id: string;
  configId: string;         // 关联的配置ID
  cacheKey: string;         // 缓存键
  hash: string;             // 依赖文件 hash
  size?: number;            // 缓存大小（字节）
  storagePath: string;      // 实际存储路径
  hitCount: number;         // 命中次数
  lastHitAt?: Date;         // 最后命中时间
  expiresAt?: Date;         // 过期时间
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 创建缓存配置输入
 */
export interface BuildCacheConfigCreateInput {
  level: CacheLevel;
  targetId?: string;
  status?: CacheStatus;
  storageType?: CacheStorageType;
  storagePath?: string;
  maxTotalSize?: string;
  maxAgeDays?: number;
  cleanupPolicy?: CacheCleanupPolicy;
  cacheKeyPattern?: string;
  cachePaths: string[];
  description?: string;
}

/**
 * 更新缓存配置输入
 */
export interface BuildCacheConfigUpdateInput {
  status?: CacheStatus;
  storageType?: CacheStorageType;
  storagePath?: string;
  maxTotalSize?: string;
  maxAgeDays?: number;
  cleanupPolicy?: CacheCleanupPolicy;
  cacheKeyPattern?: string;
  cachePaths?: string[];
  description?: string;
}

/**
 * 生成缓存键
 */
export function generateCacheKey(
  pattern: string = 'cache-{{hash}}',
  hash: string
): string {
  return pattern.replace('{{hash}}', hash);
}

/**
 * 创建缓存配置
 */
export function createBuildCacheConfig(
  input: BuildCacheConfigCreateInput
): BuildCacheConfig {
  const now = new Date();
  const maxAgeDays = input.maxAgeDays ?? 30;

  return {
    id: uuidv4(),
    level: input.level,
    targetId: input.targetId,
    status: input.status ?? CacheStatus.ENABLED,
    storageType: input.storageType ?? CacheStorageType.LOCAL_VOLUME,
    storagePath: input.storagePath,
    maxTotalSize: input.maxTotalSize,
    maxAgeDays,
    cleanupPolicy: input.cleanupPolicy ?? CacheCleanupPolicy.LRU,
    cacheKeyPattern: input.cacheKeyPattern,
    cachePaths: input.cachePaths,
    description: input.description,
    createdAt: now,
  };
}

/**
 * 更新缓存配置
 */
export function updateBuildCacheConfig(
  config: BuildCacheConfig,
  input: BuildCacheConfigUpdateInput
): BuildCacheConfig {
  return {
    ...config,
    status: input.status ?? config.status,
    storageType: input.storageType ?? config.storageType,
    storagePath: input.storagePath ?? config.storagePath,
    maxTotalSize: input.maxTotalSize ?? config.maxTotalSize,
    maxAgeDays: input.maxAgeDays ?? config.maxAgeDays,
    cleanupPolicy: input.cleanupPolicy ?? config.cleanupPolicy,
    cacheKeyPattern: input.cacheKeyPattern ?? config.cacheKeyPattern,
    cachePaths: input.cachePaths ?? config.cachePaths,
    description: input.description ?? config.description,
    updatedAt: new Date(),
  };
}

/**
 * 创建缓存条目
 */
export function createCacheEntry(
  configId: string,
  hash: string,
  storagePath: string
): CacheEntry {
  const now = new Date();
  return {
    id: uuidv4(),
    configId,
    cacheKey: `cache-${hash}`,
    hash,
    storagePath,
    hitCount: 0,
    createdAt: now,
  };
}

/**
 * 记录缓存命中
 */
export function recordCacheHit(entry: CacheEntry): CacheEntry {
  return {
    ...entry,
    hitCount: entry.hitCount + 1,
    lastHitAt: new Date(),
    updatedAt: new Date(),
  };
}
