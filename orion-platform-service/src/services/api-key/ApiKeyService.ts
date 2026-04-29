/**
 * ApiKeyService - Business logic layer for API Key
 */
import { ApiKeyRepository, ApiKey } from './ApiKeyRepository';
import { randomBytes, createHash } from 'crypto';

export class ApiKeyServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'ApiKeyServiceError'; }
}

export class ApiKeyService {
  private repository: ApiKeyRepository;
  constructor(repository: ApiKeyRepository) { this.repository = repository; }

  async createKey(tenantId: string, userId: string, name: string, permissions: string[], expiresInDays?: number): Promise<{ key: ApiKey; rawKey: string }> {
    if (!tenantId || !name) throw new ApiKeyServiceError('Tenant ID and name required', 'INVALID_INPUT');
    
    const rawKey = randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined;
    
    const key = await this.repository.create(tenantId, userId, name, keyHash, permissions, expiresAt);
    return { key, rawKey };
  }

  async listKeys(tenantId: string): Promise<ApiKey[]> {
    return this.repository.findAll(tenantId);
  }

  async revokeKey(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }
}