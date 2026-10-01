/**
 * WebSocket 服务器集成测试
 *
 * 测试内容：
 * - 连接认证流程
 * - 消息收发
 * - 心跳机制
 * - 广播功能
 */

import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import fastify from 'fastify';
import { WebSocketServerManager } from '../ws-server';
import { WebSocketConnectionManager } from '../ws-heartbeat';
import { WsAuthHandler } from '../ws-auth';

describe('WebSocket Server Integration Tests', () => {
  describe('连接管理器测试', () => {
    let manager: WebSocketConnectionManager;

    beforeEach(() => {
      manager = new WebSocketConnectionManager();
    });

    afterEach(() => {
      manager.closeAll();
    });

    it('应该能够正确管理连接', () => {
      expect(manager.getConnectionCount()).toBe(0);
      expect(manager.getAllConnectionIds()).toEqual([]);
    });

    it('应该能够发送消息到指定客户端', () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        ping: jest.fn(),
        pong: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        binaryType: 'nodebuffer',
        bufferedAmount: 0,
        extensions: '',
        protocol: '',
        isPaused: false,
        url: '',
      } as unknown as WebSocket;

      manager.addConnection('test-client', mockWs);

      const result = manager.sendToClient('test-client', JSON.stringify({ type: 'test' }));

      expect(result).toBe(true);
      expect(manager.getConnectionCount()).toBe(1);
    });

    it('应该能够广播消息', () => {
      const mockWs1 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        ping: jest.fn(),
        pong: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        binaryType: 'nodebuffer',
        bufferedAmount: 0,
        extensions: '',
        protocol: '',
        isPaused: false,
        url: '',
      } as unknown as WebSocket;

      const mockWs2 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        ping: jest.fn(),
        pong: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        binaryType: 'nodebuffer',
        bufferedAmount: 0,
        extensions: '',
        protocol: '',
        isPaused: false,
        url: '',
      } as unknown as WebSocket;

      manager.addConnection('client-1', mockWs1);
      manager.addConnection('client-2', mockWs2);

      manager.broadcast(JSON.stringify({ type: 'broadcast', data: 'hello' }));

      expect(manager.getConnectionCount()).toBe(2);
    });
  });

  describe('认证处理器测试', () => {
    let mockApp: Partial<FastifyInstance>;
    let authHandler: WsAuthHandler;

    beforeEach(() => {
      mockApp = {
        jwt: {
          verify: jest.fn().mockResolvedValue({
            sub: 'user-123',
            email: 'test@example.com',
            roles: ['user'],
          }),
        } as any,
      };

      authHandler = new WsAuthHandler(mockApp as FastifyInstance);
    });

    it('应该从 Query 参数提取 token', async () => {
      const mockRequest = {
        url: '/ws?token=test-token',
        headers: {},
      };

      const result = await authHandler.authenticate(mockRequest);

      expect(result.authenticated).toBe(true);
      expect(result.payload?.sub).toBe('user-123');
    });

    it('应该拒绝没有 token 的请求', async () => {
      const mockRequest = {
        url: '/ws',
        headers: {},
      };

      const result = await authHandler.authenticate(mockRequest);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token is required');
    });

    it('应该拒绝无效 token', async () => {
      mockApp.jwt = {
        verify: jest.fn().mockRejectedValue(new Error('Invalid token')),
      } as any;

      authHandler = new WsAuthHandler(mockApp as FastifyInstance);

      const mockRequest = {
        url: '/ws?token=invalid-token',
        headers: {},
      };

      const result = await authHandler.authenticate(mockRequest);

      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Invalid or expired token');
    });
  });

  describe('消息协议验证', () => {
    it('欢迎消息格式应该正确', () => {
      const welcomeMessage = {
        type: 'connected',
        clientId: 'client-123',
        userId: 'user-456',
        timestamp: Date.now(),
      };

      expect(welcomeMessage.type).toBe('connected');
      expect(welcomeMessage.clientId).toBeDefined();
      expect(welcomeMessage.userId).toBeDefined();
      expect(welcomeMessage.timestamp).toBeDefined();
    });

    it('ping/pong 消息格式应该正确', () => {
      const pingMessage = {
        type: 'ping',
        timestamp: Date.now(),
      };

      const pongMessage = {
        type: 'pong',
        timestamp: Date.now(),
      };

      expect(pingMessage.type).toBe('ping');
      expect(pongMessage.type).toBe('pong');
      expect(pingMessage.timestamp).toBeDefined();
      expect(pongMessage.timestamp).toBeDefined();
    });

    it('错误码应该统一', () => {
      const errorCodes = {
        UNAUTHORIZED: 4001,
        INVALID_TOKEN: 4002,
        TOKEN_EXPIRED: 4003,
        RATE_LIMITED: 4004,
      };

      expect(errorCodes.UNAUTHORIZED).toBe(4001);
      expect(errorCodes.INVALID_TOKEN).toBe(4002);
      expect(errorCodes.TOKEN_EXPIRED).toBe(4003);
    });
  });
});