/**
 * Token Refresh Guard Tests
 */

import { TokenRefreshGuard, TokenRefreshAttempt } from '../TokenRefreshGuard';
import { DeviceFingerprintService } from '../DeviceFingerprint';
import { FastifyInstance, FastifyBaseLogger } from 'fastify';

describe('TokenRefreshGuard', () => {
  let guard: TokenRefreshGuard;
  let mockApp: Partial<FastifyInstance>;
  let mockLog: FastifyBaseLogger;
  let mockRedis: any;

  beforeEach(() => {
    mockLog = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn().mockReturnThis(),
      level: 'info',
    } as unknown as FastifyBaseLogger;

    mockApp = {
      log: mockLog,
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      eval: jest.fn(),
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      scard: jest.fn().mockResolvedValue(0),
    };

    guard = new TokenRefreshGuard(mockApp as FastifyInstance);
  });

  describe('executeAtomicRefresh', () => {
    it('should return error when Redis is not connected', async () => {
      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redis not connected');
    });

    it('should successfully execute atomic refresh', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue({
        ok: JSON.stringify({ userId: 'user123', deviceId: 'device1' }),
      });

      guard.setRedisClient(mockRedis);

      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123',
        'device1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user123');
    });

    it('should handle concurrent refresh detection', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue({
        err: 'CONCURRENT_REFRESH',
        code: 1,
      });

      guard.setRedisClient(mockRedis);

      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('CONCURRENT_REFRESH');
      expect(result.code).toBe(1);
    });

    it('should handle token not found', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue({
        err: 'TOKEN_NOT_FOUND',
        code: 2,
      });

      guard.setRedisClient(mockRedis);

      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('TOKEN_NOT_FOUND');
    });

    it('should handle device mismatch', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue({
        err: 'DEVICE_MISMATCH',
        code: 3,
      });

      guard.setRedisClient(mockRedis);

      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123',
        'different-device'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DEVICE_MISMATCH');
      expect(result.code).toBe(3);
    });

    it('should handle replay attack', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue({
        err: 'REPLAY_ATTACK',
        code: 4,
      });

      guard.setRedisClient(mockRedis);

      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('REPLAY_ATTACK');
      expect(result.code).toBe(4);
    });

    it('should handle Redis error', async () => {
      mockRedis.eval = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      guard.setRedisClient(mockRedis);

      const result = await guard.executeAtomicRefresh(
        'refresh-token',
        'new-jti',
        'new-refresh-token',
        'user123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redis error');
      expect(mockLog.error).toHaveBeenCalled();
    });
  });

  describe('detectConcurrentRefresh', () => {
    it('should return false when Redis is not connected', async () => {
      const result = await guard.detectConcurrentRefresh('user123', 'refresh-token');
      expect(result).toBe(false);
    });

    it('should return false for normal refresh', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue('OK');

      guard.setRedisClient(mockRedis);

      const result = await guard.detectConcurrentRefresh('user123', 'refresh-token');
      expect(result).toBe(false);
    });

    it('should return true for concurrent attack', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue('CONCURRENT_ATTACK');

      guard.setRedisClient(mockRedis);

      const result = await guard.detectConcurrentRefresh('user123', 'refresh-token');
      expect(result).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should return 0 when Redis is not connected', async () => {
      const count = await guard.revokeAllUserTokens('user123');
      expect(count).toBe(0);
    });

    it('should revoke all tokens', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue(5);

      guard.setRedisClient(mockRedis);

      const count = await guard.revokeAllUserTokens('user123');
      expect(count).toBe(5);
      expect(mockLog.warn).toHaveBeenCalled();
    });
  });

  describe('recordRefreshAttempt', () => {
    it('should record attempt in Redis', async () => {
      guard.setRedisClient(mockRedis);

      await guard.recordRefreshAttempt(
        'user123',
        'refresh-token',
        'device1',
        'fp123',
        '192.168.1.1',
        true,
        false
      );

      expect(mockRedis.lpush).toHaveBeenCalled();
      expect(mockRedis.ltrim).toHaveBeenCalledWith(expect.any(String), 0, 99);
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should handle Redis not connected', async () => {
      await guard.recordRefreshAttempt('user123', 'refresh-token');
      // Should not throw
    });
  });

  describe('getRefreshAuditLog', () => {
    it('should return empty array when Redis is not connected', async () => {
      const logs = await guard.getRefreshAuditLog('user123');
      expect(logs).toEqual([]);
    });

    it('should return audit logs', async () => {
      mockRedis.lrange = jest.fn().mockResolvedValue([
        JSON.stringify({
          userId: 'user123',
          refreshToken: 'refresh...',
          success: true,
          timestamp: Date.now(),
        }),
      ]);

      guard.setRedisClient(mockRedis);

      const logs = await guard.getRefreshAuditLog('user123');
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user123');
    });
  });

  describe('validateRefreshRequest', () => {
    it('should return valid for normal request', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue('OK');

      guard.setRedisClient(mockRedis);

      const result = await guard.validateRefreshRequest(
        'refresh-token',
        'user123',
        'device1',
        'fp123',
        '192.168.1.1'
      );

      expect(result.valid).toBe(true);
    });

    it('should revoke tokens for concurrent attack', async () => {
      mockRedis.eval = jest.fn().mockImplementation((script: string, numKeys: number, ...args: string[]) => {
        // First call is detectConcurrentRefresh
        if (script.includes('refresh_attempts')) {
          return 'CONCURRENT_ATTACK';
        }
        return 5; // revokeAllUserTokens
      });

      guard.setRedisClient(mockRedis);

      const result = await guard.validateRefreshRequest(
        'refresh-token',
        'user123',
        'device1',
        'fp123',
        '192.168.1.1'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Concurrent refresh attack');
    });
  });

  describe('handleRefresh', () => {
    it('should handle full refresh flow', async () => {
      // Setup mocks for successful refresh
      mockRedis.eval = jest.fn().mockImplementation((script: string) => {
        if (script.includes('refresh_attempts')) {
          return 'OK';
        }
        return {
          ok: JSON.stringify({ userId: 'user123', deviceId: 'device1' }),
        };
      });
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          deviceId: 'device1',
          jti: 'jti123',
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        })
      );

      guard.setRedisClient(mockRedis);

      const attempt: TokenRefreshAttempt = {
        refreshToken: 'refresh-token',
        userId: 'user123',
        deviceId: 'device1',
        fingerprint: 'fp123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const generateNewTokens = jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        jti: 'new-jti',
      });

      const result = await guard.handleRefresh(attempt, generateNewTokens);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(generateNewTokens).toHaveBeenCalled();
    });

    it('should handle concurrent attack and revoke all tokens', async () => {
      mockRedis.eval = jest.fn().mockImplementation((script: string) => {
        if (script.includes('refresh_attempts')) {
          return 'CONCURRENT_ATTACK';
        }
        return 5; // revokeAllUserTokens
      });

      guard.setRedisClient(mockRedis);

      const attempt: TokenRefreshAttempt = {
        refreshToken: 'refresh-token',
        userId: 'user123',
        ip: '192.168.1.1',
      };

      const generateNewTokens = jest.fn();

      const result = await guard.handleRefresh(attempt, generateNewTokens);

      expect(result.success).toBe(false);
      expect(result.revoked).toBe(true);
      expect(generateNewTokens).not.toHaveBeenCalled();
      expect(mockLog.warn).toHaveBeenCalled();
    });
  });

  describe('blacklistToken', () => {
    it('should add token to blacklist', async () => {
      guard.setRedisClient(mockRedis);

      await guard.blacklistToken('some-token', Date.now() + 10000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:some-token',
        '1',
        'PX',
        expect.any(Number)
      );
    });

    it('should not blacklist expired token', async () => {
      guard.setRedisClient(mockRedis);

      await guard.blacklistToken('some-token', Date.now() - 1000);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis not connected', async () => {
      await guard.blacklistToken('some-token', Date.now() + 10000);
      // Should not throw
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false when Redis is not connected', async () => {
      const result = await guard.isTokenBlacklisted('some-token');
      expect(result).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(1);

      guard.setRedisClient(mockRedis);

      const result = await guard.isTokenBlacklisted('some-token');
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0);

      guard.setRedisClient(mockRedis);

      const result = await guard.isTokenBlacklisted('some-token');
      expect(result).toBe(false);
    });
  });

  describe('integration with DeviceFingerprintService', () => {
    it('should use device fingerprint service for anomalous login detection', async () => {
      const mockDeviceFingerprintService = {
        detectAnomalousLogin: jest.fn().mockResolvedValue({
          userId: 'user123',
          deviceId: 'fp123',
          fingerprint: 'fp123',
          previousIp: '192.168.1.0/24',
          currentIp: '10.0.0.1',
          timestamp: Date.now(),
        }),
      } as unknown as DeviceFingerprintService;

      mockRedis.eval = jest.fn().mockResolvedValue('OK');

      guard.setRedisClient(mockRedis);
      guard.setDeviceFingerprintService(mockDeviceFingerprintService);

      const result = await guard.validateRefreshRequest(
        'refresh-token',
        'user123',
        'device1',
        'fp123',
        '192.168.1.1'
      );

      expect(result.valid).toBe(true);
      expect(result.anomalousEvent).toBeDefined();
    });
  });
});