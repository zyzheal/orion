/** BuildCache model */

export type CacheLevel = 'project' | 'pipeline' | 'stage' | 'task';
export type CacheStatus = 'active' | 'disabled' | 'archived';
export type CacheCleanupPolicy = 'lru' | 'fifo' | 'ttl' | 'none';
export type CacheStorageType = 'local' | 's3' | 'gcs' | 'azure';

export interface BuildCacheConfig {
  id: string;
  level: CacheLevel;
  targetId?: string;
  status: CacheStatus;
  storageType: CacheStorageType;
  storagePath?: string;
  maxTotalSize?: string;
  maxAgeDays?: number;
  cleanupPolicy: CacheCleanupPolicy;
  cacheKeyPattern?: string;
  cachePaths: string[];
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CacheEntry {
  id: string;
  configId: string;
  cacheKey: string;
  hash: string;
  size?: number;
  storagePath: string;
  hitCount: number;
  lastHitAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}
