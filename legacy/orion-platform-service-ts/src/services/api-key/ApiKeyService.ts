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

  /**
   * Verify a raw API key by hashing it and comparing with stored hashes.
   * Returns the key record if valid, null otherwise.
   * Also updates last_used_at timestamp.
   */
  async verifyKey(rawKey: string): Promise<{ key: ApiKey; keyId: string } | null> {
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');
    const record = await this.repository.findByHash(hashedKey);
    if (!record) return null;

    // Check if key is expired
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      await this.repository.delete(record.id);
      return null;
    }

    // Update last used
    await this.repository.updateLastUsed(record.id);

    return { key: record, keyId: record.id };
  }
}