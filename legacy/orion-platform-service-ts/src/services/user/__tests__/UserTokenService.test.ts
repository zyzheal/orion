/**
 * UserTokenService Unit Tests
 */

import { UserTokenService, UserTokenServiceError, UserToken } from '../UserTokenService';
import { DatabasePool } from '../../database';

// Mock database pool
class MockDatabasePool {
  query = jest.fn();
}

describe('UserTokenService', () => {
  let service: UserTokenService;
  let mockPool: MockDatabasePool;

  beforeEach(() => {
    mockPool = new MockDatabasePool();
    service = new UserTokenService(mockPool as unknown as DatabasePool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createToken', () => {
    it('should create a new token with valid input', async () => {
      const mockRow = {
        id: 'token-123',
        user_id: 'user-456',
        name: 'My API Token',
        expires_at: null,
        last_used_at: null,
        created_at: new Date('2026-05-19'),
      };
      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await service.createToken({
        userId: 'user-456',
        name: 'My API Token',
      });

      expect(result.userId).toBe('user-456');
      expect(result.name).toBe('My API Token');
      expect(result.token).toMatch(/^orion_/); // Should have prefix
      expect(result.token.length).toBe(70); // orion_ (6) + 64 hex chars = 70
    });

    it('should create token with expiration date', async () => {
      const mockRow = {
        id: 'token-123',
        user_id: 'user-456',
        name: 'Temp Token',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        last_used_at: null,
        created_at: new Date('2026-05-19'),
      };
      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await service.createToken({
        userId: 'user-456',
        name: 'Temp Token',
        expiresInDays: 30,
      });

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject empty user ID', async () => {
      await expect(
        service.createToken({ userId: '', name: 'Token' })
      ).rejects.toThrow('User ID is required');
    });

    it('should reject empty token name', async () => {
      await expect(
        service.createToken({ userId: 'user-123', name: '' })
      ).rejects.toThrow('Token name is required');
    });

    it('should reject token name > 100 characters', async () => {
      const longName = 'a'.repeat(101);
      await expect(
        service.createToken({ userId: 'user-123', name: longName })
      ).rejects.toThrow('Token name must be 100 characters or less');
    });
  });

  describe('getTokens', () => {
    it('should return all tokens for a user', async () => {
      const mockRows = [
        {
          id: 'token-1',
          user_id: 'user-456',
          name: 'Token 1',
          token_hash: 'hash1',
          expires_at: null,
          last_used_at: null,
          created_at: new Date('2026-05-19'),
        },
        {
          id: 'token-2',
          user_id: 'user-456',
          name: 'Token 2',
          token_hash: 'hash2',
          expires_at: null,
          last_used_at: null,
          created_at: new Date('2026-05-18'),
        },
      ];
      mockPool.query.mockResolvedValue({ rows: mockRows, rowCount: 2 });

      const result = await service.getTokens('user-456');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Token 1');
      expect(result[0].token).toBeUndefined(); // Should not include raw token
    });

    it('should reject empty user ID', async () => {
      await expect(service.getTokens('')).rejects.toThrow('User ID is required');
    });
  });

  describe('deleteToken', () => {
    it('should delete token successfully', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteToken('user-456', 'token-123');

      expect(result).toBe(true);
    });

    it('should return false when token not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteToken('user-456', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should reject empty user ID', async () => {
      await expect(service.deleteToken('', 'token-123')).rejects.toThrow('User ID is required');
    });

    it('should reject empty token ID', async () => {
      await expect(service.deleteToken('user-456', '')).rejects.toThrow('Token ID is required');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const mockRow = {
        id: 'token-123',
        user_id: 'user-456',
        name: 'My Token',
        token_hash: 'abc123', // Will be matched against computed hash
        expires_at: null,
        last_used_at: null,
        created_at: new Date('2026-05-19'),
      };
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 }) // SELECT
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE

      // Create a valid token and get its hash
      const tokenResult = await service.createToken({
        userId: 'user-456',
        name: 'My Token',
      });
      const tokenHash = tokenResult.tokenHash;

      // Now set up the mock to return the correct hash
      mockPool.query
        .mockReset()
        .mockResolvedValueOnce({
          rows: [{
            ...mockRow,
            token_hash: tokenHash,
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await service.validateToken(tokenResult.token);

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-456');
    });

    it('should return null for invalid token', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.validateToken('orion_invalid_token');

      expect(result).toBeNull();
    });

    it('should return null for token without prefix', async () => {
      const result = await service.validateToken('invalid_token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'token-123',
          user_id: 'user-456',
          name: 'Expired Token',
          token_hash: 'abc123',
          expires_at: expiredDate,
          last_used_at: null,
          created_at: new Date('2026-05-19'),
        }],
        rowCount: 1,
      });

      // First need to get a valid token hash
      const tokenResult = await service.createToken({
        userId: 'user-456',
        name: 'Test',
      });

      // Then check with expired date
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'token-123',
          user_id: 'user-456',
          name: 'Expired Token',
          token_hash: tokenResult.tokenHash,
          expires_at: expiredDate,
          last_used_at: null,
          created_at: new Date('2026-05-19'),
        }],
        rowCount: 1,
      });

      const result = await service.validateToken(tokenResult.token);

      expect(result).toBeNull();
    });

    it('should return null for empty token', async () => {
      const result = await service.validateToken('');

      expect(result).toBeNull();
    });
  });

  describe('getTokenById', () => {
    it('should return token by ID', async () => {
      const mockRow = {
        id: 'token-123',
        user_id: 'user-456',
        name: 'My Token',
        token_hash: 'hash123',
        expires_at: null,
        last_used_at: null,
        created_at: new Date('2026-05-19'),
      };
      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await service.getTokenById('token-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('token-123');
    });

    it('should return null for non-existent token', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.getTokenById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteAllTokens', () => {
    it('should delete all tokens for a user', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 5 });

      const result = await service.deleteAllTokens('user-456');

      expect(result).toBe(5);
    });

    it('should reject empty user ID', async () => {
      await expect(service.deleteAllTokens('')).rejects.toThrow('User ID is required');
    });
  });
});