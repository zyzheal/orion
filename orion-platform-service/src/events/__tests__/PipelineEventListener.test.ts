import { PipelineEventListener, PipelineEventHandler } from '../PipelineEventListener';
import { EventBusService } from '../../services/event-bus-service';

describe('PipelineEventListener', () => {
  let listener: PipelineEventListener;
  let mockEventBus: jest.Mocked<EventBusService>;
  let handlers: PipelineEventHandler;

  beforeEach(() => {
    mockEventBus = { subscribe: jest.fn().mockResolvedValue(jest.fn()) } as any;
    handlers = { onRunCreated: jest.fn(), onRunStarted: jest.fn(), onRunCompleted: jest.fn(), onRunFailed: jest.fn(), onRunCancelled: jest.fn() };
    listener = new PipelineEventListener({ eventBus: mockEventBus, streamName: 'ORION_PIPELINE', consumerGroup: 'test-consumers', handlers });
  });

  it('should subscribe to run events on start', async () => {
    await listener.start();
    const runCalls = mockEventBus.subscribe.mock.calls.filter(c => c[0].startsWith('orion.pipeline.run.'));
    expect(runCalls.length).toBe(5);
  });

  it('should unsubscribe on stop', async () => {
    const mockUnsub = jest.fn().mockResolvedValue(undefined);
    mockEventBus.subscribe.mockResolvedValue(mockUnsub);
    await listener.start();
    await listener.stop();
    expect(mockUnsub).toHaveBeenCalled();
  });

  it('should handle partial handlers (skip missing)', async () => {
    const partialHandlers: Partial<PipelineEventHandler> = { onRunCreated: jest.fn() };
    const partialListener = new PipelineEventListener({ eventBus: mockEventBus, streamName: 'ORION_PIPELINE', consumerGroup: 'test-consumers', handlers: partialHandlers });
    await partialListener.start();
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
  });
});
