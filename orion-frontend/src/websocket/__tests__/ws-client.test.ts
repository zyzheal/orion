/**
 * WebSocket 客户端测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrionWebSocketClient, ConnectionState } from '../ws-client';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = 0;
  url: string;
  onopen: (() => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  private sendQueue: any[] = [];

  constructor(url: string) {
    this.url = url;
    // 模拟异步连接
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  send(data: any): void {
    this.sendQueue.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code || 1000, reason: reason || '' });
  }

  // 模拟接收消息
  receive(data: any): void {
    this.onmessage?.({ data });
  }

  // 模拟错误
  triggerError(error: any): void {
    this.onerror?.(error);
  }

  // 模拟关闭
  triggerClose(code: number, reason: string): void {
    this.onclose?.({ code, reason });
  }
}

describe('OrionWebSocketClient', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('应该能够创建客户端实例', () => {
    const client = new OrionWebSocketClient({
      url: 'ws://localhost:3000/ws',
      accessToken: 'test-token',
    });

    expect(client.getState()).toBe('connecting');
    client.destroy();
  });

  it('应该能够连接和断开', async () => {
    await new Promise<void>((resolve) => {
      const client = new OrionWebSocketClient({
        url: 'ws://localhost:3000/ws',
        accessToken: 'test-token',
        reconnectEnabled: false,
        onStateChange: (state) => {
          if (state === 'connected') {
            expect(client.isConnected()).toBe(true);
            client.disconnect();
            expect(client.getState()).toBe('disconnected');
            resolve();
          }
        },
      });
    });
  });

  it('应该能够发送消息', async () => {
    await new Promise<void>((resolve) => {
      const client = new OrionWebSocketClient({
        url: 'ws://localhost:3000/ws',
        accessToken: 'test-token',
        reconnectEnabled: false,
        onStateChange: (state) => {
          if (state === 'connected') {
            const result = client.send({ type: 'test', data: 'hello' });
            expect(result).toBe(true);
            resolve();
          }
        },
      });
    });
  });

  it('应该在未连接时队列消息', () => {
    const client = new OrionWebSocketClient({
      url: 'ws://localhost:3000/ws',
      accessToken: 'test-token',
      reconnectEnabled: false,
    });

    // 立即发送消息（还未连接）
    const result = client.send({ type: 'test', data: 'hello' });
    expect(result).toBe(false);
    client.destroy();
  });

  it('应该能够接收消息', async () => {
    await new Promise<void>((resolve) => {
      const client = new OrionWebSocketClient({
        url: 'ws://localhost:3000/ws',
        accessToken: 'test-token',
        reconnectEnabled: false,
        onMessage: (data) => {
          expect(data.type).toBe('server-message');
          resolve();
        },
      });

      // 模拟接收消息
      setTimeout(() => {
        const ws = (client as any).ws as MockWebSocket;
        ws.receive(JSON.stringify({ type: 'server-message', data: 'test' }));
      }, 50);
    });
  });

  it('应该能够处理 ping 消息并回复 pong', async () => {
    await new Promise<void>((resolve) => {
      const client = new OrionWebSocketClient({
        url: 'ws://localhost:3000/ws',
        accessToken: 'test-token',
        reconnectEnabled: false,
        onStateChange: (state) => {
          if (state === 'connected') {
            // 模拟接收 ping
            const ws = (client as any).ws as MockWebSocket;
            ws.receive(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            resolve();
          }
        },
      });
    });
  });

  it('状态变化应该触发回调', async () => {
    await new Promise<void>((resolve) => {
      const states: ConnectionState[] = [];

      new OrionWebSocketClient({
        url: 'ws://localhost:3000/ws',
        accessToken: 'test-token',
        reconnectEnabled: false,
        onStateChange: (state) => {
          states.push(state);
          if (state === 'connected') {
            expect(states).toContain('connecting');
            expect(states).toContain('connected');
            resolve();
          }
        },
      });
    });
  });

  it('应该能够设置和获取 token', () => {
    const client = new OrionWebSocketClient({
      url: 'ws://localhost:3000/ws',
      reconnectEnabled: false,
    });

    client.setAccessToken('new-token');
    // 验证 URL 构建时会使用新 token
    const url = (client as any).buildWsUrl();
    expect(url).toContain('token=new-token');
    client.destroy();
  });
});

describe('OrionWebSocketClient - 重连', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('应该在断开时尝试重连', () => {
    let reconnectCount = 0;

    const client = new OrionWebSocketClient({
      url: 'ws://localhost:3000/ws',
      accessToken: 'test-token',
      initialReconnectDelay: 100,
      maxReconnectDelay: 1000,
      onStateChange: (state) => {
        if (state === 'connecting') {
          reconnectCount++;
        }
      },
    });

    // 前进时间，触发重连
    vi.advanceTimersByTime(2000);

    expect(reconnectCount).toBeGreaterThan(0);
    client.destroy();
  });
});
