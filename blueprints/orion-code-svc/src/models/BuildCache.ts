/**
 * Build Cache Models - 构建缓存数据模型
 */

export enum CacheLevel {
  GLOBAL = 'global',
  PIPELINE = 'pipeline',
  TASK = 'task',
}

export enum CacheStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
}

export enum CacheCleanupPolicy {
  LRU = 'lru',
  TTL = 'ttl',
  MANUAL = 'manual',
}

export enum CacheStorageType {
  LOCAL = 'local',
  S3 = 's3',
  NFS = 'nfs',
}

export interface BuildCacheConfig {
  id: string;
  level: CacheLevel;
  targetId?: string;
  status: CacheStatus;
  storageType: CacheStorageType;
  storagePath?: string;
  maxTotalSize?: number;
  maxAgeDays?: number;
  cleanupPolicy: CacheCleanupPolicy;
  cacheKeyPattern: string;
  cachePaths: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CacheEntry {
  id: string;
  configId: string;
  cacheKey: string;
  hash: string;
  size: number;
  storagePath: string;
  hitCount: number;
  lastHitAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildCacheConfigCreateInput {
  level: CacheLevel;
  targetId?: string;
  status?: CacheStatus;
  storageType?: CacheStorageType;
  storagePath?: string;
  maxTotalSize?: number;
  maxAgeDays?: number;
  cleanupPolicy?: CacheCleanupPolicy;
  cacheKeyPattern?: string;
  cachePaths: string[];
  description?: string;
}

export interface BuildCacheConfigUpdateInput {
  status?: CacheStatus;
  storageType?: CacheStorageType;
  storagePath?: string;
  maxTotalSize?: number;
  maxAgeDays?: number;
  cleanupPolicy?: CacheCleanupPolicy;
  cacheKeyPattern?: string;
  cachePaths?: string[];
  description?: string;
}

export function createBuildCacheConfig(input: BuildCacheConfigCreateInput): BuildCacheConfig {
  const now = new Date();
  return {
    id: `cache-config-${Date.now()}`,
    level: input.level,
    targetId: input.targetId,
    status: input.status ?? CacheStatus.ENABLED,
    storageType: input.storageType ?? CacheStorageType.LOCAL,
    storagePath: input.storagePath,
    maxTotalSize: input.maxTotalSize,
    maxAgeDays: input.maxAgeDays,
    cleanupPolicy: input.cleanupPolicy ?? CacheCleanupPolicy.LRU,
    cacheKeyPattern: input.cacheKeyPattern || '{{level}}-{{targetId}}-{{hash}}',
    cachePaths: input.cachePaths,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateBuildCacheConfig(config: BuildCacheConfig, input: BuildCacheConfigUpdateInput): BuildCacheConfig {
  return { ...config, ...input, updatedAt: new Date() };
}

export function createCacheEntry(configId: string, hash: string, storagePath: string): CacheEntry {
  const now = new Date();
  return {
    id: `cache-entry-${Date.now()}`,
    configId,
    cacheKey: '',
    hash,
    size: 0,
    storagePath,
    hitCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function generateCacheKey(pattern: string, hash: string): string {
  return pattern.replace('{{hash}}', hash);
}
