/**
 * CacheService - Business logic layer for Cache
 */
import { CacheRepository, CacheEntry } from './CacheRepository';

export class CacheServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'CacheServiceError'; }
}

export class CacheService {
  private repository: CacheRepository;
  constructor(repository: CacheRepository) { this.repository = repository; }

  async set(tenantId: string, key: string, value: Record<string, any>, ttl?: number): Promise<CacheEntry> {
    return this.repository.set(tenantId, key, value, ttl);
  }

  async get(tenantId: string, key: string): Promise<CacheEntry | null> {
    return this.repository.get(tenantId, key);
  }

  async delete(tenantId: string, key: string): Promise<boolean> {
    return this.repository.delete(tenantId, key);
  }

  async clearExpired(): Promise<number> {
    return this.repository.cleanup();
  }
}