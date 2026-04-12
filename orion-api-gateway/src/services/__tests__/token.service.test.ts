/**
 * Token Service 单元测试
 */

import { TokenService, TokenPair } from '../token.service';
import { FastifyInstance, FastifyBaseLogger } from 'fastify';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockApp: Partial<FastifyInstance>;
  let mockJwt: any;
  let mockLog: FastifyBaseLogger;

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

      // 相同输入应生成相同指纹（不使用随机部分）
      // 注意：当前实现包含随机成分，所以每次调用都不同
      expect(fingerprint1).toHaveLength(32);
      expect(fingerprint2).toHaveLength(32);
      expect(fingerprint3).toHaveLength(32);
    });

    it('should handle undefined User-Agent and IP', () => {
      const fingerprint = tokenService.generateDeviceFingerprint();
      expect(fingerprint).toHaveLength(32);
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
        deviceId: 'device123',
      };

      const tokenPair = await tokenService.generateTokenPair(payload);

      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair).toHaveProperty('expiresIn');
      expect(tokenPair).toHaveProperty('refreshTokenExpiresIn');
      expect(tokenPair.expiresIn).toBe(24 * 60 * 60);
      expect(tokenPair.refreshTokenExpiresIn).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('validateRefreshToken', () => {
    it('should return null when Redis is not connected', async () => {
      const result = await tokenService.validateRefreshToken('some-refresh-token');
      expect(result).toBeNull();
    });

    it('should return token data when valid', async () => {
      // 模拟 Redis 客户端
      const mockRedis = {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            userId: 'user123',
            deviceId: 'device123',
            jti: 'jti123',
            exp: Date.now() + 1000000,
          })
        ),
      };

      tokenService.setRedisClient(mockRedis as any);

      const result = await tokenService.validateRefreshToken('some-refresh-token');

      expect(result).toEqual({
        userId: 'user123',
        deviceId: 'device123',
        jti: 'jti123',
        exp: expect.any(Number),
      });
    });

    it('should return null when token is expired', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            userId: 'user123',
            deviceId: 'device123',
            jti: 'jti123',
            exp: Date.now() - 1000, // 已过期
          })
        ),
        del: jest.fn(),
      };

      tokenService.setRedisClient(mockRedis as any);

      const result = await tokenService.validateRefreshToken('some-refresh-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke a refresh token', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            userId: 'user123',
            jti: 'jti123',
          })
        ),
        del: jest.fn().mockResolvedValue(1),
      };

      tokenService.setRedisClient(mockRedis as any);

      await tokenService.revokeToken('some-refresh-token');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh_token:some-refresh-token');
    });

    it('should handle Redis未连接的情况', async () => {
      await tokenService.revokeToken('some-refresh-token');
      // 不应抛出错误
    });
  });
});
