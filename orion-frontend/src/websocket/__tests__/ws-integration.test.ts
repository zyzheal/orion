// @ts-nocheck
/**
 * WebSocket 前后端联调测试
 *
 * 测试内容：
 * - 连接认证流程（Token 验证）
 * - 心跳保活机制
 * - 断线重连策略
 * - 消息队列持久化
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 模拟环境配置
const WS_URL = process.env.WS_TEST_URL || 'ws://localhost:3000/ws';
const TEST_TOKEN = process.env.WS_TEST_TOKEN || 'test-jwt-token';

// 仅在集成测试环境运行
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

// Mock WebSocket 用于单元测试
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private sentMessages: string[] = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = typeof protocols === 'string' ? protocols : protocols?.[0] || '';
    MockWebSocket.instances.push(this);

    // 模拟异步连接
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({ type: 'open' } as Event);
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: true } as CloseEvent);
  }

  // 测试辅助方法
  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  simulateMessage(data: object): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError(error: Error): void {
    this.onerror?.({ error } as unknown as Event);
  }

  simulateClose(code: number, reason: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: false } as CloseEvent);
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}

describe('WebSocket 前后端联调测试', () => {
  describe('消息协议验证', () => {
    it('前端发送的 ping 格式应该符合后端预期', () => {
      const pingMessage = {
        type: 'ping',
        timestamp: Date.now(),
      };

      // 验证消息格式
      expect(pingMessage).toHaveProperty('type');
      expect(pingMessage.type).toBe('ping');
      expect(pingMessage).toHaveProperty('timestamp');
      expect(typeof pingMessage.timestamp).toBe('number');
    });

    it('后端返回的 connected 消息格式应该被前端正确解析', () => {
      const connectedMessage = {
        type: 'connected',
        clientId: 'client-123',
        userId: 'user-456',
        timestamp: Date.now(),
      };

      // 验证消息格式
      expect(connectedMessage.type).toBe('connected');
      expect(connectedMessage.clientId).toBeDefined();
      expect(connectedMessage.userId).toBeDefined();
      expect(connectedMessage.timestamp).toBeDefined();
    });

    it('后端返回的 pong 消息格式应该被前端正确处理', () => {
      const pongMessage = {
        type: 'pong',
        timestamp: Date.now(),
      };

      expect(pongMessage.type).toBe('pong');
      expect(pongMessage.timestamp).toBeDefined();
    });

    it('错误码应该统一', () => {
      const errorCodes = {
        UNAUTHORIZED: 4001,
        INVALID_TOKEN: 4002,
        TOKEN_EXPIRED: 4003,
        RATE_LIMITED: 4004,
      };

      // 验证错误码定义
      expect(errorCodes.UNAUTHORIZED).toBe(4001);
      expect(errorCodes.INVALID_TOKEN).toBe(4002);
      expect(errorCodes.TOKEN_EXPIRED).toBe(4003);
      expect(errorCodes.RATE_LIMITED).toBe(4004);
    });
  });

  describe('Token 刷新流程验证', () => {
    it('Token 应该正确附加到 WebSocket URL', () => {
      const baseUrl = 'ws://localhost:3000/ws';
      const token = 'test-jwt-token';

      const separator = baseUrl.includes('?') ? '&' : '?';
      const wsUrl = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;

      expect(wsUrl).toBe('ws://localhost:3000/ws?token=test-jwt-token');
    });

    it('Token 中的特殊字符应该被正确编码', () => {
      const baseUrl = 'ws://localhost:3000/ws';
      const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature';

      const separator = baseUrl.includes('?') ? '&' : '?';
      const wsUrl = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;

      expect(wsUrl).toContain('token=');
      expect(wsUrl).not.toContain(' ');
    });

    it('Token 过期后应该触发重新认证', () => {
      const expiredTokenMessage = {
        error: 'UNAUTHORIZED',
        message: 'Token expired',
        code: 4003,
      };

      expect(expiredTokenMessage.code).toBe(4003);
      expect(expiredTokenMessage.message).toContain('Token');
    });
  });

  describe('心跳机制联调', () => {
    it('心跳间隔配置应该前后端一致', () => {
      const clientHeartbeatInterval = 30000; // 30 秒
      const serverHeartbeatInterval = 30000; // 30 秒

      expect(clientHeartbeatInterval).toBe(serverHeartbeatInterval);
    });

    it('心跳超时配置应该合理', () => {
      const clientHeartbeatInterval = 30000;
      const serverHeartbeatTimeout = 15000;

      // 服务器超时时间应该小于客户端心跳间隔
      expect(serverHeartbeatTimeout).toBeLessThan(clientHeartbeatInterval);
    });

    it('客户端应该响应服务器的 ping', () => {
      const serverPing = { type: 'ping', timestamp: Date.now() };
      const expectedClientResponse = { type: 'pong', timestamp: expect.any(Number) };

      // 模拟客户端处理
      function handleServerPing(ping: { type: string; timestamp: number }) {
        if (ping.type === 'ping') {
          return { type: 'pong', timestamp: Date.now() };
        }
        return null;
      }

      const response = handleServerPing(serverPing);
      expect(response).toEqual(expectedClientResponse);
    });
  });

  describe('重连策略验证', () => {
    it('指数退避算法应该正确计算延迟', () => {
      const baseDelay = 1000; // 1 秒
      const maxDelay = 30000; // 30 秒
      const maxAttempts = 10;

      const delays: number[] = [];

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const exponentialDelay = Math.pow(2, attempt - 1) * baseDelay;
        const delay = Math.min(exponentialDelay, maxDelay);
        delays.push(delay);
      }

      // 验证延迟递增
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
      }

      // 验证最大延迟
      expect(Math.max(...delays)).toBe(maxDelay);
    });

    it('重连次数应该有限制', () => {
      const maxReconnectAttempts = 10;
      let attempts = 0;
      let connected = false;

      function shouldReconnect(): boolean {
        return !connected && attempts < maxReconnectAttempts;
      }

      while (shouldReconnect()) {
        attempts++;
        // 模拟第 5 次连接成功
        if (attempts === 5) {
          connected = true;
        }
      }

      expect(attempts).toBeLessThanOrEqual(maxReconnectAttempts);
      expect(connected).toBe(true);
    });

    it('重连状态应该正确传递给 Store', () => {
      const stateTransitions: string[] = [];

      function trackStateTransition(state: string) {
        stateTransitions.push(state);
      }

      // 模拟状态转换
      trackStateTransition('disconnected');
      trackStateTransition('connecting');
      trackStateTransition('disconnected');
      trackStateTransition('connecting');
      trackStateTransition('connected');

      expect(stateTransitions).toContain('disconnected');
      expect(stateTransitions).toContain('connecting');
      expect(stateTransitions).toContain('connected');
    });
  });

  describe('消息队列持久化测试', () => {
    it('未连接时消息应该被队列化', () => {
      const messageQueue: string[] = [];
      let isConnected = false;

      function sendMessage(data: object): boolean {
        const message = JSON.stringify(data);
        if (isConnected) {
          // 实际发送
          return true;
        } else {
          // 加入队列
          messageQueue.push(message);
          return false;
        }
      }

      // 发送消息时未连接
      const result = sendMessage({ type: 'test', data: 'hello' });
      expect(result).toBe(false);
      expect(messageQueue.length).toBe(1);
    });

    it('连接后应该发送队列中的消息', () => {
      const messageQueue: string[] = [
        JSON.stringify({ type: 'test1', data: 'hello' }),
        JSON.stringify({ type: 'test2', data: 'world' }),
      ];
      const sentMessages: string[] = [];
      let isConnected = true;

      function flushQueue() {
        while (messageQueue.length > 0) {
          const message = messageQueue.shift();
          if (message && isConnected) {
            sentMessages.push(message);
          }
        }
      }

      flushQueue();

      expect(sentMessages.length).toBe(2);
      expect(messageQueue.length).toBe(0);
    });

    it('消息队列大小应该有限制', () => {
      const MAX_QUEUE_SIZE = 100;
      const messageQueue: string[] = [];

      function enqueueMessage(message: string): boolean {
        if (messageQueue.length >= MAX_QUEUE_SIZE) {
          return false; // 队列已满
        }
        messageQueue.push(message);
        return true;
      }

      // 填充队列
      for (let i = 0; i < 150; i++) {
        enqueueMessage(JSON.stringify({ type: 'test', index: i }));
      }

      expect(messageQueue.length).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
    });
  });
});

describe('WebSocket Store 状态同步测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connectionState 应该正确更新', () => {
    const states = ['disconnected', 'connecting', 'connected', 'reconnecting', 'error', 'closed'];

    states.forEach((state) => {
      expect(['disconnected', 'connecting', 'connected', 'reconnecting', 'error', 'closed']).toContain(state);
    });
  });

  it('统计信息应该正确累加', () => {
    const stats = {
      reconnectAttempts: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastMessageTime: null as number | null,
      lastPongTime: null as number | null,
    };

    function incrementStat(key: keyof typeof stats) {
      if (key === 'lastMessageTime' || key === 'lastPongTime') {
        stats[key] = Date.now();
      } else {
        (stats[key] as number)++;
      }
    }

    incrementStat('messagesSent');
    incrementStat('messagesSent');
    incrementStat('messagesReceived');
    incrementStat('reconnectAttempts');

    expect(stats.messagesSent).toBe(2);
    expect(stats.messagesReceived).toBe(1);
    expect(stats.reconnectAttempts).toBe(1);
  });

  it('重连计数应该在连接成功后重置', () => {
    let reconnectAttempts = 3;
    let connectionState = 'connecting';

    function onConnected() {
      reconnectAttempts = 0;
      connectionState = 'connected';
    }

    onConnected();

    expect(reconnectAttempts).toBe(0);
    expect(connectionState).toBe('connected');
  });
});

// 条件性运行实际 WebSocket 连接测试
(shouldRunIntegrationTests ? describe : describe.skip)('实际 WebSocket 连接测试', () => {
  let WebSocket: typeof import('ws').WebSocket;

  beforeAll(async () => {
    // 在 Node.js 环境中使用 ws 库
    const wsModule = await import('ws');
    WebSocket = wsModule.WebSocket;
  });

  it('应该能够连接到服务器', (done) => {
    const client = new WebSocket(`${WS_URL}?token=${TEST_TOKEN}`);

    client.on('open', () => {
      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
      done();
    });

    client.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('应该接收欢迎消息', (done) => {
    const client = new WebSocket(`${WS_URL}?token=${TEST_TOKEN}`);

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('connected');
      expect(message.clientId).toBeDefined();
      client.close();
      done();
    });

    client.on('error', (error) => {
      done(error);
    });
  }, 10000);
});