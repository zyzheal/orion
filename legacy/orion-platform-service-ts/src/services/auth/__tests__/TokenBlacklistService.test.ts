// orion-platform-service/src/services/auth/__tests__/TokenBlacklistService.test.ts
import { TokenBlacklistService, TokenBlacklistConfig, RevokedTokenInfo } from '../TokenBlacklistService';

// Mock DatabasePool for testing
let mockQueryResponses: any[] = [];

const createMockDbPool = () => ({
  query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    // Check if there's a specific mock response queued
    if (mockQueryResponses.length > 0) {
      return mockQueryResponses.shift();
    }

    // Default responses based on query type
    if (sql.includes('COUNT(*)')) {
      // Return empty rows so repository throws and service falls back to cache
      return { rows: [], rowCount: 0 };
    }
    // For UPDATE/DELETE queries, return 0 (service will fall back to cache)
    if (sql.trim().startsWith('UPDATE') || sql.trim().startsWith('DELETE')) {
      return { rows: [], rowCount: 0 };
    }
    // For INSERT with RETURNING, return a synthetic row
    if (sql.includes('INSERT') && sql.includes('RETURNING')) {
      return {
        rows: [{
          id: Math.floor(Math.random() * 1000),
          token_hash: params?.[0] ?? '',
          user_id: params?.[1] ?? '',
          tenant_id: params?.[2] ?? 0,
          revoke_reason: params?.[4] ?? '',
          revoked_by: params?.[5] ?? null,
          revoked_at: new Date(),
          expires_at: params?.[3] ?? new Date(),
          metadata: params?.[6] ?? '{}',
        }],
        rowCount: 1,
      };
    }
    // Return empty result for most queries
    return { rows: [], rowCount: 0 };
  }),
  connect: jest.fn(),
  transaction: jest.fn(),
  checkHealth: jest.fn().mockResolvedValue({ status: 'up', latency: 1 }),
  close: jest.fn(),
  isHealthy: jest.fn().mockReturnValue(true),
  getPoolSize: jest.fn().mockReturnValue(10),
  getIdleCount: jest.fn().mockReturnValue(5),
});

