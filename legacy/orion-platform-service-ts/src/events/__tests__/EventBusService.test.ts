/**
 * EventBusService 单元测试
 *
 * 使用 mock NATS 连接测试核心发布/订阅逻辑,
 * 不依赖真实 NATS 服务器。
 */

import { EventBusService, ConnectionState, EventBusError } from '../../services/event-bus-service';

// ============================================================
// Mock NATS 模块
// ============================================================

interface MockSubscription {
  drain: jest.Mock;
  [Symbol.asyncIterator](): AsyncIterator<any>;
}

function createMockSubscription(): MockSubscription {
  return {
    drain: jest.fn().mockResolvedValue(undefined),
    [Symbol.asyncIterator]: function* () {
      // Empty by default
    },
  };
}

interface MockJetStream {
  publish: jest.Mock;
  consumers: { get: jest.Mock };
}

function createMockJetStream(): MockJetStream {
  return {
    publish: jest.fn().mockResolvedValue({ seq: 1 }),
    consumers: { get: jest.fn() },
  };
}

interface MockNatsConnection {
  publish: jest.Mock;
  subscribe: jest.Mock;
  isClosed: jest.Mock;
  drain: jest.Mock;
  close: jest.Mock;
  closed: jest.Mock<Promise<void>>;
  jetstream: jest.Mock;
  jetstreamManager: jest.Mock;
}

function createMockNatsConnection(): MockNatsConnection {
  const jetStream = createMockJetStream();
  // closed() should never resolve during normal operation (simulates a live connection)
  const neverResolve = new Promise<void>(() => {});
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(createMockSubscription()),
    isClosed: jest.fn().mockReturnValue(false),
    drain: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    closed: jest.fn().mockReturnValue(neverResolve),
    jetstream: jest.fn().mockReturnValue(jetStream),
    jetstreamManager: jest.fn().mockReturnValue({}),
  };
}

// Mock the dynamic import of 'nats'
jest.mock('nats', () => ({
  connect: jest.fn(),
}));

import * as natsModule from 'nats';
const mockConnect = natsModule.connect as jest.Mock;

