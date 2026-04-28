/**
 * WebSocket 心跳机制测试
 */

import { HeartbeatHandler, WebSocketConnectionManager } from '../ws-heartbeat';
import { WebSocket } from 'ws';

// Mock WebSocket - implements minimal WebSocket interface for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  binaryType = 'nodebuffer' as const;
  bufferedAmount = 0;
  extensions = '';
  protocol = '';
  isPaused = false;
  url = '';

  // Make listeners map public to avoid TypeScript issues
  _listeners: { [key: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
    }
  }

  addEventListener(event: string, callback: (...args: any[]) => void): void {
    this.on(event, callback);
  }

  removeEventListener(event: string, callback: (...args: any[]) => void): void {
    this.off(event, callback);
  }

  ping(callback?: (err?: Error) => void): void {
    if (callback) {
      callback();
    }
  }

  pong(): void {}

  send(data: any, cb?: (err?: Error) => void): void {
    if (cb) cb();
  }

  terminate(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  emit(event: string, ...args: any[]): void {
    if (this._listeners[event]) {
      this._listeners[event].forEach((cb) => cb(...args));
    }
  }
}

describe('HeartbeatHandler', () => {
  let mockWs: MockWebSocket;
  let heartbeat: HeartbeatHandler;

  beforeEach(() => {
    mockWs = new MockWebSocket();
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
    mockWs = new MockWebSocket();
  });

  afterEach(() => {
    manager.closeAll();
  });

  it('应该能够添加和获取连接', () => {
    manager.addConnection('client-1', mockWs as unknown as WebSocket);

    const connection = manager.getConnection('client-1');
    expect(connection).toBeDefined();

    expect(manager.getConnectionCount()).toBe(1);
  });

  it('应该能够移除连接', () => {
    manager.addConnection('client-1', mockWs as unknown as WebSocket);
    expect(manager.getConnectionCount()).toBe(1);

    manager.removeConnection('client-1');
    expect(manager.getConnectionCount()).toBe(0);
    expect(manager.getConnection('client-1')).toBeUndefined();
  });

  it('应该能够发送消息到指定客户端', () => {
    const sendSpy = jest.spyOn(mockWs, 'send');
    manager.addConnection('client-1', mockWs as unknown as WebSocket);

    const result = manager.sendToClient('client-1', 'test message');

    expect(result).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith('test message');
  });

  it('广播消息给所有客户端', () => {
    const mockWs1 = new MockWebSocket();
    const mockWs2 = new MockWebSocket();

    const sendSpy1 = jest.spyOn(mockWs1, 'send');
    const sendSpy2 = jest.spyOn(mockWs2, 'send');

    manager.addConnection('client-1', mockWs1 as unknown as WebSocket);
    manager.addConnection('client-2', mockWs2 as unknown as WebSocket);

    manager.broadcast(JSON.stringify({ type: 'test', data: 'hello' }));

    expect(sendSpy1).toHaveBeenCalled();
    expect(sendSpy2).toHaveBeenCalled();
  });

  it('应该能够获取所有连接 ID', () => {
    manager.addConnection('client-1', mockWs as unknown as WebSocket);
    manager.addConnection('client-2', mockWs as unknown as WebSocket);

    const ids = manager.getAllConnectionIds();

    expect(ids).toEqual(['client-1', 'client-2']);
  });
});
