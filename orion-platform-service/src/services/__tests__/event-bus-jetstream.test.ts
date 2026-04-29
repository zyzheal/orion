import { EventBusService } from '../event-bus-service';

function createMockNatsConnection() {
  const mockJetStream = { publish: jest.fn().mockResolvedValue({ seq: 42 }), consumers: { get: jest.fn() } };
  const mockJetStreamManager = { streams: { info: jest.fn(), add: jest.fn() }, consumers: { info: jest.fn(), add: jest.fn(), list: jest.fn() } };
  return {
    jetstream: jest.fn().mockReturnValue(mockJetStream),
    jetstreamManager: jest.fn().mockReturnValue(mockJetStreamManager),
    publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn(),
    closed: jest.fn().mockResolvedValue(undefined), isClosed: jest.fn().mockReturnValue(false),
    drain: jest.fn().mockResolvedValue(undefined), close: jest.fn().mockResolvedValue(undefined),
    _mockJetStream: mockJetStream, _mockJetStreamManager: mockJetStreamManager,
  };
}

describe('EventBusService JetStream', () => {
  let eventBus: EventBusService;
  let mockNats: ReturnType<typeof createMockNatsConnection>;

  beforeEach(() => {
    mockNats = createMockNatsConnection();
  });

  describe('JetStream initialization', () => {
    it('should initialize JetStream client after connect', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      const jsClient = mockNats.jetstream();
      expect(mockNats.jetstream).toHaveBeenCalled();
      expect(jsClient).toBeDefined();
    });

    it('should report JetStream as available when connected', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockNats._mockJetStream;
      expect(eventBus.isJetStreamAvailable?.()).toBe(true);
    });
  });

  describe('JetStream publish', () => {
    it('should use JetStream publish when available', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false }, {
        eventRepo: { insert: jest.fn().mockResolvedValue({ id: 'evt-1' }), updateStatus: jest.fn().mockResolvedValue(undefined) } as any,
      });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockNats._mockJetStream;
      const eventId = await eventBus.publish('test.event', { key: 'value' });
      expect(mockNats._mockJetStream.publish).toHaveBeenCalled();
      expect(eventId).toBe('evt-1');
    });
  });

  describe('JetStream subscribe', () => {
    it('should throw EventBusError when not connected', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });
      await expect(eventBus.subscribe('test.event', async () => {})).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    });

    it('should accept streamName and durableName options', async () => {
      eventBus = new EventBusService({ enabled: true, autoConnect: false });
      (eventBus as any).natsConnection = mockNats;
      (eventBus as any).connectionState = 'connected';
      (eventBus as any).jetStream = mockNats._mockJetStream;
      const mockConsumer = { fetch: jest.fn().mockResolvedValue({ [Symbol.asyncIterator]: async function* () {} }) };
      mockNats._mockJetStream.consumers.get.mockResolvedValue(mockConsumer);
      const unsubscribe = await eventBus.subscribe<{ key: string }>('test.event', async () => {}, { streamName: 'ORION_PLATFORM', durableName: 'test-consumer' });
      expect(mockNats._mockJetStream.consumers.get).toHaveBeenCalledWith('ORION_PLATFORM', 'test-consumer');
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