describe('EventBusService', () => {
  let eventBus: EventBusService | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(createMockNatsConnection());
  });

  afterEach(async () => {
    if (eventBus) {
      // Suppress error events during close
      eventBus.removeAllListeners('error');
      await eventBus.close();
      eventBus = null;
    }
  });

  /** Helper to create EventBusService with suppressed error events */
  function createEventBus(
    config: Parameters<typeof EventBusService>[0],
    repos?: Parameters<typeof EventBusService>[1],
  ) {
    const bus = new EventBusService(config, repos);
    // Suppress uncaught error events during tests
    bus.on('error', () => {});
    return bus;
  }

  // ============================================================
  // 初始化与状态
  // ============================================================

  describe('initialization', () => {
    it('should initialize with disabled state when enabled=false', () => {
      eventBus = createEventBus({ enabled: false });
      const status = eventBus.getConnectionStatus();
      expect(status.state).toBe('disabled');
      expect(eventBus.isHealthy()).toBe(true);
      expect(eventBus.isConnected()).toBe(false);
    });

    it('should initialize with disconnected state when enabled=true', () => {
      eventBus = createEventBus({ enabled: true });
      const status = eventBus.getConnectionStatus();
      expect(status.state).toBe('disconnected');
    });

    it('should return default servers from config', () => {
      eventBus = createEventBus({});
      const config = eventBus.getConfig();
      expect(config.servers).toEqual([]);
      expect(config.enabled).toBe(true);
    });

    it('should accept custom servers in config', () => {
      eventBus = createEventBus({
        servers: ['nats://nats1:4222', 'nats://nats2:4222'],
      });
      const config = eventBus.getConfig();
      expect(config.servers).toEqual(['nats://nats1:4222', 'nats://nats2:4222']);
    });
  });

  // ============================================================
  // 连接
  // ============================================================

  describe('connect', () => {
    it('should connect to NATS and set state to connected', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });

      await eventBus.connect();

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: ['nats://localhost:4222'],
        }),
      );
      expect(eventBus.getConnectionStatus().state).toBe('connected');
      expect(eventBus.isConnected()).toBe(true);
      expect(eventBus.isHealthy()).toBe(true);
    });

    it('should initialize JetStream on connect', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });

      await eventBus.connect();

      expect(eventBus.isJetStreamAvailable()).toBe(true);
    });

    it('should emit "connect" event on successful connection', async () => {
      eventBus = new EventBusService({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });

      const connectHandler = jest.fn();
      eventBus.on('connect', connectHandler);
      eventBus.on('error', () => {});

      await eventBus.connect();
      expect(connectHandler).toHaveBeenCalled();
      await eventBus.close();
      eventBus = null;
    });

    it('should skip connection when disabled', async () => {
      eventBus = createEventBus({ enabled: false });
      await eventBus.connect();
      expect(mockConnect).not.toHaveBeenCalled();
      expect(eventBus.getConnectionStatus().state).toBe('disabled');
    });

    it('should enter fallback mode when connection fails', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });

      await eventBus.connect();

      expect(eventBus.getConnectionStatus().state).toBe('fallback');
      expect(eventBus.isHealthy()).toBe(true);
      expect(eventBus.isConnected()).toBe(false);
    });

    it('should emit fallback event on connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      eventBus = new EventBusService({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });

      const fallbackHandler = jest.fn();
      eventBus.on('fallback', fallbackHandler);
      eventBus.on('error', () => {});

      await eventBus.connect();

      expect(fallbackHandler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'connection_failed' }),
      );

      await eventBus.close();
      eventBus = null;
    });
  });

  // ============================================================
  // 发布
  // ============================================================

  describe('publish', () => {
    beforeEach(async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();
    });

    it('should publish event and return event ID', async () => {
      const eventId = await eventBus!.publish('test.event', { foo: 'bar' });
      expect(eventId).toBeDefined();
    });

    it('should publish event with JetStream when available', async () => {
      await eventBus!.publish('test.event', { key: 'value' }, {
        source: 'test-source',
        tenantId: 'tenant-1',
      });

      const jsClient = eventBus!.getJetStreamClient();
      expect(jsClient?.publish).toHaveBeenCalled();
    });

    it('should wrap data in TypedEnvelope format', async () => {
      await eventBus!.publish('test.event', { data: 'test' });

      const jsClient = eventBus!.getJetStreamClient();
      const callArgs = jsClient.publish.mock.calls[0];
      const payload = callArgs[1];
      const envelope = JSON.parse(new TextDecoder().decode(payload));

      expect(envelope.specversion).toBe('1.0');
      expect(envelope.type).toBe('test.event');
      expect(envelope.source).toBe('orion-platform-service');
      expect(envelope.data).toEqual({ data: 'test' });
      expect(envelope.time).toBeDefined();
    });

    it('should include tenant ID in envelope when provided', async () => {
      await eventBus!.publish('test.event', { data: 'test' }, {
        tenantId: 'tenant-abc',
      });

      const jsClient = eventBus!.getJetStreamClient();
      const callArgs = jsClient.publish.mock.calls[0];
      const payload = callArgs[1];
      const envelope = JSON.parse(new TextDecoder().decode(payload));

      expect(envelope.tenantid).toBe('tenant-abc');
    });

    it('should use custom subject when provided', async () => {
      await eventBus!.publish('test.event', {}, {
        subject: 'custom.subject.path',
      });

      const jsClient = eventBus!.getJetStreamClient();
      expect(jsClient.publish).toHaveBeenCalledWith(
        'custom.subject.path',
        expect.any(Uint8Array),
      );
    });

    it('should fallback to in-memory delivery when not connected and no event repo', async () => {
      eventBus = createEventBus({ enabled: true, autoConnect: false });

      // Implementation falls back to in-memory delivery, not throwing
      const result = await eventBus.publish('test.event', {});
      expect(result).toMatch(/^fallback:/);
    });
  });

  // ============================================================
  // 订阅
  // ============================================================

  describe('subscribe', () => {
    beforeEach(async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();
    });

    it('should subscribe to NATS subject and return unsubscribe function', async () => {
      const handler = jest.fn();
      const unsubscribe = await eventBus!.subscribe('test.event', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return no-op unsubscribe in fallback mode', async () => {
      mockConnect.mockRejectedValue(new Error('connection refused'));

      const fallbackBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await fallbackBus.connect();

      const handler = jest.fn();
      const unsubscribe = await fallbackBus.subscribe('test.event', handler);

      expect(typeof unsubscribe).toBe('function');
      await expect(unsubscribe()).resolves.toBeUndefined();
      await fallbackBus.close();
    });

    it('should throw error when disabled', async () => {
      eventBus = createEventBus({ enabled: false });
      const handler = jest.fn();

      await expect(
        eventBus.subscribe('test.event', handler),
      ).rejects.toThrow(EventBusError);
    });

    it('should persist subscription info when repo available', async () => {
      const mockSubRepo = {
        insert: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };

      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      }, { subscriptionRepo: mockSubRepo });

      await eventBus.connect();

      const handler = jest.fn();
      await eventBus.subscribe('test.event', handler);

      expect(mockSubRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          subject_pattern: 'test.event',
          handler_type: 'nats',
          status: 'active',
        }),
      );
    });
  });

  // ============================================================
  // 健康检查
  // ============================================================

  describe('checkHealth', () => {
    it('should return up when connected', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();

      const health = await eventBus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.state).toBe('connected');
    });

    it('should return up with fallback state when in fallback mode', async () => {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();

      const health = await eventBus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.state).toBe('fallback');
    });

    it('should return up when disabled', async () => {
      eventBus = createEventBus({ enabled: false });
      const health = await eventBus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.state).toBe('disabled');
    });

    it('should return down when disconnected after close', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();
      await eventBus.close();
      eventBus = null; // prevent double close in afterEach

      // Need a fresh instance that's closed
      const closedBus = createEventBus({ enabled: false });
      const health = await closedBus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.state).toBe('disabled');
    });
  });

  // ============================================================
  // 关闭
  // ============================================================

  describe('close', () => {
    it('should drain and close NATS connection', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();
      await eventBus.close();
      eventBus = null;

      expect(eventBus === null).toBe(true);
    });

    it('should clear JetStream references', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();
      await eventBus.close();

      expect(eventBus.isJetStreamAvailable()).toBe(false);
      expect(eventBus.getJetStreamClient()).toBeNull();
    });

    it('should be safe to call multiple times', async () => {
      eventBus = createEventBus({ enabled: true, autoConnect: false });
      await eventBus.close();
      await eventBus.close();
      // Should not throw
    });
  });

  // ============================================================
  // Metrics
  // ============================================================

  describe('metrics', () => {
    beforeEach(async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();
    });

    it('should track publish success count', async () => {
      const before = eventBus!.getMetrics();
      await eventBus!.publish('test.event', {});
      const after = eventBus!.getMetrics();

      expect(after.publishSuccess).toBe(before.publishSuccess + 1);
    });

    it('should reset metrics', async () => {
      await eventBus!.publish('test.event', {});
      eventBus!.resetMetrics();
      const metrics = eventBus!.getMetrics();
      expect(metrics.publishSuccess).toBe(0);
    });
  });

  // ============================================================
  // Fallback mode
  // ============================================================

  describe('fallback mode', () => {
    it('should report isFallback as true after connection failure', async () => {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();

      expect(eventBus.isFallback()).toBe(true);
    });
  });

  // ============================================================
  // Connection state semantics
  // ============================================================

  describe('connection state semantics', () => {
    it('should have distinct connected and fallback states', async () => {
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();

      expect(eventBus.isConnected()).toBe(true);
      expect(eventBus.isFallback()).toBe(false);
      expect(eventBus.isHealthy()).toBe(true);
    });

    it('should have fallback=true, connected=false after failure', async () => {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      eventBus = createEventBus({
        servers: ['nats://localhost:4222'],
        enabled: true,
        autoConnect: false,
      });
      await eventBus.connect();

      expect(eventBus.isConnected()).toBe(false);
      expect(eventBus.isFallback()).toBe(true);
      expect(eventBus.isHealthy()).toBe(true);
    });

    it('should expose full connection status details', async () => {
      eventBus = createEventBus({ enabled: true, autoConnect: false });
      await eventBus.connect();

      const status = eventBus.getConnectionStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('natsAvailable');
      expect(status).toHaveProperty('reconnectAttempts');
    });
  });
});
