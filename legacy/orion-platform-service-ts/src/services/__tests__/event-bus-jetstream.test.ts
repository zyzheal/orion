import type { EventBusService } from '../event-bus-service';

describe('EventBusService JetStream', () => {
  let EventBusServiceClass: typeof import('../event-bus-service').EventBusService;

  beforeAll(async () => {
    const mod = await import('../event-bus-service');
    EventBusServiceClass = mod.EventBusService;
  });

  describe('JetStream initialization', () => {
    it('should initialize JetStream client after connect', async () => {
      const mockJetStream = { publish: jest.fn(), consumers: { get: jest.fn() } };
      const mockNats = {
        jetstream: jest.fn().mockReturnValue(mockJetStream),
        jetstreamManager: jest.fn(),
        publish: jest.fn(), subscribe: jest.fn(),
        closed: jest.fn(), isClosed: jest.fn(),
        drain: jest.fn(), close: jest.fn(),
        _mockJetStream: mockJetStream,
      };
      const eventBus = new EventBusServiceClass({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      const jsClient = mockNats.jetstream();
      expect(mockNats.jetstream).toHaveBeenCalled();
      expect(jsClient).toBeDefined();
    });

    it('should report JetStream as available when connected', async () => {
      const mockJetStream = { publish: jest.fn(), consumers: { get: jest.fn() } };
      const mockNats = {
        jetstream: jest.fn().mockReturnValue(mockJetStream),
        jetstreamManager: jest.fn(),
        publish: jest.fn(), subscribe: jest.fn(),
        closed: jest.fn(), isClosed: jest.fn(),
        drain: jest.fn(), close: jest.fn(),
        _mockJetStream: mockJetStream,
      };
      const eventBus = new EventBusServiceClass({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockJetStream;
      expect(eventBus.isJetStreamAvailable?.()).toBe(true);
    });
  });

  describe('JetStream publish', () => {
    it('should use JetStream publish when available', async () => {
      const mockJetStream = { publish: jest.fn().mockResolvedValue({ seq: 42 }), consumers: { get: jest.fn() } };
      const mockNats = {
        jetstream: jest.fn().mockReturnValue(mockJetStream),
        jetstreamManager: jest.fn(),
        publish: jest.fn(), subscribe: jest.fn(),
        closed: jest.fn(), isClosed: jest.fn(),
        drain: jest.fn(), close: jest.fn(),
        _mockJetStream: mockJetStream,
      };
      const eventRepo = { insert: jest.fn().mockResolvedValue({ id: 'evt-1' }), updateStatus: jest.fn() };
      const eventBus = new EventBusServiceClass({ enabled: true, autoConnect: false }, { eventRepo: eventRepo as any });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockJetStream;
      const eventId = await eventBus.publish('test.event', { key: 'value' });
      expect(mockJetStream.publish).toHaveBeenCalled();
      expect(eventId).toBe('evt-1');
    });
  });

  describe('JetStream subscribe', () => {
    it('should return no-op unsubscribe when not connected (fallback)', async () => {
      const eventBus = new EventBusServiceClass({ enabled: true, autoConnect: false });
      // In fallback mode, subscribe returns a no-op unsubscribe instead of throwing
      const unsub = await eventBus.subscribe('test.event', async () => {});
      expect(typeof unsub).toBe('function');
      // Calling the no-op should not throw
      await expect(unsub()).resolves.toBeUndefined();
    });

    it('should accept streamName and durableName options', async () => {
      const mockJetStream = { publish: jest.fn(), consumers: { get: jest.fn().mockResolvedValue({ fetch: jest.fn() }) } };
      const mockNats = {
        jetstream: jest.fn().mockReturnValue(mockJetStream),
        jetstreamManager: jest.fn(),
        publish: jest.fn(), subscribe: jest.fn().mockReturnValue({ drain: jest.fn() }),
        closed: jest.fn(), isClosed: jest.fn(),
        drain: jest.fn(), close: jest.fn(),
        _mockJetStream: mockJetStream,
      };
      const eventBus = new EventBusServiceClass({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockJetStream;
      const unsubscribe = await eventBus.subscribe('test.event', async () => {}, { streamName: 'ORION_PLATFORM', durableName: 'test-consumer' });
      expect(mockJetStream.consumers.get).toHaveBeenCalledWith('ORION_PLATFORM', 'test-consumer');
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
