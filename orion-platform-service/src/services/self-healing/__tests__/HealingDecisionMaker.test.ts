/**
 * HealingDecisionMaker - Detailed Unit Tests
 *
 * Comprehensive tests for the healing decision maker:
 * - Risk assessment with custom risk assessor
 * - Disabled environments and incident types
 * - Approval request lifecycle (create, respond, expire, clear)
 * - Edge cases and error handling
 */

import { HealingDecisionMaker, IRiskAssessor, DecisionMakerConfig } from '../HealingDecisionMaker';
import { HealingStrategy, HealingAction, IncidentType, IncidentSeverity } from '../types';

// ==================== Helpers ====================

function createStrategy(overrides?: Partial<HealingStrategy>): HealingStrategy {
  return {
    id: `strategy-${Date.now()}`,
    name: 'Test Strategy',
    triggerType: 'pod_crash',
    confidence: 80,
    enabled: true,
    actions: [
      {
        type: 'restart',
        params: { target: 'test-app', graceful: true },
        timeout: 60000,
        rollback: true,
      },
    ],
    ...overrides,
  };
}

describe('HealingDecisionMaker', () => {
  let dm: HealingDecisionMaker;

  beforeEach(() => {
    dm = new HealingDecisionMaker();
  });

  // ==================== getDecision ====================

  describe('getDecision', () => {
    describe('environment-based decisions', () => {
      it('should require manual approval for production', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'production',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.requiresApproval).toBe(true);
        expect(decision.reason).toContain('production');
      });

      it('should require manual approval for prod', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'prod',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.requiresApproval).toBe(true);
      });

      it('should allow auto-heal for dev', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('auto');
        expect(decision.requiresApproval).toBe(false);
      });

      it('should allow auto-heal for staging', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'staging',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('auto');
      });
    });

    describe('confidence-based decisions', () => {
      it('should require manual for confidence below threshold', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 50 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.reason).toContain('below threshold');
      });

      it('should allow auto for confidence at threshold', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 70 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('auto');
      });

      it('should allow auto for confidence above threshold', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 100 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('auto');
      });

      it('should use custom threshold', async () => {
        const customDm = new HealingDecisionMaker({
          autoHealConfidenceThreshold: 90,
        });

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.reason).toContain('below threshold');
      });
    });

    describe('severity-based decisions', () => {
      it('should require manual for critical severity', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'critical',
        });

        expect(decision.type).toBe('manual');
        expect(decision.reason).toContain('Critical severity');
      });

      it('should allow auto for warning severity in dev', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('auto');
      });

      it('should allow auto for info severity in dev', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'info',
        });

        expect(decision.type).toBe('auto');
      });
    });

    describe('disabled environments', () => {
      it('should require manual for disabled environment', async () => {
        const customDm = new HealingDecisionMaker({
          disabledEnvironments: ['staging', 'qa'],
        });

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'staging',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.requiresApproval).toBe(true);
        expect(decision.reason).toContain('disabled for environment');
      });
    });

    describe('disabled incident types', () => {
      it('should require manual for disabled incident type', async () => {
        const customDm = new HealingDecisionMaker({
          disabledIncidentTypes: ['high_cpu', 'high_memory'],
        });

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'high_cpu',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.reason).toContain('disabled for incident type');
      });
    });

    describe('risk assessment', () => {
      it('should use custom risk assessor', async () => {
        const mockAssessor: IRiskAssessor = {
          assessRisk: jest.fn().mockResolvedValue({
            riskLevel: 'critical',
            riskScore: 95,
          }),
        };

        const customDm = new HealingDecisionMaker(
          { maxAutoHealRiskLevel: 'medium' },
          mockAssessor
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 90 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.type).toBe('manual');
        expect(decision.riskLevel).toBe('critical');
        expect(mockAssessor.assessRisk).toHaveBeenCalledWith('app', 'dev', 'restart');
      });

      it('should fall back to default risk when assessor throws', async () => {
        const failingAssessor: IRiskAssessor = {
          assessRisk: jest.fn().mockRejectedValue(new Error('Assessor unavailable')),
        };

        const customDm = new HealingDecisionMaker(
          {},
          failingAssessor
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        // Should fall back to default risk calculation and still produce a decision
        expect(decision.type).toBeDefined();
        expect(decision.riskLevel).toBeDefined();
      });

      it('should return recommended actions in decision', async () => {
        const strategy = createStrategy({
          confidence: 85,
          actions: [
            { type: 'restart', params: { target: 'app' } },
            { type: 'scale', params: { target: 'app', direction: 'up' } },
          ],
        });

        const decision = await dm.getDecision({
          strategy,
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash',
          severity: 'warning',
        });

        expect(decision.recommendedActions).toEqual(strategy.actions);
      });
    });
  });

  // ==================== shouldAutoHeal ====================

  describe('shouldAutoHeal', () => {
    it('should return true for auto-heal eligible scenarios', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 85 }),
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(result).toBe(true);
    });

    it('should return false for production', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 85 }),
        appName: 'app',
        environment: 'production',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(result).toBe(false);
    });

    it('should return false for low confidence', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 40 }),
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'warning',
      });

      expect(result).toBe(false);
    });

    it('should return false for critical severity', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 90 }),
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash',
        severity: 'critical',
      });

      expect(result).toBe(false);
    });
  });

  // ==================== Approval Workflow ====================

  describe('createApprovalRequest', () => {
    it('should create a pending request with correct fields', () => {
      const decision = {
        type: 'manual' as const,
        reason: 'Needs review',
        confidence: 80,
        riskLevel: 'high' as const,
        requiresApproval: true,
        recommendedActions: [{ type: 'restart' as const, params: { target: 'app' } }],
      };

      const request = dm.createApprovalRequest({
        incidentId: 'inc-123',
        decision,
        appName: 'my-app',
        environment: 'production',
        incidentType: 'pod_crash',
        requestedBy: 'admin',
      });

      expect(request.id).toBeDefined();
      expect(request.incidentId).toBe('inc-123');
      expect(request.title).toContain('pod_crash');
      expect(request.title).toContain('my-app');
      expect(request.description).toContain('my-app');
      expect(request.description).toContain('production');
      expect(request.riskLevel).toBe('high');
      expect(request.recommendedActions).toEqual(decision.recommendedActions);
      expect(request.status).toBe('pending');
      expect(request.requestedBy).toBe('admin');
      expect(request.requestedAt).toBeInstanceOf(Date);
      expect(request.expiresAt).toBeInstanceOf(Date);
    });

    it('should default requestedBy to system', () => {
      const decision = {
        type: 'manual' as const,
        reason: 'Test',
        confidence: 80,
        riskLevel: 'low' as const,
        requiresApproval: true,
        recommendedActions: [],
      };

      const request = dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision,
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash',
      });

      expect(request.requestedBy).toBe('system');
    });

    it('should set expiration based on config', () => {
      const customDm = new HealingDecisionMaker({
        approvalExpirationMs: 600000, // 10 minutes
      });

      const before = Date.now();
      const request = customDm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: {
          type: 'manual',
          reason: 'Test',
          confidence: 80,
          riskLevel: 'low',
          requiresApproval: true,
          recommendedActions: [],
        },
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash',
      });

      const expiresMs = request.expiresAt!.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 600000);
    });
  });

  describe('respondToApproval', () => {
    let requestId: string;

    beforeEach(() => {
      const request = dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: {
          type: 'manual',
          reason: 'Test',
          confidence: 80,
          riskLevel: 'high',
          requiresApproval: true,
          recommendedActions: [],
        },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });
      requestId = request.id;
    });

    it('should approve a pending request', () => {
      const result = dm.respondToApproval(requestId, {
        approved: true,
        reason: 'Good to go',
        respondedBy: 'admin',
      });

      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('admin');
      expect(result.approvalReason).toBe('Good to go');
      expect(result.respondedAt).toBeInstanceOf(Date);
    });

    it('should reject a pending request', () => {
      const result = dm.respondToApproval(requestId, {
        approved: false,
        reason: 'Too risky',
        respondedBy: 'admin',
      });

      expect(result.status).toBe('rejected');
      expect(result.approvedBy).toBe('admin');
      expect(result.approvalReason).toBe('Too risky');
    });

    it('should throw for non-existent request', () => {
      expect(() => {
        dm.respondToApproval('non-existent', {
          approved: true,
          respondedBy: 'admin',
        });
      }).toThrow('not found');
    });

    it('should throw for already-approved request', () => {
      dm.respondToApproval(requestId, {
        approved: true,
        respondedBy: 'admin',
      });

      expect(() => {
        dm.respondToApproval(requestId, {
          approved: false,
          respondedBy: 'admin2',
        });
      }).toThrow('not pending');
    });

    it('should throw for already-rejected request', () => {
      dm.respondToApproval(requestId, {
        approved: false,
        respondedBy: 'admin',
      });

      expect(() => {
        dm.respondToApproval(requestId, {
          approved: true,
          respondedBy: 'admin2',
        });
      }).toThrow('not pending');
    });
  });

  describe('getApprovalRequest', () => {
    it('should return request by ID', async () => {
      const request = dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: {
          type: 'manual',
          reason: 'Test',
          confidence: 80,
          riskLevel: 'high',
          requiresApproval: true,
          recommendedActions: [],
        },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      const found = await dm.getApprovalRequest(request.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(request.id);
    });

    it('should return undefined for non-existent request', async () => {
      const found = await dm.getApprovalRequest('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getApprovalRequests', () => {
    beforeEach(() => {
      // Create multiple requests
      dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'A', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });
      dm.createApprovalRequest({
        incidentId: 'inc-2',
        decision: { type: 'manual', reason: 'B', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'high_cpu',
      });
    });

    it('should return all requests', async () => {
      const all = await dm.getApprovalRequests();
      expect(all.length).toBe(2);
    });

    it('should filter by pending status', async () => {
      const pending = await dm.getApprovalRequests('pending');
      expect(pending.length).toBe(2);
    });

    it('should filter after response', async () => {
      const all = await dm.getApprovalRequests();
      dm.respondToApproval(all[0].id, { approved: true, respondedBy: 'admin' });

      const pending = await dm.getApprovalRequests('pending');
      expect(pending.length).toBe(1);

      const approved = await dm.getApprovalRequests('approved');
      expect(approved.length).toBe(1);
    });
  });

  describe('checkExpiredRequests', () => {
    it('should mark requests as expired when past expiration', async () => {
      const expiredDm = new HealingDecisionMaker({ approvalExpirationMs: 0 });

      const request = expiredDm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      expiredDm.checkExpiredRequests();

      const found = await expiredDm.getApprovalRequest(request.id);
      expect(found?.status).toBe('expired');
    });

    it('should not mark non-expired requests', async () => {
      const request = dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      dm.checkExpiredRequests();

      const found = await dm.getApprovalRequest(request.id);
      expect(found?.status).toBe('pending');
    });

    it('should not mark already-responded requests', async () => {
      const expiredDm = new HealingDecisionMaker({ approvalExpirationMs: 0 });

      const request = expiredDm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      expiredDm.respondToApproval(request.id, { approved: true, respondedBy: 'admin' });
      expiredDm.checkExpiredRequests();

      const found = await expiredDm.getApprovalRequest(request.id);
      expect(found?.status).toBe('approved');
    });
  });

  describe('clearExpiredRequests', () => {
    it('should clear old responded requests', async () => {
      const request = dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      // Respond to set respondedAt
      dm.respondToApproval(request.id, { approved: true, respondedBy: 'admin' });

      // Clear with large maxAgeMs to keep everything
      dm.clearExpiredRequests(3600000);
      let all = await dm.getApprovalRequests();
      expect(all.length).toBe(1);

      // Wait a tiny bit so respondedAt is definitely in the past, then clear with maxAgeMs = 0
      // Actually, use a negative maxAgeMs to make cutoff in the future
      dm.clearExpiredRequests(-1);
      all = await dm.getApprovalRequests();
      expect(all.length).toBe(0);
    });

    it('should not clear recent responses', async () => {
      dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'high', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'staging',
        incidentType: 'pod_crash',
      });

      // Don't clear with large maxAge
      dm.clearExpiredRequests(3600000);

      const all = await dm.getApprovalRequests();
      expect(all.length).toBe(1);
    });
  });
});
