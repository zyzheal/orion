import { EventSubscriber, TypedSubscriptionRule } from '../EventSubscriber';
import { EventBusService } from '../../services/event-bus-service';

describe('EventSubscriber', () => {
  let subscriber: EventSubscriber;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    mockEventBus = { subscribe: jest.fn().mockResolvedValue(jest.fn()), getRepositories: jest.fn().mockReturnValue({}) } as any;
    subscriber = new EventSubscriber(mockEventBus);
  });

  it('should register a typed subscription rule', () => {
    subscriber.register<{ runId: string }>({ subjectPattern: 'orion.pipeline.run.*', streamName: 'ORION_PIPELINE', durableName: 'test-rule', dataType: 'PipelineRunEventData', handler: async () => {} });
    expect(mockEventBus.subscribe).not.toHaveBeenCalled();
  });

  it('should start all registered subscriptions', async () => {
    subscriber.register<{ runId: string }>({ subjectPattern: 'orion.pipeline.run.*', streamName: 'ORION_PIPELINE', durableName: 'test-start', dataType: 'PipelineRunEventData', handler: async () => {} });
    await subscriber.start();
    expect(mockEventBus.subscribe).toHaveBeenCalledWith('orion.pipeline.run.*', expect.any(Function), { streamName: 'ORION_PIPELINE', durableName: 'test-start' });
  });
});
