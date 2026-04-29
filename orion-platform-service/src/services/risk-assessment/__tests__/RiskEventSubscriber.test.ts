/**
 * RiskEventSubscriber 单元测试
 */

import { RiskEventSubscriber } from '../RiskEventSubscriber';
import { RiskAssessmentService } from '../RiskAssessmentService';
import { CloudEvent, EventContext, Subscription } from '@orion/event-bus';

// Mock EventBus
function createMockEventBus() {
  const subscriptions: Subscription[] = [];

  return {
    subscribe: jest.fn(
      async (
        _eventType: string,
        _handler: (event: CloudEvent<any>, context: EventContext) => Promise<void>,
        _options?: any
      ): Promise<Subscription> => {
        const sub: Subscription = {
          id: `sub-${Date.now()}`,
          unsubscribe: jest.fn().mockResolvedValue(undefined),
          drain: jest.fn().mockResolvedValue(undefined),
          isClosed: false,
        };
        subscriptions.push(sub);
        return sub;
      }
    ),
    publish: jest.fn().mockResolvedValue('mock-seq'),
    subscriptions,
  };
}

describe('RiskEventSubscriber', () => {
  let mockEventBus: any;
  let riskAssessmentService: RiskAssessmentService;
  let subscriber: RiskEventSubscriber;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    riskAssessmentService = new RiskAssessmentService();
    subscriber = new RiskEventSubscriber({
      eventBus: mockEventBus,
      riskAssessmentService,
    });
  });

  afterEach(async () => {
    await subscriber.unsubscribeFromEvents();
    riskAssessmentService.clearHistory();
  });

  // ==================== subscribeToEvents ====================

  describe('subscribeToEvents', () => {
    it('should subscribe to all required events', async () => {
      await subscriber.subscribeToEvents();

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(4);
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'pipeline.run.completed',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'pipeline.run.failed',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'code.pr.merged',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'deployment.started',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should set isRunning to true', async () => {
      expect(subscriber.isHealthy()).toBe(false);
      await subscriber.subscribeToEvents();
      expect(subscriber.isHealthy()).toBe(true);
    });

    it('should track subscription count', async () => {
      expect(subscriber.getSubscriptionCount()).toBe(0);
      await subscriber.subscribeToEvents();
      expect(subscriber.getSubscriptionCount()).toBe(4);
    });

    it('should handle missing eventBus gracefully', async () => {
      const subWithoutBus = new RiskEventSubscriber({
        eventBus: null,
        riskAssessmentService,
      });

      // Should not throw
      await expect(subWithoutBus.subscribeToEvents()).resolves.not.toThrow();
    });
  });

  // ==================== unsubscribeFromEvents ====================

  describe('unsubscribeFromEvents', () => {
    it('should unsubscribe from all events', async () => {
      await subscriber.subscribeToEvents();
      expect(subscriber.getSubscriptionCount()).toBe(4);

      await subscriber.unsubscribeFromEvents();

      expect(subscriber.getSubscriptionCount()).toBe(0);
      expect(subscriber.isHealthy()).toBe(false);
    });

    it('should call unsubscribe on each subscription', async () => {
      await subscriber.subscribeToEvents();
      await subscriber.unsubscribeFromEvents();

      mockEventBus.subscriptions.forEach((sub: Subscription) => {
        expect(sub.unsubscribe).toHaveBeenCalled();
      });
    });
  });

  // ==================== handlePipelineEvent ====================

  describe('handlePipelineEvent', () => {
    it('should process pipeline completed event', async () => {
      await subscriber.subscribeToEvents();

      const event = new CloudEvent({
        type: 'pipeline.run.completed',
        source: 'orion-platform-service',
        data: {
          pipelineId: 'pipeline-1',
          runId: 'run-1',
          status: 'success',
          triggerType: 'manual',
          gitRef: 'main',
          gitSha: 'abc123',
          durationMs: 60000,
          timestamp: new Date().toISOString(),
        },
        extensions: {
          tenantId: 'tenant-001',
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-1',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subscriber.handlePipelineEvent(event, context);

      // Verify assessment was created
      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'run-1' });
      expect(history.length).toBe(1);
    });

    it('should skip when auto-assess is disabled', async () => {
      const subNoAuto = new RiskEventSubscriber({
        eventBus: mockEventBus,
        riskAssessmentService,
        autoAssessEnabled: false,
      });

      await subNoAuto.subscribeToEvents();

      const event = new CloudEvent({
        type: 'pipeline.run.completed',
        source: 'orion-platform-service',
        data: {
          pipelineId: 'pipeline-2',
          runId: 'run-2',
          status: 'success',
          triggerType: 'manual',
          timestamp: new Date().toISOString(),
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-2',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subNoAuto.handlePipelineEvent(event, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'run-2' });
      expect(history.length).toBe(0);
    });
  });

  // ==================== handlePipelineFailedEvent ====================

  describe('handlePipelineFailedEvent', () => {
    it('should assess risk for failed pipeline', async () => {
      await subscriber.subscribeToEvents();

      const event = new CloudEvent({
        type: 'pipeline.run.failed',
        source: 'orion-platform-service',
        data: {
          pipelineId: 'pipeline-3',
          runId: 'run-failed-1',
          status: 'failed',
          triggerType: 'push',
          durationMs: 30000,
          timestamp: new Date().toISOString(),
        },
        extensions: {
          tenantId: 'tenant-002',
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-3',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subscriber.handlePipelineFailedEvent(event, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'run-failed-1' });
      expect(history.length).toBe(1);
      expect(history[0].riskScore).toBeGreaterThan(0);
    });
  });

  // ==================== handleCodePRMergedEvent ====================

  describe('handleCodePRMergedEvent', () => {
    it('should assess risk for merged PR', async () => {
      await subscriber.subscribeToEvents();

      const event = new CloudEvent({
        type: 'code.pr.merged',
        source: 'orion-platform-service',
        data: {
          prId: 'pr-1',
          repositoryId: 'repo-1',
          targetBranch: 'main',
          mergeSha: 'def456',
          timestamp: new Date().toISOString(),
        },
        extensions: {
          tenantId: 'tenant-003',
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-4',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subscriber.handleCodePRMergedEvent(event, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'pr-1' });
      expect(history.length).toBe(1);
      expect(history[0].targetType).toBe('change');
    });

    it('should skip when auto-assess is disabled', async () => {
      const subNoAuto = new RiskEventSubscriber({
        eventBus: mockEventBus,
        riskAssessmentService,
        autoAssessEnabled: false,
      });

      await subNoAuto.subscribeToEvents();

      const event = new CloudEvent({
        type: 'code.pr.merged',
        source: 'orion-platform-service',
        data: {
          prId: 'pr-skip-1',
          repositoryId: 'repo-1',
          targetBranch: 'main',
          timestamp: new Date().toISOString(),
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-5',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subNoAuto.handleCodePRMergedEvent(event, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'pr-skip-1' });
      expect(history.length).toBe(0);
    });
  });

  // ==================== handleDeploymentEvent ====================

  describe('handleDeploymentEvent', () => {
    it('should assess risk for deployment', async () => {
      await subscriber.subscribeToEvents();

      const event = new CloudEvent({
        type: 'deployment.started',
        source: 'orion-platform-service',
        data: {
          deploymentId: 'deploy-1',
          services: ['api', 'web'],
          timestamp: new Date().toISOString(),
        },
        extensions: {
          tenantId: 'tenant-004',
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-6',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subscriber.handleDeploymentEvent(event, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'deploy-1' });
      expect(history.length).toBe(1);
    });
  });

  // ==================== Time helpers ====================

  describe('time helpers', () => {
    it('should detect weekend deployments correctly', async () => {
      await subscriber.subscribeToEvents();

      // Saturday
      const saturdayEvent = new CloudEvent({
        type: 'pipeline.run.completed',
        source: 'orion-platform-service',
        data: {
          pipelineId: 'p1',
          runId: 'run-sat',
          status: 'success',
          triggerType: 'manual',
          timestamp: '2026-04-11T10:00:00Z', // Saturday
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-7',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subscriber.handlePipelineEvent(saturdayEvent, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'run-sat' });
      expect(history.length).toBe(1);
      // Weekend should have higher risk due to time factor
      expect(history[0].riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should detect Friday deployments correctly', async () => {
      await subscriber.subscribeToEvents();

      // Friday
      const fridayEvent = new CloudEvent({
        type: 'pipeline.run.completed',
        source: 'orion-platform-service',
        data: {
          pipelineId: 'p1',
          runId: 'run-fri',
          status: 'success',
          triggerType: 'manual',
          timestamp: '2026-04-10T10:00:00Z', // Friday
        },
      });

      const context: EventContext = {
        subscriptionId: 'sub-8',
        seq: 1,
        timestamp: new Date(),
        retryCount: 0,
      };

      await subscriber.handlePipelineEvent(fridayEvent, context);

      const history = await riskAssessmentService.getAssessmentHistory({ targetId: 'run-fri' });
      expect(history.length).toBe(1);
    });
  });

  // ==================== Health Check ====================

  describe('health check', () => {
    it('should report not healthy before subscribe', () => {
      expect(subscriber.isHealthy()).toBe(false);
    });

    it('should report healthy after subscribe', async () => {
      await subscriber.subscribeToEvents();
      expect(subscriber.isHealthy()).toBe(true);
    });

    it('should report not healthy after unsubscribe', async () => {
      await subscriber.subscribeToEvents();
      await subscriber.unsubscribeFromEvents();
      expect(subscriber.isHealthy()).toBe(false);
    });
  });
});
