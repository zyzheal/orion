/**
 * NatsConnectionManager 单元测试
 *
 * 测试 NATS 连接生命周期管理, 使用 mock NATS 模块。
 */

import { NatsConnectionManager, NatsConnectionState } from '../NatsConnectionManager';

// Mock NATS module
jest.mock('nats', () => ({
  connect: jest.fn(),
}));

import * as natsModule from 'nats';
const mockConnect = natsModule.connect as jest.Mock;

function createMockConnection() {
  const neverResolve = new Promise<void>(() => {});
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue({
      drain: jest.fn().mockResolvedValue(undefined),
      [Symbol.asyncIterator]: function* () {},
    }),
    isClosed: jest.fn().mockReturnValue(false),
    drain: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    closed: jest.fn().mockReturnValue(neverResolve),
    jetstream: jest.fn().mockReturnValue({
      publish: jest.fn().mockResolvedValue({ seq: 1 }),
    }),
    jetstreamManager: jest.fn().mockReturnValue({}),
  };
}

describe('NatsConnectionManager', () => {
  let manager: NatsConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(createMockConnection());
  });

  afterEach(async () => {
    if (manager) {
      await manager.close();
    }
  });

  // ============================================================
  // 初始化
  // ============================================================

  describe('initialization', () => {
    it('should initialize with idle state', () => {
      manager = new NatsConnectionManager();
      expect(manager.getState()).toBe('idle');
      expect(manager.isConnected()).toBe(false);
    });

    it('should resolve servers from NATS_URL env var', () => {
      const origUrl = process.env.NATS_URL;
      process.env.NATS_URL = 'nats://host1:4222,nats://host2:4222';

      manager = new NatsConnectionManager();
      const info = manager.getInfo();
      expect(info.servers).toEqual(['nats://host1:4222', 'nats://host2:4222']);

      process.env.NATS_URL = origUrl;
    });

    it('should use explicit servers over env var', () => {
      process.env.NATS_URL = 'nats://env-host:4222';
      manager = new NatsConnectionManager({ servers: ['nats://explicit:4222'] });
      const info = manager.getInfo();
      expect(info.servers).toEqual(['nats://explicit:4222']);
    });

    it('should use default servers when no config and no env', () => {
      const origUrl = process.env.NATS_URL;
      delete process.env.NATS_URL;

      manager = new NatsConnectionManager();
      const info = manager.getInfo();
      expect(info.servers).toEqual(['nats://localhost:4222']);

      process.env.NATS_URL = origUrl;
    });

    it('should accept custom connection config', () => {
      manager = new NatsConnectionManager({
        timeout: 5000,
        reconnect: false,
        maxReconnectAttempts: 3,
        reconnectTimeWait: 1000,
      });
      // Just verify it doesn't throw
      expect(manager.getState()).toBe('idle');
    });
  });

  // ============================================================
  // 连接
  // ============================================================

  describe('connect', () => {
    it('should connect and transition to connected state', async () => {
      manager = new NatsConnectionManager({
        servers: ['nats://localhost:4222'],
      });

      await manager.connect();

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: ['nats://localhost:4222'],
        }),
      );
      expect(manager.getState()).toBe('connected');
      expect(manager.isConnected()).toBe(true);
    });

    it('should emit connected event', async () => {
      manager = new NatsConnectionManager();

      const handler = jest.fn();
      manager.on('connected', handler);

      await manager.connect();
      expect(handler).toHaveBeenCalled();
    });

    it('should set connectedAt timestamp', async () => {
      manager = new NatsConnectionManager();
      const before = Date.now();

      await manager.connect();

      const info = manager.getInfo();
      expect(info.connectedAt).toBeDefined();
      expect(info.connectedAt!.getTime()).toBeGreaterThanOrEqual(before - 100);
    });

    it('should throw if NATS module is not available', async () => {
      mockConnect.mockImplementation(async () => {
        throw new Error('Connection refused');
      });

      manager = new NatsConnectionManager();

      await expect(manager.connect()).rejects.toThrow('Connection refused');
      expect(manager.getState()).toBe('disconnected');
    });

    it('should be idempotent - second connect returns immediately if already connected', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();
      // Second connect should return without calling connect again
      await manager.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 关闭
  // ============================================================

  describe('close', () => {
    it('should drain and close the connection', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();

      const conn = manager.getConnection();
      await manager.close();

      expect(conn.drain).toHaveBeenCalled();
      expect(conn.close).toHaveBeenCalled();
    });

    it('should transition to closed state', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();
      await manager.close();

      expect(manager.getState()).toBe('closed');
      expect(manager.isConnected()).toBe(false);
    });

    it('should clear connectedAt', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();
      await manager.close();

      expect(manager.getInfo().connectedAt).toBeUndefined();
    });

    it('should emit closed event', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();

      const handler = jest.fn();
      manager.on('closed', handler);

      await manager.close();
      expect(handler).toHaveBeenCalled();
    });

    it('should be safe to call without connecting first', async () => {
      manager = new NatsConnectionManager();
      await manager.close();
      expect(manager.getState()).toBe('closed');
    });
  });

  // ============================================================
  // 健康检查
  // ============================================================

  describe('healthCheck', () => {
    it('should return down when not connected', async () => {
      manager = new NatsConnectionManager();
      const result = await manager.healthCheck();
      expect(result.status).toBe('down');
    });

    it('should return down when connection is closed', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();
      const conn = manager.getConnection();
      conn.isClosed.mockReturnValue(true);

      const result = await manager.healthCheck();
      expect(result.status).toBe('down');
    });

    it('should return up with latency when connected', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();

      const conn = manager.getConnection();
      conn.request = jest.fn().mockResolvedValue({});

      const result = await manager.healthCheck();
      expect(result.status).toBe('up');
      expect(result.latencyMs).toBeDefined();
    });

    it('should return down when health check request fails', async () => {
      manager = new NatsConnectionManager();
      await manager.connect();

      const conn = manager.getConnection();
      conn.request = jest.fn().mockRejectedValue(new Error('timeout'));

      const result = await manager.healthCheck();
      expect(result.status).toBe('down');
    });
  });

  // ============================================================
  // 事件
  // ============================================================

  describe('events', () => {
    it('should emit stateChange on state transitions', async () => {
      manager = new NatsConnectionManager();
      const stateChanges: any[] = [];
      manager.on('stateChange', (s) => stateChanges.push(s));

      await manager.connect();
      await manager.close();

      expect(stateChanges.length).toBeGreaterThanOrEqual(2);
      expect(stateChanges[0]).toEqual({ from: 'idle', to: 'connecting' });
    });

    it('should emit error on connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      manager = new NatsConnectionManager();

      const errorHandler = jest.fn();
      manager.on('error', errorHandler);

      await expect(manager.connect()).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit disconnected when connection closes unexpectedly', async () => {
      let closedResolve: (() => void) | null = null;
      const mockConn = createMockConnection();
      mockConn.closed = jest.fn().mockReturnValue(
        new Promise<void>((resolve) => { closedResolve = resolve; }),
      );
      mockConnect.mockResolvedValue(mockConn);

      manager = new NatsConnectionManager();
      await manager.connect();

      const disconnectHandler = jest.fn();
      manager.on('disconnected', disconnectHandler);

      // Simulate unexpected close
      closedResolve!();
      // Wait for microtask to process
      await new Promise((r) => setTimeout(r, 10));

      expect(disconnectHandler).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Factory function
  // ============================================================

  describe('createNatsConnectionManager', () => {
    it('should create a new instance', () => {
      const { createNatsConnectionManager } = require('../NatsConnectionManager');
      const m = createNatsConnectionManager({ servers: ['nats://test:4222'] });
      expect(m).toBeInstanceOf(NatsConnectionManager);
      expect(m.getInfo().servers).toEqual(['nats://test:4222']);
      m.close();
    });
  });
});
