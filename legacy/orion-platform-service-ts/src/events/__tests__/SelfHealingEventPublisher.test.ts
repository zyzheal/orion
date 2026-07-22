/**
 * SelfHealingEventPublisher 测试
 */

import { SelfHealingEventPublisher } from '../SelfHealingEventPublisher';
import { EventBusAdapter } from '../EventBusAdapter';

describe('SelfHealingEventPublisher', () => {
  let publisher: SelfHealingEventPublisher;
  let mockAdapter: { publish: jest.Mock };

  beforeEach(() => {
    mockAdapter = { publish: jest.fn().mockResolvedValue({ success: true, eventId: 'evt-1' }) };
    publisher = new SelfHealingEventPublisher();
    // Replace adapter with mock
    (publisher as any).adapter = mockAdapter as any;
  });

  describe('publishIncidentDetected', () => {
    it('should publish self-healing.incident_detected event', async () => {
      const data = {
        incidentId: 'inc-1',
        alertId: 'alert-1',
        appName: 'my-app',
        environment: 'production',
        type: 'high_cpu' as any,
        severity: 'critical' as any,
        tags: { app: 'my-app', env: 'production' },
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishIncidentDetected(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.incident_detected',
        expect.objectContaining({
          incidentId: 'inc-1',
          appName: 'my-app',
          type: 'high_cpu',
          severity: 'critical',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishHealingStarted', () => {
    it('should publish self-healing.healing_started event', async () => {
      const data = {
        incidentId: 'inc-1',
        appName: 'my-app',
        environment: 'production',
        strategyId: 'str-1',
        strategyName: 'restart-on-crash',
        actions: [{ type: 'restart' as any, description: 'Restart pod' }],
        requiresApproval: false,
        confidence: 85,
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishHealingStarted(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.healing_started',
        expect.objectContaining({
          incidentId: 'inc-1',
          strategyId: 'str-1',
          strategyName: 'restart-on-crash',
          confidence: 85,
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishActionExecuted', () => {
    it('should publish self-healing.action_executed event', async () => {
      const data = {
        incidentId: 'inc-1',
        actionType: 'restart' as any,
        success: true,
        durationMs: 1500,
        message: 'Pod restarted successfully',
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishActionExecuted(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.action_executed',
        expect.objectContaining({
          incidentId: 'inc-1',
          actionType: 'restart',
          success: true,
          durationMs: 1500,
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should publish action_executed with error when action fails', async () => {
      const data = {
        incidentId: 'inc-1',
        actionType: 'restart' as any,
        success: false,
        durationMs: 500,
        error: 'Pod restart failed: timeout',
        rollbackNeeded: true,
        rollbackSuccess: true,
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishActionExecuted(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.action_executed',
        expect.objectContaining({
          success: false,
          error: 'Pod restart failed: timeout',
          rollbackNeeded: true,
          rollbackSuccess: true,
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishHealingCompleted', () => {
    it('should publish self-healing.healing_completed event', async () => {
      const data = {
        incidentId: 'inc-1',
        appName: 'my-app',
        environment: 'production',
        success: true,
        durationMs: 3000,
        actionsExecuted: 2,
        effectiveness: 85,
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishHealingCompleted(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.healing_completed',
        expect.objectContaining({
          incidentId: 'inc-1',
          success: true,
          durationMs: 3000,
          effectiveness: 85,
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishHealingFailed', () => {
    it('should publish self-healing.healing_failed event', async () => {
      const data = {
        incidentId: 'inc-1',
        appName: 'my-app',
        environment: 'production',
        error: 'All healing actions failed',
        attempts: 3,
        lastAction: 'rollback' as any,
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishHealingFailed(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.healing_failed',
        expect.objectContaining({
          incidentId: 'inc-1',
          error: 'All healing actions failed',
          attempts: 3,
          lastAction: 'rollback',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishApprovalRequested', () => {
    it('should publish self-healing.approval_requested event', async () => {
      const data = {
        approvalRequestId: 'apr-1',
        incidentId: 'inc-1',
        appName: 'my-app',
        environment: 'production',
        title: 'Self-Healing Approval: high_cpu in my-app',
        description: 'Auto-healing requires approval',
        riskLevel: 'high' as any,
        recommendedActions: [{ type: 'restart' as any, description: 'Restart pod' }],
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishApprovalRequested(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.approval_requested',
        expect.objectContaining({
          approvalRequestId: 'apr-1',
          incidentId: 'inc-1',
          riskLevel: 'high',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishApprovalResponded', () => {
    it('should publish self-healing.approval_responded event for approval', async () => {
      const data = {
        approvalRequestId: 'apr-1',
        incidentId: 'inc-1',
        approved: true,
        respondedBy: 'admin@example.com',
        reason: 'Risk is acceptable',
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishApprovalResponded(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.approval_responded',
        expect.objectContaining({
          approvalRequestId: 'apr-1',
          approved: true,
          respondedBy: 'admin@example.com',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should publish self-healing.approval_responded event for rejection', async () => {
      const data = {
        approvalRequestId: 'apr-1',
        incidentId: 'inc-1',
        approved: false,
        respondedBy: 'admin@example.com',
        reason: 'Too risky for production',
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishApprovalResponded(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.approval_responded',
        expect.objectContaining({
          approved: false,
          reason: 'Too risky for production',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('publishIncidentEscalated', () => {
    it('should publish self-healing.incident_escalated event', async () => {
      const data = {
        incidentId: 'inc-1',
        appName: 'my-app',
        environment: 'production',
        reason: 'Storm suppressed - same alert triggered recently',
        type: 'high_cpu' as any,
        status: 'escalated' as any,
        timestamp: new Date().toISOString(),
      };

      const result = await publisher.publishIncidentEscalated(data);

      expect(mockAdapter.publish).toHaveBeenCalledWith(
        'self-healing.incident_escalated',
        expect.objectContaining({
          incidentId: 'inc-1',
          reason: 'Storm suppressed - same alert triggered recently',
          status: 'escalated',
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('setEventBus', () => {
    it('should allow setting eventBus after construction', () => {
      const mockEventBus = { publish: jest.fn(), subscribe: jest.fn(), checkHealth: jest.fn() } as any;
      const newPublisher = new SelfHealingEventPublisher();

      newPublisher.setEventBus(mockEventBus);

      expect(newPublisher.isAvailable()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return false when no eventBus is set', () => {
      const newPublisher = new SelfHealingEventPublisher();
      expect(newPublisher.isAvailable()).toBe(false);
    });
  });

  describe('getConnectionState', () => {
    it('should return unavailable when no eventBus is set', () => {
      const newPublisher = new SelfHealingEventPublisher();
      expect(newPublisher.getConnectionState()).toBe('unavailable');
    });
  });
});