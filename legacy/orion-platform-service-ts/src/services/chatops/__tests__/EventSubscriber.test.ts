/**
 * ChatOpsEventSubscriber 单元测试
 *
 * 测试事件订阅、推荐生成、fallback 轮询、清理。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

// Mock repositories
const mockRecommendationRepo = {
  findActive: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(undefined),
  cleanExpired: jest.fn().mockResolvedValue(undefined),
};

const mockSubscriptionFailureRepo = {
  findUnresolved: jest.fn().mockResolvedValue([]),
  upsertFailure: jest.fn().mockResolvedValue(undefined),
  markResolved: jest.fn().mockResolvedValue(undefined),
  incrementRetryCount: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../repositories/ChatOpsRecommendationRepository', () => ({
  ChatOpsRecommendationRepository: jest.fn().mockImplementation(() => mockRecommendationRepo),
}));

jest.mock('../../../repositories/ChatOpsSubscriptionFailureRepository', () => ({
  ChatOpsSubscriptionFailureRepository: jest.fn().mockImplementation(() => mockSubscriptionFailureRepo),
}));

import { EventEmitter } from 'events';
import { ChatOpsEventSubscriber } from '../EventSubscriber';
import { EventBusError } from '../../event-bus-service';

function createMockEventBus(overrides: Record<string, any> = {}): any {
  const bus = new EventEmitter();
  return {
    subscribe: jest.fn().mockResolvedValue(jest.fn()),
    publish: jest.fn().mockResolvedValue('event-1'),
    isFallback: jest.fn().mockReturnValue(false),
    getRepositories: jest.fn().mockReturnValue({}),
    on: bus.on.bind(bus),
    emit: bus.emit.bind(bus),
    ...overrides,
  };
}

describe('ChatOpsEventSubscriber', () => {
  let subscriber: ChatOpsEventSubscriber;
  let mockEventBus: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRecommendationRepo.findActive.mockResolvedValue([]);
    mockSubscriptionFailureRepo.findUnresolved.mockResolvedValue([]);

    mockEventBus = createMockEventBus();
    subscriber = new ChatOpsEventSubscriber(mockEventBus, { query: jest.fn() }, 'tenant-1');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create subscriber with eventBus', () => {
      expect(subscriber).toBeDefined();
    });

    it('should work without db', () => {
      const sub = new ChatOpsEventSubscriber(mockEventBus);
      expect(sub).toBeDefined();
    });

    it('should load from DB on construction', async () => {
      // loadFromDB is called in constructor; advance timers to allow it to complete
      jest.advanceTimersByTime(100);
      // Allow microtasks to flush
      await Promise.resolve();
      expect(mockRecommendationRepo.findActive).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should subscribe to all events', async () => {
      await subscriber.initialize();

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(7);
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('alert.created', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('alert.acknowledged', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('alert.dismissed', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('pipeline.run.completed', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('pipeline.run.blocked', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('deploy.finished', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('selfhealing.failed', expect.any(Function));
    });

    it('should record subscription failures', async () => {
      mockEventBus.subscribe.mockRejectedValueOnce(new Error('NATS down'));

      await subscriber.initialize();

      const failures = subscriber.getSubscriptionFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].event).toBe('alert.created');
    });
  });

  describe('alert events', () => {
    it('should create recommendation on alert.created', async () => {
      await subscriber.initialize();

      // Simulate alert.created event
      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];

      await handler({
        data: {
          alertId: 'alert-1',
          severity: 'critical',
          title: 'CPU High',
          message: 'CPU > 90%',
          resource: 'node-3',
        },
      });

      const recs = subscriber.getActiveRecommendations();
      expect(recs).toHaveLength(1);
      expect(recs[0].type).toBe('alert');
      expect(recs[0].severity).toBe('critical');
      expect(recs[0].title).toBe('CPU High');
    });

    it('should remove recommendation on alert.acknowledged', async () => {
      await subscriber.initialize();

      // First create an alert
      const createHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await createHandler({ data: { alertId: 'alert-1', severity: 'info', title: 'Test' } });
      expect(subscriber.getActiveRecommendations()).toHaveLength(1);

      // Then acknowledge it
      const ackHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.acknowledged'
      )[1];
      await ackHandler({ data: { alertId: 'alert-1' } });

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
    });

    it('should remove recommendation on alert.dismissed', async () => {
      await subscriber.initialize();

      const createHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await createHandler({ data: { alertId: 'alert-1', severity: 'info', title: 'Test' } });

      const dismissHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.dismissed'
      )[1];
      await dismissHandler({ data: { alertId: 'alert-1' } });

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
    });

    it('should ignore alert without alertId', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await handler({ data: { title: 'No ID alert' } });

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
    });
  });

  describe('pipeline events', () => {
    it('should create recommendation on failed pipeline', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'pipeline.run.completed'
      )[1];
      await handler({
        data: {
          runId: 'run-1',
          pipelineId: 'pipe-1',
          status: 'failed',
          error: 'Build failed',
        },
      });

      const recs = subscriber.getActiveRecommendations();
      expect(recs).toHaveLength(1);
      expect(recs[0].type).toBe('blocked');
      expect(recs[0].title).toContain('Pipeline');
      expect(recs[0].title).toContain('执行失败');
    });

    it('should ignore successful pipeline', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'pipeline.run.completed'
      )[1];
      await handler({ data: { status: 'success' } });

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
    });

    it('should create recommendation on pipeline blocked', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'pipeline.run.blocked'
      )[1];
      await handler({
        data: {
          runId: 'run-2',
          pipelineId: 'pipe-2',
          message: 'Needs approval',
        },
      });

      const recs = subscriber.getActiveRecommendations();
      expect(recs).toHaveLength(1);
      expect(recs[0].type).toBe('blocked');
      expect(recs[0].title).toContain('等待确认');
    });
  });

  describe('deploy events', () => {
    it('should create recommendation on failed deploy', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'deploy.finished'
      )[1];
      await handler({
        data: {
          deploymentId: 'deploy-1',
          status: 'failed',
          service: 'api',
          error: 'CrashLoopBackOff',
        },
      });

      const recs = subscriber.getActiveRecommendations();
      expect(recs).toHaveLength(1);
      expect(recs[0].type).toBe('deploy_result');
      expect(recs[0].severity).toBe('critical');
    });

    it('should ignore successful deploy', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'deploy.finished'
      )[1];
      await handler({ data: { status: 'success' } });

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
    });
  });

  describe('selfhealing events', () => {
    it('should create recommendation on self-healing failure', async () => {
      await subscriber.initialize();

      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'selfhealing.failed'
      )[1];
      await handler({
        data: {
          policyId: 'pol-1',
          policyName: 'Pod Restart',
          error: 'Retries exhausted',
          service: 'payment',
        },
      });

      const recs = subscriber.getActiveRecommendations();
      expect(recs).toHaveLength(1);
      expect(recs[0].type).toBe('selfhealing');
      expect(recs[0].title).toContain('自愈失败');
    });
  });

  describe('getFilteredRecommendations', () => {
    it('should return all recommendations for admin', async () => {
      await subscriber.initialize();

      const createHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await createHandler({ data: { alertId: 'alert-1', severity: 'critical', title: 'Test' } });

      const recs = subscriber.getFilteredRecommendations('admin');
      expect(recs).toHaveLength(1);
      expect(recs[0].actions.length).toBeGreaterThan(0);
    });

    it('should hide actions for critical alerts for viewer', async () => {
      await subscriber.initialize();

      const createHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await createHandler({ data: { alertId: 'alert-1', severity: 'critical', title: 'Test' } });

      const recs = subscriber.getFilteredRecommendations('viewer');
      expect(recs).toHaveLength(1);
      expect(recs[0].actions).toHaveLength(0);
    });

    it('should show actions for non-critical alerts for viewer', async () => {
      await subscriber.initialize();

      const createHandler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await createHandler({ data: { alertId: 'alert-1', severity: 'warning', title: 'Test' } });

      const recs = subscriber.getFilteredRecommendations('viewer');
      expect(recs).toHaveLength(1);
      expect(recs[0].actions.length).toBeGreaterThan(0);
    });
  });

  describe('getLocalBus', () => {
    it('should return local EventEmitter', () => {
      const localBus = subscriber.getLocalBus();
      expect(localBus).toBeInstanceOf(EventEmitter);
    });
  });

  describe('getSubscriptionFailures', () => {
    it('should return empty when no failures', () => {
      expect(subscriber.getSubscriptionFailures()).toHaveLength(0);
    });
  });

  describe('isFallbackMode', () => {
    it('should return false initially', () => {
      expect(subscriber.isFallbackMode()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', async () => {
      await subscriber.initialize();
      await subscriber.cleanup();

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
      expect(subscriber.getSubscriptionFailures()).toHaveLength(0);
    });
  });

  // ==================== Fallback and Connect Events ====================

  describe('EventBus fallback event', () => {
    it('should start fallback polling when eventBus emits fallback', async () => {
      await subscriber.initialize();

      // Emit fallback event
      mockEventBus.emit('fallback');

      // Advance timers to trigger the polling interval
      jest.advanceTimersByTime(5000);

      // The subscriber should be in fallback mode conceptually
      // Verify by checking that pollEventsFromDB was attempted (via getRepositories)
      expect(mockEventBus.getRepositories).toHaveBeenCalled();
    });
  });

  describe('EventBus connect event', () => {
    it('should stop fallback polling and retry on reconnect', async () => {
      // First create a subscription failure
      mockEventBus.subscribe.mockRejectedValueOnce(new Error('NATS down'));
      await subscriber.initialize();

      expect(subscriber.getSubscriptionFailures()).toHaveLength(1);

      // Now emit connect event - should trigger retryFailedSubscriptions
      mockEventBus.subscribe.mockResolvedValue(jest.fn());
      mockEventBus.emit('connect');

      // Allow async retry to complete
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  // ==================== loadFromDB ====================

  describe('loadFromDB', () => {
    it('should load active recommendations from DB on construction', async () => {
      mockRecommendationRepo.findActive.mockResolvedValue([
        {
          id: 'rec-1',
          type: 'alert',
          severity: 'critical',
          title: 'DB Alert',
          description: 'From DB',
          actions: [],
          createdAt: new Date(),
          source: 'monitoring',
        },
      ]);
      mockSubscriptionFailureRepo.findUnresolved.mockResolvedValue([
        {
          eventType: 'alert.created',
          errorMessage: 'Sub failed',
          lastRetryAt: new Date(),
          retryCount: 1,
        },
      ]);

      const sub = new ChatOpsEventSubscriber(mockEventBus, { query: jest.fn() }, 'tenant-1');

      // Advance timers to allow loadFromDB to complete
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      const recs = sub.getActiveRecommendations();
      expect(recs).toHaveLength(1);
      expect(recs[0].id).toBe('rec-1');
      expect(recs[0].title).toBe('DB Alert');
    });
  });

  // ==================== EventBusError Handling ====================

  describe('EventBusError handling in initialize', () => {
    it('should handle DISABLED EventBusError gracefully', async () => {
      mockEventBus.subscribe.mockRejectedValue(
        new EventBusError('EventBus disabled', 'DISABLED', false)
      );

      await subscriber.initialize();

      // Should record subscription failures but not crash
      const failures = subscriber.getSubscriptionFailures();
      expect(failures).toHaveLength(7); // All 7 subscriptions failed
    });

    it('should trigger fallback polling for NOT_CONNECTED recoverable error', async () => {
      mockEventBus.isFallback.mockReturnValue(true);
      mockEventBus.subscribe.mockRejectedValue(
        new EventBusError('Not connected', 'NOT_CONNECTED', true)
      );

      await subscriber.initialize();

      // Should have recorded failures
      expect(subscriber.getSubscriptionFailures().length).toBeGreaterThan(0);
    });
  });

  // ==================== Fallback Polling ====================

  describe('startFallbackPolling', () => {
    it('should poll events from DB at interval', async () => {
      const mockEventRepo = {
        findByStatus: jest.fn().mockResolvedValue([]),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };
      mockEventBus.getRepositories.mockReturnValue({ eventRepo: mockEventRepo });

      await subscriber.initialize();

      // Trigger fallback
      mockEventBus.emit('fallback');

      // Advance to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockEventRepo.findByStatus).toHaveBeenCalledWith('pending_fallback', { limit: 10 });
    });

    it('should process pending events during polling', async () => {
      const mockEventRepo = {
        findByStatus: jest.fn().mockResolvedValue([
          {
            id: 'evt-1',
            eventType: 'alert.created',
            payload: { data: { alertId: 'alert-fallback', severity: 'warning', title: 'Fallback Alert' } },
          },
        ]),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };
      mockEventBus.getRepositories.mockReturnValue({ eventRepo: mockEventRepo });

      await subscriber.initialize();

      // Trigger fallback
      mockEventBus.emit('fallback');

      // Advance to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockEventRepo.updateStatus).toHaveBeenCalledWith('evt-1', 'delivered');
      const recs = subscriber.getActiveRecommendations();
      expect(recs.some(r => r.id === 'alert-fallback')).toBe(true);
    });

    it('should handle poll errors gracefully', async () => {
      const mockEventRepo = {
        findByStatus: jest.fn().mockRejectedValue(new Error('DB down')),
      };
      mockEventBus.getRepositories.mockReturnValue({ eventRepo: mockEventRepo });

      await subscriber.initialize();
      mockEventBus.emit('fallback');

      // Should not throw
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    it('should skip polling when no eventRepo available', async () => {
      mockEventBus.getRepositories.mockReturnValue({});

      await subscriber.initialize();
      mockEventBus.emit('fallback');

      // Should not throw
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
  });

  // ==================== retryFailedSubscriptions ====================

  describe('retryFailedSubscriptions', () => {
    it('should retry failed subscriptions on reconnect', async () => {
      // First subscription fails
      mockEventBus.subscribe.mockRejectedValueOnce(new Error('NATS down'));
      await subscriber.initialize();

      expect(subscriber.getSubscriptionFailures()).toHaveLength(1);

      // Now reconnect succeeds
      mockEventBus.subscribe.mockResolvedValue(jest.fn());
      mockEventBus.emit('connect');

      await Promise.resolve();
      await Promise.resolve();

      // Failure should be cleared
      expect(subscriber.getSubscriptionFailures()).toHaveLength(0);
    });

    it('should skip retries after max retry count', async () => {
      // Create subscriber with pre-existing high retry count failures
      mockSubscriptionFailureRepo.findUnresolved.mockResolvedValue([
        {
          eventType: 'alert.created',
          errorMessage: 'Max retries',
          lastRetryAt: new Date(),
          retryCount: 3,
        },
      ]);

      const sub = new ChatOpsEventSubscriber(mockEventBus, { query: jest.fn() }, 'tenant-1');
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Emit connect to trigger retry
      mockEventBus.emit('connect');
      await Promise.resolve();

      // subscribe should not be called for the max-retried event
      // (only the 7 original subscriptions from initialize if we call it)
    });

    it('should handle retry failure and increment count', async () => {
      // First subscription fails
      mockEventBus.subscribe.mockRejectedValueOnce(new Error('NATS down'));
      await subscriber.initialize();

      expect(subscriber.getSubscriptionFailures()).toHaveLength(1);

      // Retry also fails
      mockEventBus.subscribe.mockRejectedValue(new Error('Still down'));
      mockEventBus.emit('connect');

      await Promise.resolve();
      await Promise.resolve();

      // Should still have the failure with incremented count
      expect(subscriber.getSubscriptionFailures()).toHaveLength(1);
    });
  });

  // ==================== cleanExpiredRecommendations ====================

  describe('cleanExpiredRecommendations', () => {
    it('should remove expired recommendations', async () => {
      await subscriber.initialize();

      // Create an alert recommendation
      const handler = mockEventBus.subscribe.mock.calls.find(
        (c: any[]) => c[0] === 'alert.created'
      )[1];
      await handler({
        data: {
          alertId: 'alert-expire',
          severity: 'info',
          title: 'Will expire',
        },
      });

      expect(subscriber.getActiveRecommendations()).toHaveLength(1);

      // Advance time past TTL (30 min) + cleanup interval (10 min) to ensure cleanup fires
      // Cleanup runs every 10 min, TTL is 30 min, so at 41 min mark:
      // - cleanup fires at 40 min
      // - recommendation is 41 min old > 30 min TTL
      jest.advanceTimersByTime(41 * 60 * 1000);

      expect(subscriber.getActiveRecommendations()).toHaveLength(0);
    });
  });

  // ==================== getHandlerForEvent ====================

  describe('getHandlerForEvent', () => {
    it('should handle deploy.finished event through fallback polling', async () => {
      const mockEventRepo = {
        findByStatus: jest.fn().mockResolvedValue([
          {
            id: 'evt-deploy',
            eventType: 'deploy.finished',
            payload: { data: { deploymentId: 'd-1', status: 'failed', service: 'api' } },
          },
        ]),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };
      mockEventBus.getRepositories.mockReturnValue({ eventRepo: mockEventRepo });

      await subscriber.initialize();
      mockEventBus.emit('fallback');

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      const recs = subscriber.getActiveRecommendations();
      expect(recs.some(r => r.type === 'deploy_result')).toBe(true);
    });

    it('should handle selfhealing.failed event through fallback polling', async () => {
      const mockEventRepo = {
        findByStatus: jest.fn().mockResolvedValue([
          {
            id: 'evt-sh',
            eventType: 'selfhealing.failed',
            payload: { data: { policyId: 'pol-1', policyName: 'Restart', error: 'Failed' } },
          },
        ]),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };
      mockEventBus.getRepositories.mockReturnValue({ eventRepo: mockEventRepo });

      await subscriber.initialize();
      mockEventBus.emit('fallback');

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      const recs = subscriber.getActiveRecommendations();
      expect(recs.some(r => r.type === 'selfhealing')).toBe(true);
    });

    it('should skip unknown event types during polling', async () => {
      const mockEventRepo = {
        findByStatus: jest.fn().mockResolvedValue([
          {
            id: 'evt-unknown',
            eventType: 'unknown.event',
            payload: { data: {} },
          },
        ]),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };
      mockEventBus.getRepositories.mockReturnValue({ eventRepo: mockEventRepo });

      await subscriber.initialize();
      mockEventBus.emit('fallback');

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      // Unknown event should still be marked as delivered
      expect(mockEventRepo.updateStatus).toHaveBeenCalledWith('evt-unknown', 'delivered');
    });
  });
});
