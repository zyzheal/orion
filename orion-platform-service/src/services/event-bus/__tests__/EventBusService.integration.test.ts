/**
 * EventBusService Comprehensive Tests
 *
 * Tests for the main EventBusService (src/services/event-bus-service.ts)
 * covering all public methods, connection states, fallback mode,
 * JetStream integration, error handling, and edge cases.
 */

import { EventEmitter } from 'events';

// Mock the 'nats' module since it's dynamically imported
jest.mock('nats', () => ({
  connect: jest.fn(),
}));

// Mock JetStreamManagerService
jest.mock('../../jetstream-manager', () => ({
  JetStreamManagerService: jest.fn().mockImplementation(() => ({
    ensureStream: jest.fn().mockResolvedValue(undefined),
    ensureConsumer: jest.fn().mockResolvedValue(undefined),
    getMetrics: jest.fn().mockResolvedValue({ messages: 0, bytes: 0, consumers: 0 }),
    listConsumers: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock event-types ORION_STREAMS for resolveStreamForSubject
jest.mock('../../types/event-types', () => {
  const actual = jest.requireActual('../../types/event-types');
  return {
    ...actual,
    ORION_STREAMS: {
      PLATFORM: {
        name: 'ORION_PLATFORM',
        subjects: ['orion.code.*', 'orion.deploy.*'],
        retention: 'limits',
        maxMsgs: 1_000_000,
        maxAge: '7d',
        storage: 'file',
        replicas: 1,
      },
      PIPELINE: {
        name: 'ORION_PIPELINE',
        subjects: ['orion.pipeline.run.*', 'orion.pipeline.stage.*'],
        retention: 'limits',
        maxMsgs: 5_000_000,
        maxAge: '14d',
        storage: 'file',
        replicas: 1,
      },
    },
  };
});

// Mock pino logger
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
  return jest.fn().mockReturnValue(mockLogger);
});

import {
  EventBusService,
  EventBusError,
} from '../../event-bus-service';

// Helper to create a mock NATS connection
function createMockNatsConnection(overrides: Record<string, any> = {}) {
  const mockJetStream = {
    publish: jest.fn().mockResolvedValue({ seq: 1 }),
    consumers: {
      get: jest.fn().mockResolvedValue({
        fetch: jest.fn().mockResolvedValue(null),
      }),
    },
    streams: {
      add: jest.fn().mockResolvedValue({}),
    },
  };
  const mockJetStreamManager = {
    streams: { info: jest.fn(), add: jest.fn() },
    consumers: { info: jest.fn(), add: jest.fn(), list: jest.fn(), delete: jest.fn() },
  };

  const mockConn = {
    jetstream: jest.fn().mockReturnValue(mockJetStream),
    jetstreamManager: jest.fn().mockReturnValue(mockJetStreamManager),
    publish: jest.fn(),
    subscribe: jest.fn().mockReturnValue({
      drain: jest.fn().mockResolvedValue(undefined),
      [Symbol.asyncIterator]: jest.fn(),
    }),
    closed: jest.fn().mockReturnValue(new Promise(() => {})),
    isClosed: jest.fn().mockReturnValue(false),
    drain: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { mockConn, mockJetStream, mockJetStreamManager };
}

// Helper to create mock repositories
function createMockRepos() {
  return {
    configRepo: {
      upsert: jest.fn().mockResolvedValue({ id: 'cfg-1' }),
      findByKey: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    } as any,
    subscriptionRepo: {
      insert: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      updateStatus: jest.fn().mockResolvedValue({}),
      findByTenant: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
    } as any,
    eventRepo: {
      insert: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      updateStatus: jest.fn().mockResolvedValue({}),
      findByType: jest.fn().mockResolvedValue([]),
      findByStatus: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
      countByStatus: jest.fn().mockResolvedValue(0),
      findPendingFallbackEvents: jest.fn().mockResolvedValue([]),
      incrementRetryCount: jest.fn().mockResolvedValue({ id: 'evt-1', retryCount: 1 }),
    } as any,
  };
}

// Helper to connect a bus with mock NATS
async function connectBus(bus: EventBusService) {
  const { mockConn } = createMockNatsConnection();
  const nats = require('nats');
  nats.connect.mockResolvedValue(mockConn);
  await bus.connect();
  return mockConn;
}

describe('EventBusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore nats.connect to a fresh mock function
    const nats = require('nats');
    nats.connect = jest.fn();
  });

  // =========================================================================
  // Constructor & Initialization
  // =========================================================================
  describe('constructor', () => {
    it('should default to enabled with disconnected state', () => {
      const bus = new EventBusService({});
      const status = bus.getConnectionStatus();
      expect(status.state).toBe('disconnected');
      expect(status.natsAvailable).toBe(false);
    });

    it('should set disabled state when enabled=false', () => {
      const bus = new EventBusService({ enabled: false });
      const status = bus.getConnectionStatus();
      expect(status.state).toBe('disabled');
    });

    it('should accept custom repositories', () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      expect(bus.getRepositories()).toBe(repos);
    });

    it('should extend EventEmitter', () => {
      const bus = new EventBusService({});
      expect(bus).toBeInstanceOf(EventEmitter);
    });

    it('should accept all config options', () => {
      const bus = new EventBusService({
        servers: ['nats://host1:4222', 'nats://host2:4222'],
        user: 'admin',
        pass: 'secret',
        token: 'my-token',
        timeout: 5000,
        reconnect: { enabled: true, maxRetries: 10, interval: 1000 },
        logging: { level: 'debug' },
        retry: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 5000, multiplier: 2 },
        enabled: true,
        autoConnect: false,
      });
      const cfg = bus.getConfig();
      expect(cfg.servers).toEqual(['nats://host1:4222', 'nats://host2:4222']);
      expect(cfg.enabled).toBe(true);
    });

    it('should enable by default when enabled not specified', () => {
      const bus = new EventBusService({});
      expect(bus.getConfig().enabled).toBe(true);
    });
  });

  // =========================================================================
  // Connection Status & Health
  // =========================================================================
  describe('getConnectionStatus', () => {
    it('should report disconnected initially', () => {
      const bus = new EventBusService({});
      const status = bus.getConnectionStatus();
      expect(status.state).toBe('disconnected');
      expect(status.message).toBe('Not connected to NATS');
      expect(status.natsAvailable).toBe(false);
      expect(status.reconnectAttempts).toBe(0);
      expect(status.lastError).toBeUndefined();
    });

    it('should report disabled state', () => {
      const bus = new EventBusService({ enabled: false });
      const status = bus.getConnectionStatus();
      expect(status.state).toBe('disabled');
      expect(status.message).toBe('EventBus disabled by config');
    });

    it('should report fallback state with last error', () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';
      (bus as any).lastError = 'Connection refused';
      const status = bus.getConnectionStatus();
      expect(status.state).toBe('fallback');
      expect(status.lastError).toBe('Connection refused');
    });

    it('should report connected state with nats available', async () => {
      const bus = new EventBusService({});
      await connectBus(bus);
      const status = bus.getConnectionStatus();
      expect(status.state).toBe('connected');
      expect(status.natsAvailable).toBe(true);
      expect(status.reconnectAttempts).toBe(0);
      expect(status.lastError).toBeUndefined();
    });
  });

  describe('checkHealth', () => {
    it('should return up for disabled state', async () => {
      const bus = new EventBusService({ enabled: false });
      const health = await bus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.state).toBe('disabled');
      expect(health.message).toBe('EventBus disabled');
    });

    it('should return up for fallback state', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';
      const health = await bus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.state).toBe('fallback');
    });

    it('should return down when no natsConnection', async () => {
      const bus = new EventBusService({});
      const health = await bus.checkHealth();
      expect(health.status).toBe('down');
      expect(health.state).toBe('disconnected');
      expect(health.message).toBe('Not connected');
    });

    it('should return down when connection is closed', async () => {
      const bus = new EventBusService({});
      (bus as any).connectionState = 'connected';
      (bus as any).natsConnection = { isClosed: jest.fn().mockReturnValue(true) };
      const health = await bus.checkHealth();
      expect(health.status).toBe('down');
      expect(health.message).toBe('Connection closed');
    });

    it('should return up when connected and not closed', async () => {
      const bus = new EventBusService({});
      await connectBus(bus);
      const health = await bus.checkHealth();
      expect(health.status).toBe('up');
      expect(health.message).toBe('Connected to NATS');
      expect(health.state).toBe('connected');
    });
  });

  describe('isHealthy / isConnected / isFallback', () => {
    it('isHealthy should return true for disabled', () => {
      const bus = new EventBusService({ enabled: false });
      expect(bus.isHealthy()).toBe(true);
    });

    it('isHealthy should return true for connected', () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'connected';
      expect(bus.isHealthy()).toBe(true);
    });

    it('isHealthy should return true for fallback', () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';
      expect(bus.isHealthy()).toBe(true);
    });

    it('isHealthy should return false for disconnected', () => {
      const bus = new EventBusService({});
      expect(bus.isHealthy()).toBe(false);
    });

    it('isConnected should return true only for connected', () => {
      const bus = new EventBusService({});
      expect(bus.isConnected()).toBe(false);
      (bus as any).connectionState = 'connected';
      expect(bus.isConnected()).toBe(true);
      (bus as any).connectionState = 'fallback';
      expect(bus.isConnected()).toBe(false);
    });

    it('isFallback should return true only for fallback', () => {
      const bus = new EventBusService({});
      expect(bus.isFallback()).toBe(false);
      (bus as any).connectionState = 'fallback';
      expect(bus.isFallback()).toBe(true);
      (bus as any).connectionState = 'connected';
      expect(bus.isFallback()).toBe(false);
    });
  });

  // =========================================================================
  // Metrics
  // =========================================================================
  describe('metrics', () => {
    it('should return initial zero metrics', () => {
      const bus = new EventBusService({});
      const metrics = bus.getMetrics();
      expect(metrics).toEqual({
        publishSuccess: 0,
        publishFailed: 0,
        subscribeSuccess: 0,
        subscribeFailed: 0,
      });
    });

    it('should reset metrics to zero', () => {
      const bus = new EventBusService({});
      (bus as any).metrics = {
        publishSuccess: 10,
        publishFailed: 2,
        subscribeSuccess: 5,
        subscribeFailed: 1,
      };
      bus.resetMetrics();
      const metrics = bus.getMetrics();
      expect(metrics.publishSuccess).toBe(0);
      expect(metrics.publishFailed).toBe(0);
      expect(metrics.subscribeSuccess).toBe(0);
      expect(metrics.subscribeFailed).toBe(0);
    });

    it('should return a copy of metrics (not a reference)', () => {
      const bus = new EventBusService({});
      const m1 = bus.getMetrics();
      const m2 = bus.getMetrics();
      expect(m1).not.toBe(m2);
      expect(m1).toEqual(m2);
    });
  });

  // =========================================================================
  // Repositories
  // =========================================================================
  describe('setRepositories / getRepositories', () => {
    it('should set and get repositories', () => {
      const bus = new EventBusService({});
      const repos = createMockRepos();
      bus.setRepositories(repos);
      // setRepositories spreads into a new object, so use toStrictEqual
      expect(bus.getRepositories()).toStrictEqual(repos);
    });

    it('should merge repositories on setRepositories', () => {
      const bus = new EventBusService({});
      const repos1 = { eventRepo: { insert: jest.fn() } as any };
      const repos2 = { subscriptionRepo: { insert: jest.fn() } as any };
      bus.setRepositories(repos1);
      bus.setRepositories(repos2);
      const result = bus.getRepositories();
      expect(result.eventRepo).toBeDefined();
      expect(result.subscriptionRepo).toBeDefined();
    });

    it('should start with empty repos by default', () => {
      const bus = new EventBusService({});
      const repos = bus.getRepositories();
      expect(repos.configRepo).toBeUndefined();
      expect(repos.subscriptionRepo).toBeUndefined();
      expect(repos.eventRepo).toBeUndefined();
    });
  });

  // =========================================================================
  // getConfig
  // =========================================================================
  describe('getConfig', () => {
    it('should return config with empty servers by default', () => {
      const bus = new EventBusService({});
      const cfg = bus.getConfig();
      expect(cfg.servers).toEqual([]);
      expect(cfg.enabled).toBe(true);
    });

    it('should return configured servers', () => {
      const bus = new EventBusService({ servers: ['nats://a:4222', 'nats://b:4222'] });
      const cfg = bus.getConfig();
      expect(cfg.servers).toEqual(['nats://a:4222', 'nats://b:4222']);
    });

    it('should report enabled=true by default', () => {
      const bus = new EventBusService({});
      expect(bus.getConfig().enabled).toBe(true);
    });

    it('should report enabled=false when disabled', () => {
      const bus = new EventBusService({ enabled: false });
      expect(bus.getConfig().enabled).toBe(false);
    });
  });

  // =========================================================================
  // connect()
  // =========================================================================
  describe('connect', () => {
    it('should skip connection when disabled', async () => {
      const bus = new EventBusService({ enabled: false });
      const fallbackSpy = jest.fn();
      bus.on('fallback', fallbackSpy);
      await bus.connect();
      expect(bus.getConnectionStatus().state).toBe('disabled');
      expect(fallbackSpy).not.toHaveBeenCalled();
    });

    it('should connect successfully and set state to connected', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      const connectSpy = jest.fn();
      bus.on('connect', connectSpy);

      await connectBus(bus);

      expect(bus.getConnectionStatus().state).toBe('connected');
      expect(bus.isConnected()).toBe(true);
      expect(bus.isJetStreamAvailable()).toBe(true);
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should enter fallback when connect throws', async () => {
      const nats = require('nats');
      nats.connect.mockRejectedValue(new Error('Connection refused'));

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      const errorSpy = jest.fn();
      const fallbackSpy = jest.fn();
      bus.on('error', errorSpy);
      bus.on('fallback', fallbackSpy);

      await bus.connect();

      expect(bus.getConnectionStatus().state).toBe('fallback');
      expect(bus.getConnectionStatus().lastError).toBe('Connection refused');
      expect(errorSpy).toHaveBeenCalled();
      expect(fallbackSpy).toHaveBeenCalledWith({ reason: 'connection_failed', error: 'Connection refused' });
    });

    it('should persist config when configRepo available', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false, servers: ['nats://myhost:4222'] }, repos);
      await connectBus(bus);

      expect(repos.configRepo.upsert).toHaveBeenCalledWith(
        'nats_connection',
        { servers: ['nats://myhost:4222'], enabled: true },
        'NATS connection configuration',
      );
    });

    it('should pass all config options to NATS connect', async () => {
      const nats = require('nats');
      const { mockConn } = createMockNatsConnection();
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({
        enabled: true,
        autoConnect: false,
        servers: ['nats://custom:4222'],
        user: 'myuser',
        pass: 'mypass',
        token: 'mytoken',
        timeout: 5000,
        reconnect: { enabled: true, maxRetries: 10, interval: 1000 },
      });

      await bus.connect();

      expect(nats.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: ['nats://custom:4222'],
          user: 'myuser',
          pass: 'mypass',
          token: 'mytoken',
          timeout: 5000,
          reconnect: true,
          maxReconnectAttempts: 10,
          reconnectTimeWait: 1000,
        }),
      );
    });

    it('should use default servers when none configured', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await connectBus(bus);
      const nats = require('nats');
      expect(nats.connect).toHaveBeenCalledWith(
        expect.objectContaining({ servers: ['nats://localhost:4222'] }),
      );
    });

    it('should use default reconnect config when not specified', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await connectBus(bus);
      const nats = require('nats');
      expect(nats.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          reconnect: true,
          maxReconnectAttempts: -1,
          reconnectTimeWait: 2000,
        }),
      );
    });

    it('should handle non-Error thrown in connect', async () => {
      const nats = require('nats');
      nats.connect.mockRejectedValue('string error');

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      // Add error listener to prevent unhandled error from EventEmitter
      bus.on('error', () => {});
      await bus.connect();

      expect(bus.getConnectionStatus().state).toBe('fallback');
      expect(bus.getConnectionStatus().lastError).toBe('Unknown error');
    });

    it('should reset reconnectAttempts on successful connect', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      (bus as any).reconnectAttempts = 5;
      await connectBus(bus);
      expect(bus.getConnectionStatus().reconnectAttempts).toBe(0);
    });
  });

  // =========================================================================
  // publish()
  // =========================================================================
  describe('publish', () => {
    it('should publish via JetStream when connected', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const eventId = await bus.publish('test.event', { key: 'value' });

      expect(repos.eventRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'test.event',
          status: 'pending_published',
        }),
      );
      expect(mockJetStream.publish).toHaveBeenCalled();
      expect(repos.eventRepo.updateStatus).toHaveBeenCalledWith('evt-1', 'delivered');
      expect(bus.getMetrics().publishSuccess).toBe(1);
    });

    it('should publish via core NATS when JetStream unavailable', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.jetstream.mockReturnValue(null);
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const eventId = await bus.publish('test.event', { key: 'value' });

      expect(mockConn.publish).toHaveBeenCalled();
      expect(repos.eventRepo.updateStatus).toHaveBeenCalledWith('evt-1', 'delivered');
      expect(bus.getMetrics().publishSuccess).toBe(1);
    });

    it('should deliver to fallback subscribers when not connected', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: false }, repos);

      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('test.event', [handler]);

      const eventId = await bus.publish('test.event', { data: 'test' });

      expect(eventId).toMatch(/^fallback:/);
      expect(handler).toHaveBeenCalled();
      expect(bus.getMetrics().publishSuccess).toBe(1);
    });

    it('should use custom subject when provided', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.jetstream.mockReturnValue(null);
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await bus.publish('test.event', {}, { subject: 'custom.subject' });

      expect(repos.eventRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'custom.subject' }),
      );
    });

    it('should use event type as subject by default', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.jetstream.mockReturnValue(null);
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await bus.publish('orion.pipeline.run.created', {});

      expect(repos.eventRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'orion.pipeline.run.created' }),
      );
    });

    it('should include tenantId and publishedBy in event record', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.jetstream.mockReturnValue(null);
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await bus.publish('test.event', {}, { tenantId: 'tenant-abc', publishedBy: 'user-1' });

      expect(repos.eventRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-abc',
          published_by: 'user-1',
        }),
      );
    });

    it('should handle eventRepo insert failure gracefully', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.insert = jest.fn().mockRejectedValue(new Error('DB error'));
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const eventId = await bus.publish('test.event', {});
      expect(eventId).toBe('test.event');
      expect(mockJetStream.publish).toHaveBeenCalled();
    });

    it('should throw when NATS publish fails', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      mockJetStream.publish.mockRejectedValue(new Error('NATS error'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await expect(bus.publish('test.event', {})).rejects.toThrow('NATS error');
      expect(bus.getMetrics().publishFailed).toBe(1);
    });

    it('should return fallback:evt-id when persisting in fallback mode', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: false }, repos);

      const eventId = await bus.publish('test.event', {});
      expect(eventId).toBe('fallback:evt-1');
    });

    it('should return fallback envelope id when no repos and not connected', async () => {
      const bus = new EventBusService({ enabled: false });

      const eventId = await bus.publish('test.event', {});
      expect(eventId).toMatch(/^fallback:evt-/);
    });

    it('should deliver to fallback subscribers even when connected', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('test.event', [handler]);

      await bus.publish('test.event', { data: 'test' });

      expect(mockJetStream.publish).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it('should emit fallback_publish when persisting in fallback mode', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: false }, repos);
      const spy = jest.fn();
      bus.on('fallback_publish', spy);

      await bus.publish('test.event', {});

      expect(spy).toHaveBeenCalledWith({ eventId: 'evt-1', type: 'test.event', subject: 'test.event' });
    });

    it('should build CloudEvents envelope with correct fields', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      await bus.publish('test.event', { foo: 'bar' });

      const publishCall = mockJetStream.publish.mock.calls[0];
      const payload = JSON.parse(new TextDecoder().decode(publishCall[1]));
      expect(payload.specversion).toBe('1.0');
      expect(payload.type).toBe('test.event');
      expect(payload.datacontenttype).toBe('application/json');
      expect(payload.data).toEqual({ foo: 'bar' });
      expect(payload.source).toBe('orion-platform-service');
      expect(payload.id).toMatch(/^evt-/);
      expect(payload.time).toBeDefined();
    });
  });

  // =========================================================================
  // subscribe()
  // =========================================================================
  describe('subscribe', () => {
    it('should throw EventBusError when disabled', async () => {
      const bus = new EventBusService({ enabled: false });
      await expect(bus.subscribe('test.event', async () => {})).rejects.toThrow(EventBusError);
      await expect(bus.subscribe('test.event', async () => {})).rejects.toThrow('EventBus disabled, cannot subscribe');
    });

    it('should register in-memory fallback subscriber when in fallback mode', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      const unsub = await bus.subscribe('test.event', handler);

      expect(typeof unsub).toBe('function');
      expect(bus.getMetrics().subscribeSuccess).toBe(1);
    });

    it('should deliver events to fallback subscribers via publish', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      await bus.subscribe('test.event', handler);

      await bus.publish('test.event', { value: 42 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test.event',
          data: { value: 42 },
          specversion: '1.0',
        }),
      );
    });

    it('should unsubscribe from fallback handler', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      const unsub = await bus.subscribe('test.event', handler);

      await unsub();

      handler.mockClear();
      await bus.publish('test.event', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should use filterSubject for fallback registration', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      await bus.subscribe('test.event', handler, { filterSubject: 'custom.pattern' });

      const subs = (bus as any).fallbackSubscribers as Map<string, any[]>;
      expect(subs.has('custom.pattern')).toBe(true);
    });

    it('should persist subscription when subscriptionRepo available and connected', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await bus.subscribe('test.event', async () => {}, { durableName: 'my-consumer', tenantId: 't1' });

      expect(repos.subscriptionRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 't1',
          subject_pattern: 'test.event',
          handler_name: 'test.event',
          durable_name: 'my-consumer',
          status: 'active',
        }),
      );
    });

    it('should handle subscriptionRepo insert failure gracefully', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.subscriptionRepo.insert = jest.fn().mockRejectedValue(new Error('DB error'));
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const unsub = await bus.subscribe('test.event', async () => {});
      expect(typeof unsub).toBe('function');
    });

    it('should subscribe via JetStream when streamName and durableName provided', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      const unsub = await bus.subscribe('test.event', async () => {}, {
        streamName: 'ORION_PLATFORM',
        durableName: 'test-consumer',
      });

      expect(mockJetStream.consumers.get).toHaveBeenCalledWith('ORION_PLATFORM', 'test-consumer');
      expect(typeof unsub).toBe('function');
    });

    it('should subscribe via Core NATS when no streamName/durableName', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      const unsub = await bus.subscribe('test.event', async () => {});

      expect(mockConn.subscribe).toHaveBeenCalledWith('test.event', { queue: 'orion-platform-queue' });
      expect(typeof unsub).toBe('function');
    });

    it('should use custom queue group from durableName', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      await bus.subscribe('test.event', async () => {}, { durableName: 'custom-queue' });

      expect(mockConn.subscribe).toHaveBeenCalledWith('test.event', { queue: 'custom-queue' });
    });

    it('should emit subscribe event on fallback success', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';
      const spy = jest.fn();
      bus.on('subscribe', spy);

      await bus.subscribe('test.event', async () => {});

      expect(spy).toHaveBeenCalledWith({ eventType: 'test.event', mode: 'in-memory-fallback' });
    });

    it('should throw when natsConnection.subscribe fails', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.subscribe.mockImplementation(() => { throw new Error('Subscribe error'); });
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      // subscribeViaCoreNats is async and subscribe returns it without await,
      // so the error propagates as a plain Error (not EventBusError)
      await expect(bus.subscribe('test.event', async () => {})).rejects.toThrow('Subscribe error');
    });

    it('should wrap validation errors in EventBusError', async () => {
      const bus = new EventBusService({ enabled: false });
      // Subscribing when disabled throws EventBusError
      await expect(bus.subscribe('test.event', async () => {})).rejects.toThrow(EventBusError);
      await expect(bus.subscribe('test.event', async () => {})).rejects.toMatchObject({
        code: 'DISABLED',
        recoverable: false,
      });
    });
  });

  // =========================================================================
  // close()
  // =========================================================================
  describe('close', () => {
    it('should clear all state on close', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      const mockConn = await connectBus(bus);
      expect(bus.isConnected()).toBe(true);

      const closeSpy = jest.fn();
      bus.on('close', closeSpy);

      await bus.close();

      expect(bus.getConnectionStatus().state).toBe('disconnected');
      expect(bus.getNatsConnection()).toBeNull();
      expect(mockConn.drain).toHaveBeenCalled();
      expect(mockConn.close).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle close when no connection exists', async () => {
      const bus = new EventBusService({ enabled: false });
      await bus.close();
      expect(bus.getConnectionStatus().state).toBe('disabled');
    });

    it('should handle drain/close errors gracefully', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.drain.mockRejectedValue(new Error('Drain failed'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      await bus.close();
      expect(bus.getConnectionStatus().state).toBe('disconnected');
    });

    it('should clear fallback subscribers on close', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';
      await bus.subscribe('test.event', async () => {});

      await bus.close();

      const subs = (bus as any).fallbackSubscribers as Map<string, any[]>;
      expect(subs.size).toBe(0);
    });

    it('should null out jetStream and jetStreamManager on close', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await connectBus(bus);
      expect(bus.isJetStreamAvailable()).toBe(true);

      await bus.close();
      expect(bus.isJetStreamAvailable()).toBe(false);
      expect(bus.getJetStreamClient()).toBeNull();
      expect(bus.getJetStreamManager()).toBeNull();
    });
  });

  // =========================================================================
  // getNatsConnection
  // =========================================================================
  describe('getNatsConnection', () => {
    it('should return null when not connected', () => {
      const bus = new EventBusService({});
      expect(bus.getNatsConnection()).toBeNull();
    });

    it('should return the NATS connection when connected', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      const mockConn = await connectBus(bus);
      expect(bus.getNatsConnection()).toBe(mockConn);
    });
  });

  // =========================================================================
  // EventBusError
  // =========================================================================
  describe('EventBusError', () => {
    it('should create error with code and recoverable flag', () => {
      const err = new EventBusError('test error', 'TEST_CODE', true);
      expect(err.message).toBe('test error');
      expect(err.code).toBe('TEST_CODE');
      expect(err.recoverable).toBe(true);
      expect(err.name).toBe('EventBusError');
      expect(err).toBeInstanceOf(Error);
    });

    it('should default recoverable to true', () => {
      const err = new EventBusError('test', 'CODE');
      expect(err.recoverable).toBe(true);
    });

    it('should allow setting recoverable to false', () => {
      const err = new EventBusError('test', 'CODE', false);
      expect(err.recoverable).toBe(false);
    });
  });

  // =========================================================================
  // Fallback subscriber matching (subjectMatches)
  // =========================================================================
  describe('subject matching', () => {
    it('should match exact subjects', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      await bus.subscribe('exact.subject', handler);

      await bus.publish('exact.subject', {});
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      await bus.publish('other.subject', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should match wildcard * pattern (single token)', () => {
      const bus = new EventBusService({ enabled: false });
      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('orion.pipeline.*', [handler]);

      (bus as any).deliverToFallbackSubscribers('orion.pipeline.created', {
        id: 'test',
        type: 'orion.pipeline.created',
        data: {},
      });
      expect(handler).toHaveBeenCalled();
    });

    it('should match > wildcard pattern (multi-token)', () => {
      const bus = new EventBusService({ enabled: false });
      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('orion.>', [handler]);

      (bus as any).deliverToFallbackSubscribers('orion.pipeline.run.created', {
        id: 'test',
        type: 'orion.pipeline.run.created',
        data: {},
      });
      expect(handler).toHaveBeenCalled();
    });

    it('should not match mismatched patterns', () => {
      const bus = new EventBusService({ enabled: false });
      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('orion.pipeline.*', [handler]);

      (bus as any).deliverToFallbackSubscribers('orion.deploy.started', {
        id: 'test',
        type: 'orion.deploy.started',
        data: {},
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not match when * wildcard has different token count', () => {
      const bus = new EventBusService({ enabled: false });
      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('orion.pipeline.*', [handler]);

      // 'orion.pipeline.run.created' has 4 tokens, pattern has 3
      (bus as any).deliverToFallbackSubscribers('orion.pipeline.run.created', {
        id: 'test',
        type: 'orion.pipeline.run.created',
        data: {},
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should match > at the start of remaining tokens', () => {
      const bus = new EventBusService({ enabled: false });
      const handler = jest.fn().mockResolvedValue(undefined);
      (bus as any).fallbackSubscribers.set('test.>', [handler]);

      // Should match 'test.a.b.c'
      (bus as any).deliverToFallbackSubscribers('test.a.b.c', {
        id: 'test',
        type: 'test.a.b.c',
        data: {},
      });
      expect(handler).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // JetStream-specific methods
  // =========================================================================
  describe('JetStream methods', () => {
    it('isJetStreamAvailable should return false when not connected', () => {
      const bus = new EventBusService({});
      expect(bus.isJetStreamAvailable()).toBe(false);
    });

    it('isJetStreamAvailable should return true when connected with jetstream', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await connectBus(bus);
      expect(bus.isJetStreamAvailable()).toBe(true);
    });

    it('isJetStreamAvailable should return false when jetstream is null', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.jetstream.mockReturnValue(null);
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();
      expect(bus.isJetStreamAvailable()).toBe(false);
    });

    it('getJetStreamClient should return null when not connected', () => {
      const bus = new EventBusService({});
      expect(bus.getJetStreamClient()).toBeNull();
    });

    it('getJetStreamClient should return client when connected', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await connectBus(bus);
      expect(bus.getJetStreamClient()).not.toBeNull();
    });

    it('getJetStreamManager should return null when not connected', () => {
      const bus = new EventBusService({});
      expect(bus.getJetStreamManager()).toBeNull();
    });

    it('getJetStreamManager should return manager when connected', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await connectBus(bus);
      expect(bus.getJetStreamManager()).not.toBeNull();
    });

    it('ensureStream should be a no-op when no jetStreamManager', async () => {
      const bus = new EventBusService({});
      await bus.ensureStream({ name: 'TEST', subjects: ['test.*'] });
    });

    it('ensureConsumer should be a no-op when no jetStreamManager', async () => {
      const bus = new EventBusService({});
      await bus.ensureConsumer('TEST', { name: 'consumer-1' });
    });

    it('getJetStreamMetrics should return unavailable when no jetStreamManager', async () => {
      const bus = new EventBusService({});
      const metrics = await bus.getJetStreamMetrics();
      expect(metrics).toEqual({ available: false });
    });

    it('listConsumers should return empty array when no jetStreamManager', async () => {
      const bus = new EventBusService({});
      const result = await bus.listConsumers('TEST');
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Repository query methods
  // =========================================================================
  describe('getEventHistory', () => {
    it('should throw when no eventRepo', async () => {
      const bus = new EventBusService({});
      await expect(bus.getEventHistory()).rejects.toThrow('Event repository not available');
    });

    it('should call findByType when eventType provided', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await bus.getEventHistory({ eventType: 'test.event', limit: 10 });
      expect(repos.eventRepo.findByType).toHaveBeenCalledWith('test.event', { limit: 10 });
    });

    it('should call findByStatus when status provided', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await bus.getEventHistory({ status: 'failed' });
      expect(repos.eventRepo.findByStatus).toHaveBeenCalledWith('failed', { limit: undefined });
    });

    it('should call findAll by default', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await bus.getEventHistory();
      expect(repos.eventRepo.findAll).toHaveBeenCalledWith({ limit: 50 });
    });

    it('should use custom limit', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await bus.getEventHistory({ limit: 100 });
      expect(repos.eventRepo.findAll).toHaveBeenCalledWith({ limit: 100 });
    });
  });

  describe('getSubscriptions', () => {
    it('should throw when no subscriptionRepo', async () => {
      const bus = new EventBusService({});
      await expect(bus.getSubscriptions()).rejects.toThrow('Subscription repository not available');
    });

    it('should call findByTenant when tenantId provided', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await bus.getSubscriptions('tenant-1');
      expect(repos.subscriptionRepo.findByTenant).toHaveBeenCalledWith('tenant-1');
    });

    it('should call findAll when no tenantId', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await bus.getSubscriptions();
      expect(repos.subscriptionRepo.findAll).toHaveBeenCalledWith({ limit: 50 });
    });
  });

  describe('getEventStats', () => {
    it('should throw when no eventRepo', async () => {
      const bus = new EventBusService({});
      await expect(bus.getEventStats()).rejects.toThrow('Event repository not available');
    });

    it('should return stats for all statuses', async () => {
      const repos = createMockRepos();
      repos.eventRepo.countByStatus = jest.fn()
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);

      const bus = new EventBusService({}, repos);
      const stats = await bus.getEventStats();

      expect(stats).toEqual({
        published: 10,
        pendingFallback: 2,
        delivered: 50,
        failed: 3,
        deadLetter: 1,
      });
    });
  });

  // =========================================================================
  // retryPendingEvents
  // =========================================================================
  describe('retryPendingEvents', () => {
    it('should throw when no eventRepo', async () => {
      const bus = new EventBusService({ enabled: true, autoConnect: false });
      (bus as any).connectionState = 'connected';
      (bus as any).natsConnection = {};
      await expect(bus.retryPendingEvents()).rejects.toThrow('Event repository not available');
    });

    it('should throw when not connected', async () => {
      const repos = createMockRepos();
      const bus = new EventBusService({}, repos);
      await expect(bus.retryPendingEvents()).rejects.toThrow(EventBusError);
    });

    it('should return zeros when no pending events', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([]);
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const result = await bus.retryPendingEvents();
      expect(result).toEqual({ retried: 0, succeeded: 0, failed: 0 });
    });

    it('should retry pending events successfully', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      // connect() also calls retryPendingEvents if eventRepo exists, so
      // start with empty pending events during connect
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([]);

      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      // Now set up pending events for the explicit retryPendingEvents call
      const pendingEvents = [
        { id: 'evt-1', eventType: 'test.event', subject: 'test.event', source: 'test', payload: { data: {} } },
        { id: 'evt-2', eventType: 'test.event2', subject: 'test.event2', source: 'test', payload: { data: {} } },
      ];
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue(pendingEvents);
      mockConn.publish.mockClear();

      const result = await bus.retryPendingEvents();

      expect(result.retried).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockConn.publish).toHaveBeenCalledTimes(2);
    });

    it('should call onProgress callback for successful events', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([
        { id: 'evt-1', eventType: 't', subject: 't', source: 's', payload: { data: {} } },
      ]);

      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const onProgress = jest.fn();
      await bus.retryPendingEvents({ onProgress });

      expect(onProgress).toHaveBeenCalledWith('evt-1', true);
    });

    it('should call onProgress callback for failed events', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.publish.mockRejectedValue(new Error('Publish failed'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([
        { id: 'evt-1', eventType: 't', subject: 't', source: 's', payload: { data: {} } },
      ]);
      repos.eventRepo.incrementRetryCount = jest.fn().mockResolvedValue({ id: 'evt-1', retryCount: 1 });

      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const onProgress = jest.fn();
      await bus.retryPendingEvents({ onProgress, maxRetryCount: 3 });

      expect(onProgress).toHaveBeenCalledWith('evt-1', false);
    });

    it('should mark as dead_letter when max retries exceeded', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.publish.mockRejectedValue(new Error('Publish failed'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([
        { id: 'evt-1', eventType: 't', subject: 't', source: 's', payload: { data: {} } },
      ]);
      repos.eventRepo.incrementRetryCount = jest.fn().mockResolvedValue({ id: 'evt-1', retryCount: 3 });

      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      const result = await bus.retryPendingEvents({ maxRetryCount: 3 });

      expect(result.failed).toBe(1);
      expect(repos.eventRepo.updateStatus).toHaveBeenCalledWith('evt-1', 'dead_letter');
    });

    it('should not mark as dead_letter if retries not exceeded', async () => {
      const { mockConn } = createMockNatsConnection();
      mockConn.publish.mockRejectedValue(new Error('Publish failed'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([
        { id: 'evt-1', eventType: 't', subject: 't', source: 's', payload: { data: {} } },
      ]);
      repos.eventRepo.incrementRetryCount = jest.fn().mockResolvedValue({ id: 'evt-1', retryCount: 1 });

      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await bus.retryPendingEvents({ maxRetryCount: 3 });

      expect(repos.eventRepo.updateStatus).not.toHaveBeenCalledWith('evt-1', 'dead_letter');
    });

    it('should use default limit and maxRetryCount', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.eventRepo.findPendingFallbackEvents = jest.fn().mockResolvedValue([]);
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);
      await bus.connect();

      await bus.retryPendingEvents();

      expect(repos.eventRepo.findPendingFallbackEvents).toHaveBeenCalledWith(100, 3);
    });
  });

  // =========================================================================
  // createStream
  // =========================================================================
  describe('createStream', () => {
    it('should skip when no natsConnection', async () => {
      const bus = new EventBusService({});
      await bus.createStream('TEST_STREAM', ['test.*']);
    });

    it('should create stream via jetstream', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      await bus.createStream('TEST_STREAM', ['test.*'], { replicas: 3, storage: 'memory' });

      expect(mockJetStream.streams.add).toHaveBeenCalledWith({
        name: 'TEST_STREAM',
        subjects: ['test.*'],
        replicas: 3,
        storage: 0,
      });
    });

    it('should use default replicas=1 and file storage', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();

      await bus.createStream('TEST_STREAM', ['test.*']);

      expect(mockJetStream.streams.add).toHaveBeenCalledWith({
        name: 'TEST_STREAM',
        subjects: ['test.*'],
        replicas: 1,
        storage: 1,
      });
    });

    it('should handle "already in use" error gracefully', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      mockJetStream.streams.add.mockRejectedValue(new Error('stream already in use'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();
      await bus.createStream('TEST_STREAM', ['test.*']);
    });

    it('should handle other stream creation errors gracefully', async () => {
      const { mockConn, mockJetStream } = createMockNatsConnection();
      mockJetStream.streams.add.mockRejectedValue(new Error('Unknown error'));
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const bus = new EventBusService({ enabled: true, autoConnect: false });
      await bus.connect();
      await bus.createStream('TEST_STREAM', ['test.*']);
    });
  });

  // =========================================================================
  // Edge cases & error handling
  // =========================================================================
  describe('edge cases', () => {
    it('should handle multiple fallback subscribers for same subject', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      await bus.subscribe('test.event', handler1);
      await bus.subscribe('test.event', handler2);

      await bus.publish('test.event', {});

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle fallback handler that throws without propagating', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      await bus.subscribe('test.event', handler);

      await bus.publish('test.event', {});
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should unsubscribe only the correct handler', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      const unsub1 = await bus.subscribe('test.event', handler1);
      await bus.subscribe('test.event', handler2);

      await unsub1();

      handler1.mockClear();
      handler2.mockClear();
      await bus.publish('test.event', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should clean up empty handler arrays on unsubscribe', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      const unsub = await bus.subscribe('test.event', handler);
      await unsub();

      const subs = (bus as any).fallbackSubscribers as Map<string, any[]>;
      expect(subs.has('test.event')).toBe(false);
    });

    it('should handle unsubscribe of already-removed handler gracefully', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      const unsub = await bus.subscribe('test.event', handler);
      await unsub();
      await unsub();
    });

    it('should handle unsubscribe when subject has no handlers', async () => {
      const bus = new EventBusService({ enabled: false });
      (bus as any).connectionState = 'fallback';

      const handler = jest.fn().mockResolvedValue(undefined);
      const unsub = await bus.subscribe('test.event', handler);

      // Manually clear the fallbackSubscribers map
      (bus as any).fallbackSubscribers.clear();

      // Unsubscribing should not throw
      await unsub();
    });

    it('should handle persistConfig failure gracefully', async () => {
      const { mockConn } = createMockNatsConnection();
      const nats = require('nats');
      nats.connect.mockResolvedValue(mockConn);

      const repos = createMockRepos();
      repos.configRepo.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
      const bus = new EventBusService({ enabled: true, autoConnect: false }, repos);

      // Should not throw
      await bus.connect();
      expect(bus.isConnected()).toBe(true);
    });
  });
});