const resetMockResponses = () => {
  mockQueryResponses = [];
};

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let mockDbPool: ReturnType<typeof createMockDbPool>;

  beforeEach(() => {
    resetMockResponses();
    mockDbPool = createMockDbPool();
    service = new TokenBlacklistService(mockDbPool as any, {
      ttlSeconds: 7 * 24 * 3600, // 7 days
      keyPrefix: 'token:blacklist:',
    });
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('hashToken', () => {
    it('should hash token with SHA256 and return 64 character hex string', () => {
      const token = 'test_token_123';
      const hash = service.hashToken(token);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it('should produce consistent hash for same token', () => {
      const token = 'test_token_456';
      const hash1 = service.hashToken(token);
      const hash2 = service.hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = service.hashToken('token1');
      const hash2 = service.hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('revokeToken', () => {
    it('should add token to blacklist', async () => {
      const token = 'test_token_123';
      await service.revokeToken(token, 'user_001', 1, 'logout');

      const isRevoked = await service.isRevoked(token);
      expect(isRevoked).toBe(true);
    });

    it('should store correct token metadata', async () => {
      const token = 'test_token_metadata';
      await service.revokeToken(token, 'user_002', 2, 'security_incident', 'admin_001');

      const info = await service.getRevokedTokenInfo(token);
      expect(info).toBeDefined();
      expect(info?.userId).toBe('user_002');
      expect(info?.tenantId).toBe(2);
      expect(info?.revokeReason).toBe('security_incident');
      expect(info?.revokedBy).toBe('admin_001');
      expect(info?.revokedAt).toBeInstanceOf(Date);
      expect(info?.expiresAt).toBeInstanceOf(Date);
    });

    it('should emit token:revoked event', async () => {
      const eventHandler = jest.fn();
      service.on('token:revoked', eventHandler);

      const token = 'test_token_event';
      await service.revokeToken(token, 'user_001', 1, 'logout');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_001',
          tenantId: 1,
          revokeReason: 'logout',
        })
      );
    });

    it('should not throw when revoking already revoked token', async () => {
      const token = 'test_token_duplicate';
      await service.revokeToken(token, 'user_001', 1, 'logout');

      // Should not throw
      await expect(service.revokeToken(token, 'user_001', 1, 'logout')).resolves.not.toThrow();
    });
  });

  describe('isRevoked', () => {
    it('should return false for non-revoked token', async () => {
      const isRevoked = await service.isRevoked('valid_token');
      expect(isRevoked).toBe(false);
    });

    it('should return true for revoked token', async () => {
      const token = 'revoked_token';
      await service.revokeToken(token, 'user_001', 1, 'logout');

      const isRevoked = await service.isRevoked(token);
      expect(isRevoked).toBe(true);
    });

    it('should return false for expired revoked token', async () => {
      // Create service with very short TTL for testing
      const shortTtlMockDbPool = createMockDbPool();
      const shortTtlService = new TokenBlacklistService(shortTtlMockDbPool as any, {
        ttlSeconds: -1, // Already expired
        keyPrefix: 'test:',
      });

      const token = 'expired_token';
      await shortTtlService.revokeToken(token, 'user_001', 1, 'logout');

      // Token should be considered expired
      const isRevoked = await shortTtlService.isRevoked(token);
      expect(isRevoked).toBe(false);

      shortTtlService.disconnect();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      // Revoke some tokens for the user
      await service.revokeToken('token1', 'user_001', 1, 'logout');
      await service.revokeToken('token2', 'user_001', 1, 'password_change');
      await service.revokeToken('token3', 'user_002', 1, 'logout');

      const count = await service.revokeAllUserTokens('user_001', 'security_incident');

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should emit user:tokens_revoked event', async () => {
      const eventHandler = jest.fn();
      service.on('user:tokens_revoked', eventHandler);

      await service.revokeToken('token1', 'user_001', 1, 'logout');
      await service.revokeAllUserTokens('user_001', 'security_incident');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_001',
          reason: 'security_incident',
        })
      );
    });

    it('should return 0 for user with no tokens', async () => {
      const count = await service.revokeAllUserTokens('nonexistent_user', 'logout');
      expect(count).toBe(0);
    });
  });

  describe('revokeTenantTokens', () => {
    it('should revoke all tokens for a tenant', async () => {
      await service.revokeToken('token1', 'user_001', 1, 'logout');
      await service.revokeToken('token2', 'user_002', 1, 'logout');
      await service.revokeToken('token3', 'user_003', 2, 'logout');

      const count = await service.revokeTenantTokens(1, 'tenant_suspension');

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should emit tenant:tokens_revoked event', async () => {
      const eventHandler = jest.fn();
      service.on('tenant:tokens_revoked', eventHandler);

      await service.revokeToken('token1', 'user_001', 1, 'logout');
      await service.revokeTenantTokens(1, 'tenant_suspension');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          reason: 'tenant_suspension',
        })
      );
    });

    it('should return 0 for tenant with no tokens', async () => {
      const count = await service.revokeTenantTokens(999, 'logout');
      expect(count).toBe(0);
    });
  });

  describe('getUserRevokedCount', () => {
    it('should return correct count of revoked tokens for user', async () => {
      await service.revokeToken('token1', 'user_001', 1, 'logout');
      await service.revokeToken('token2', 'user_001', 1, 'logout');
      await service.revokeToken('token3', 'user_002', 1, 'logout');

      const count = await service.getUserRevokedCount('user_001');
      expect(count).toBe(2);
    });

    it('should return 0 for user with no revoked tokens', async () => {
      const count = await service.getUserRevokedCount('nonexistent_user');
      expect(count).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired tokens from blacklist', async () => {
      // Create service with negative TTL for immediate expiration
      const shortTtlMockDbPool = createMockDbPool();
      shortTtlMockDbPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // For cleanup DELETE
      const shortTtlService = new TokenBlacklistService(shortTtlMockDbPool as any, {
        ttlSeconds: -1,
        keyPrefix: 'cleanup:',
      });

      await shortTtlService.revokeToken('expired_token', 'user_001', 1, 'logout');

      const cleanedCount = await shortTtlService.cleanupExpired();
      expect(cleanedCount).toBe(1);

      const isRevoked = await shortTtlService.isRevoked('expired_token');
      expect(isRevoked).toBe(false);

      shortTtlService.disconnect();
    });

    it('should not remove non-expired tokens', async () => {
      await service.revokeToken('valid_token', 'user_001', 1, 'logout');

      const cleanedCount = await service.cleanupExpired();
      expect(cleanedCount).toBe(0);

      const isRevoked = await service.isRevoked('valid_token');
      expect(isRevoked).toBe(true);
    });

    it('should emit cleanup:completed event', async () => {
      const eventHandler = jest.fn();
      service.on('cleanup:completed', eventHandler);

      await service.cleanupExpired();

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanedCount: expect.any(Number),
        })
      );
    });
  });

  describe('getRevokedTokenInfo', () => {
    it('should return token info for revoked token', async () => {
      const token = 'info_token';
      await service.revokeToken(token, 'user_001', 1, 'logout', 'admin_001');

      const info = await service.getRevokedTokenInfo(token);

      expect(info).toBeDefined();
      expect(info?.tokenHash).toBe(service.hashToken(token));
      expect(info?.userId).toBe('user_001');
      expect(info?.tenantId).toBe(1);
      expect(info?.revokeReason).toBe('logout');
      expect(info?.revokedBy).toBe('admin_001');
    });

    it('should return null for non-revoked token', async () => {
      const info = await service.getRevokedTokenInfo('nonexistent_token');
      expect(info).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await service.revokeToken('token1', 'user_001', 1, 'logout');
      await service.revokeToken('token2', 'user_002', 1, 'security_incident');
      await service.revokeToken('token3', 'user_003', 2, 'logout');

      const stats = await service.getStats();

      expect(stats.totalRevoked).toBeGreaterThanOrEqual(3);
      expect(stats.byReason).toBeDefined();
      expect(stats.byReason['logout']).toBeGreaterThanOrEqual(2);
      expect(stats.byReason['security_incident']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('connect and disconnect', () => {
    it('should connect successfully', async () => {
      await expect(service.connect()).resolves.not.toThrow();
    });

    it('should disconnect successfully', () => {
      expect(() => service.disconnect()).not.toThrow();
    });
  });
});