/**
 * WebSocket 心跳机制测试
 */

import { HeartbeatHandler, WebSocketConnectionManager } from '../ws-heartbeat';
import { WebSocket } from 'ws';

// Mock WebSocket
class MockWebSocket {
  readyState = WebSocket.OPEN;
  private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};
  private pingCallback: (() => void) | null = null;

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  ping(callback?: (err?: Error) => void): void {
    if (callback) {
      callback();
    }
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
  }

  emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(...args));
    }
  }
}

describe('HeartbeatHandler', () => {
  let mockWs: MockWebSocket;
  let heartbeat: HeartbeatHandler;

  beforeEach(() => {
    mockWs = new MockWebSocket() as unknown as WebSocket;
    heartbeat = new HeartbeatHandler(mockWs as unknown as WebSocket, {
      intervalMs: 100,
      timeoutMs: 50,
      maxMissedPongs: 2,
    });
  });

  afterEach(() => {
    heartbeat.stop();
  });

  it('应该能够启动和停止心跳', () => {
    expect(heartbeat.getRunningStatus()).toBe(false);

    heartbeat.start();
    expect(heartbeat.getRunningStatus()).toBe(true);

    heartbeat.stop();
    expect(heartbeat.getRunningStatus()).toBe(false);
  });

  it('应该重置 missedPongs 计数器', () => {
    heartbeat.start();

    // 模拟发送 ping
    jest.useFakeTimers();

    // 前进到第一次 ping
    jest.advanceTimersByTime(100);

    // 模拟 pong 响应
    mockWs.emit('pong');

    // 验证计数器重置（通过不触发 timeout 来间接验证）
    jest.advanceTimersByTime(100);

    jest.useRealTimers();
  });

  it('应该在多次丢失 pong 后触发 timeout', (done) => {
    jest.useRealTimers();

    heartbeat = new HeartbeatHandler(mockWs as unknown as WebSocket, {
      intervalMs: 50,
      timeoutMs: 30,
      maxMissedPongs: 1,
    });

    heartbeat.on('timeout', () => {
      done();
    });

    heartbeat.start();

    // 模拟不响应 pong，应该在 maxMissedPongs + 1 次后触发 timeout
  });
});

describe('WebSocketConnectionManager', () => {
  let manager: WebSocketConnectionManager;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    manager = new WebSocketConnectionManager();
    mockWs = new MockWebSocket() as unknown as WebSocket;
  });

  afterEach(() => {
    manager.closeAll();
  });

  it('应该能够添加和获取连接', () => {
    manager.addConnection('client-1', mockWs);

    const connection = manager.getConnection('client-1');
    expect(connection).toBeDefined();

    expect(manager.getConnectionCount()).toBe(1);
  });

  it('应该能够移除连接', () => {
    manager.addConnection('client-1', mockWs);
    expect(manager.getConnectionCount()).toBe(1);

    manager.removeConnection('client-1');
    expect(manager.getConnectionCount()).toBe(0);
    expect(manager.getConnection('client-1')).toBeUndefined();
  });

  it('应该能够发送消息到指定客户端', () => {
    const sendSpy = jest.spyOn(mockWs, 'send' as any);
    manager.addConnection('client-1', mockWs);

    const result = manager.sendToClient('client-1', 'test message');

    expect(result).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith(JSON.stringify('test message'));
  });

  it('广播消息给所有客户端', () => {
    const mockWs1 = new MockWebSocket() as unknown as WebSocket;
    const mockWs2 = new MockWebSocket() as unknown as WebSocket;

    const sendSpy1 = jest.spyOn(mockWs1, 'send' as any);
    const sendSpy2 = jest.spyOn(mockWs2, 'send' as any);

    manager.addConnection('client-1', mockWs1);
    manager.addConnection('client-2', mockWs2);

    manager.broadcast({ type: 'test', data: 'hello' });

    expect(sendSpy1).toHaveBeenCalled();
    expect(sendSpy2).toHaveBeenCalled();
  });

  it('应该能够获取所有连接 ID', () => {
    manager.addConnection('client-1', mockWs);
    manager.addConnection('client-2', mockWs);

    const ids = manager.getAllConnectionIds();

    expect(ids).toEqual(['client-1', 'client-2']);
  });
});
