import { JetStreamEventConsumer, ConsumerHandler } from '../JetStreamEventConsumer';
import { EventBusService } from '../../services/event-bus-service';

describe('JetStreamEventConsumer', () => {
  let consumer: JetStreamEventConsumer;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    mockEventBus = { subscribe: jest.fn().mockResolvedValue(jest.fn()), isJetStreamAvailable: jest.fn().mockReturnValue(true) } as any;
    consumer = new JetStreamEventConsumer(mockEventBus);
  });

  it('should register a consumer handler', () => {
    consumer.register({ streamName: 'ORION_PLATFORM', durableName: 'test-handler', eventType: 'orion.test.event', handler: async () => {} });
    expect(mockEventBus.subscribe).not.toHaveBeenCalled();
  });

  it('should start all registered consumers', async () => {
    consumer.register({ streamName: 'ORION_PLATFORM', durableName: 'test-1', eventType: 'orion.test.event', handler: async () => {} });
    await consumer.start();
    expect(mockEventBus.subscribe).toHaveBeenCalledWith('orion.test.event', expect.any(Function), { streamName: 'ORION_PLATFORM', durableName: 'test-1' });
  });

  it('should stop all Consumers', async () => {
    const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
    mockEventBus.subscribe.mockResolvedValue(mockUnsubscribe);
    consumer.register({ streamName: 'ORION_PLATFORM', durableName: 'test-2', eventType: 'orion.test.event', handler: async () => {} });
    await consumer.start();
    await consumer.stop();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
