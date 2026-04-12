/**
 * Token Service Unit Tests
 */

import { TokenService, TokenPair, TokenRefreshOptions } from '../token.service';
import { FastifyInstance, FastifyBaseLogger } from 'fastify';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockApp: Partial<FastifyInstance>;
  let mockJwt: any;
  let mockLog: FastifyBaseLogger;
  let mockRedis: any;

  beforeEach(() => {
    mockJwt = {
      sign: jest.fn().mockResolvedValue('mocked-access-token'),
      verify: jest.fn(),
    };

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
      jwt: mockJwt,
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

    tokenService = new TokenService(mockApp as FastifyInstance);
  });

  describe('generateDeviceFingerprint', () => {
    it('should generate a unique fingerprint based on User-Agent and IP', () => {
      const fingerprint1 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.1'
      );
      const fingerprint2 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.1'
      );
      const fingerprint3 = tokenService.generateDeviceFingerprint(
        'Chrome/90.0',
        '192.168.1.1'
      );

      // Same inputs should generate same fingerprint (no random part now)
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32);
      expect(fingerprint3).toHaveLength(32);
      expect(fingerprint1).not.toBe(fingerprint3); // Different UA
    });

    it('should handle undefined User-Agent and IP', () => {
      const fingerprint = tokenService.generateDeviceFingerprint();
      expect(fingerprint).toHaveLength(32);
    });

    it('should generate same fingerprint for IPs in same subnet', () => {
      const fingerprint1 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.100'
      );
      const fingerprint2 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.200' // Different IP, same subnet
      );

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different subnets', () => {
      const fingerprint1 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.100'
      );
      const fingerprint2 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.2.100' // Different subnet
      );

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should include device ID in fingerprint', () => {
      const fingerprint1 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.1',
        'device123'
      );
      const fingerprint2 = tokenService.generateDeviceFingerprint(
        'Mozilla/5.0',
        '192.168.1.1',
        'device456'
      );

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a JWT access token', async () => {
      const payload = {
        sub: 'user123',
        email: 'user@example.com',
        roles: ['admin'],
        permissions: ['*'],
      };

      const token = await tokenService.generateAccessToken(payload);

      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 'user123',
        email: 'user@example.com',
        roles: ['admin'],
        permissions: ['*'],
        deviceId: undefined,
      });
      expect(token).toBe('mocked-access-token');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', async () => {
      const payload = {
        userId: 'user123',
        email: 'user@example.com',
        roles: ['developer'],
        permissions: ['project:read', 'project:write'],
      };

      const tokenPair = await tokenService.generateTokenPair(payload);

      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair).toHaveProperty('expiresIn');
      expect(tokenPair).toHaveProperty('refreshTokenExpiresIn');
      expect(tokenPair.expiresIn).toBe(24 * 60 * 60);
      expect(tokenPair.refreshTokenExpiresIn).toBe(7 * 24 * 60 * 60);
    });

    it('should store device fingerprint when Redis is connected', async () => {
      tokenService.setRedisClient(mockRedis);

      const payload = {
        userId: 'user123',
      };
      const options: TokenRefreshOptions = {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
        deviceId: 'device123',
      };

      await tokenService.generateTokenPair(payload, options);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.sadd).toHaveBeenCalled();
    });
  });

  describe('validateRefreshToken', () => {
    it('should return null when Redis is not connected', async () => {
      const result = await tokenService.validateRefreshToken('some-refresh-token');
      expect(result).toBeNull();
    });

    it('should return null when token is blacklisted', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(1); // Blacklisted
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          deviceId: 'device123',
          jti: 'jti123',
          exp: Date.now() + 1000000,
        })
      );

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.validateRefreshToken('some-refresh-token');
      expect(result).toBeNull();
    });

    it('should return token data when valid', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0); // Not blacklisted
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          deviceId: 'device123',
          jti: 'jti123',
          exp: Date.now() + 1000000,
        })
      );

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.validateRefreshToken('some-refresh-token');

      expect(result).toEqual({
        userId: 'user123',
        deviceId: 'device123',
        jti: 'jti123',
        exp: expect.any(Number),
      });
    });

    it('should return null when token is expired', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0);
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          deviceId: 'device123',
          jti: 'jti123',
          exp: Date.now() - 1000, // Already expired
        })
      );

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.validateRefreshToken('some-refresh-token');

      expect(result).toBeNull();
    });
  });

  describe('refreshTokens', () => {
    it('should return null when Redis is not connected', async () => {
      const result = await tokenService.refreshTokens('some-refresh-token');
      expect(result).toBeNull();
    });

    it('should return null when token is blacklisted', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(1); // Blacklisted
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          jti: 'jti123',
          exp: Date.now() + 1000000,
        })
      );

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.refreshTokens('some-refresh-token');
      expect(result).toBeNull();
      expect(mockLog.warn).toHaveBeenCalled();
    });

    it('should return null when token does not exist', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0);
      mockRedis.get = jest.fn().mockResolvedValue(null);

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.refreshTokens('some-refresh-token');
      expect(result).toBeNull();
    });

    it('should successfully refresh tokens', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0);
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          deviceId: 'device123',
          fingerprint: 'fp123',
          jti: 'jti123',
          exp: Date.now() + 1000000,
        })
      );
      mockRedis.eval = jest.fn().mockImplementation((script: string) => {
        if (script.includes('refresh_attempts')) {
          return 'OK';
        }
        return {
          ok: JSON.stringify({ userId: 'user123', deviceId: 'device123' }),
        };
      });

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.refreshTokens('some-refresh-token', {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe('mocked-access-token');
      expect(result?.refreshToken).toBeDefined();
    });
  });

  describe('revokeToken', () => {
    it('should revoke a refresh token', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          userId: 'user123',
          jti: 'jti123',
          exp: Date.now() + 1000000,
        })
      );

      tokenService.setRedisClient(mockRedis);

      await tokenService.revokeToken('some-refresh-token');

      expect(mockRedis.del).toHaveBeenCalledWith('used_jti:jti123');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh_token:some-refresh-token');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:some-refresh-token',
        '1',
        'PX',
        expect.any(Number)
      );
    });

    it('should handle Redis not connected', async () => {
      await tokenService.revokeToken('some-refresh-token');
      // Should not throw
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      mockRedis.eval = jest.fn().mockResolvedValue(3);
      mockRedis.smembers = jest.fn().mockResolvedValue(['fp1', 'fp2']);
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          fingerprint: 'fp1',
          userAgent: 'Mozilla/5.0',
          ipPrefix: '192.168.1.0/24',
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
        })
      );
      mockRedis.del = jest.fn().mockResolvedValue(1);
      mockRedis.srem = jest.fn().mockResolvedValue(1);

      tokenService.setRedisClient(mockRedis);

      await tokenService.revokeAllUserTokens('user123');

      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should handle Redis not connected', async () => {
      await tokenService.revokeAllUserTokens('user123');
      // Should not throw
    });
  });

  describe('validateDeviceFingerprint', () => {
    it('should validate fingerprint', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          fingerprint: 'fp123',
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
        })
      );
      mockRedis.set = jest.fn().mockResolvedValue('OK');

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.validateDeviceFingerprint('user123', 'fp123');
      expect(result).toBe(true);
    });
  });

  describe('getUserDevices', () => {
    it('should return user devices', async () => {
      mockRedis.smembers = jest.fn().mockResolvedValue(['fp1']);
      mockRedis.get = jest.fn().mockResolvedValue(
        JSON.stringify({
          fingerprint: 'fp1',
          userAgent: 'Mozilla/5.0',
          ipPrefix: '192.168.1.0/24',
          createdAt: Date.now(),
          lastSeenAt: Date.now(),
        })
      );

      tokenService.setRedisClient(mockRedis);

      const devices = await tokenService.getUserDevices('user123');
      expect(devices).toHaveLength(1);
    });
  });

  describe('removeDevice', () => {
    it('should remove device', async () => {
      mockRedis.del = jest.fn().mockResolvedValue(1);
      mockRedis.srem = jest.fn().mockResolvedValue(1);

      tokenService.setRedisClient(mockRedis);

      await tokenService.removeDevice('user123', 'fp123');

      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockRedis.srem).toHaveBeenCalled();
    });
  });

  describe('getRefreshAuditLog', () => {
    it('should return audit log', async () => {
      mockRedis.lrange = jest.fn().mockResolvedValue([
        JSON.stringify({
          userId: 'user123',
          success: true,
          timestamp: Date.now(),
        }),
      ]);

      tokenService.setRedisClient(mockRedis);

      const logs = await tokenService.getRefreshAuditLog('user123');
      expect(logs).toHaveLength(1);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(1);

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.isTokenBlacklisted('some-token');
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0);

      tokenService.setRedisClient(mockRedis);

      const result = await tokenService.isTokenBlacklisted('some-token');
      expect(result).toBe(false);
    });
  });
});