/**
 * WebSocket 认证测试
 */

import { WsAuthHandler } from '../ws-auth';
import { FastifyInstance } from 'fastify';

describe('WsAuthHandler', () => {
  let mockApp: Partial<FastifyInstance>;
  let authHandler: WsAuthHandler;

  beforeEach(() => {
    // 创建 mock Fastify 实例
    mockApp = {
      jwt: {
        verify: jest.fn(),
      },
    } as unknown as Partial<FastifyInstance>;

    authHandler = new WsAuthHandler(mockApp as FastifyInstance);
  });

  describe('extractToken', () => {
    it('应该从 Query 参数提取 token', () => {
      const mockRequest = {
        url: '/ws?token=test-jwt-token',
        headers: {},
      };

      // 使用反射调用私有方法
      const extractToken = (authHandler as any).extractToken.bind(authHandler);
      const token = extractToken(mockRequest);

      expect(token).toBe('test-jwt-token');
    });

    it('应该从 Sec-WebSocket-Protocol 头提取 token（Bearer 格式）', () => {
      const mockRequest = {
        url: '/ws',
        headers: {
          'sec-websocket-protocol': 'Bearer test-jwt-token',
        },
      };

      const extractToken = (authHandler as any).extractToken.bind(authHandler);
      const token = extractToken(mockRequest);

      expect(token).toBe('test-jwt-token');
    });

    it('应该从 Sec-WebSocket-Protocol 头提取 token（直接格式）', () => {
      const mockRequest = {
        url: '/ws',
        headers: {
          'sec-websocket-protocol': 'test.jwt.token',
        },
      };

      const extractToken = (authHandler as any).extractToken.bind(authHandler);
      const token = extractToken(mockRequest);

      expect(token).toBe('test.jwt.token');
    });

    it('当没有 token 时返回 null', () => {
      const mockRequest = {
        url: '/ws',
        headers: {},
      };

      const extractToken = (authHandler as any).extractToken.bind(authHandler);
      const token = extractToken(mockRequest);

      expect(token).toBeNull();
    });
  });

  describe('authenticate', () => {
    it('认证成功时返回 payload', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      };

      (mockApp.jwt!.verify as jest.Mock).mockResolvedValue(mockPayload);

      const mockRequest = {
        url: '/ws?token=valid-token',
        headers: {},
      };

      const result = await authHandler.authenticate(mockRequest);

      expect(result.authenticated).toBe(true);
      expect(result.payload).toEqual(mockPayload);
      expect(result.error).toBeUndefined();
    });

    it('认证失败时返回错误', async () => {
      (mockApp.jwt!.verify as jest.Mock).mockRejectedValue(new Error('Token expired'));

      const mockRequest = {
        url: '/ws?token=invalid-token',
        headers: {},
      };

      const result = await authHandler.authenticate(mockRequest);

      expect(result.authenticated).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toContain('Invalid or expired token');
    });

    it('没有 token 时返回错误', async () => {
      const mockRequest = {
        url: '/ws',
        headers: {},
      };

      const result = await authHandler.authenticate(mockRequest);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token is required');
    });
  });

  describe('getAuthErrorReply', () => {
    it('返回正确的错误码和消息', () => {
      const reply = authHandler.getAuthErrorReply('Token expired');

      expect(reply.code).toBe(4001);
      expect(reply.message).toBe('Token expired');
    });
  });
});
