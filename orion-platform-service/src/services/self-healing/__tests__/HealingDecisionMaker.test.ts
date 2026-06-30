/**
 * HealingDecisionMaker - Unit Tests
 *
 * Tests for auto-heal decision logic, risk assessment, approval workflow.
 * Uses prototype spy pattern since the service creates its own repository internally.
 */

import { HealingDecisionMaker, IRiskAssessor, DecisionMakerConfig } from '../HealingDecisionMaker';
import { HealingStrategy, IncidentType, IncidentSeverity } from '../types';
import { HealingApprovalRequestRepository } from '../../../repositories/HealingApprovalRequestRepository';
import { BaseRepository } from '../../../db/base-repository';

// Mock pino
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

describe('HealingDecisionMaker', () => {
  let dm: HealingDecisionMaker;
  let repoMethods: Record<string, jest.Mock>;
  let storedEntities: Map<string, any>;

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

  function applyRepoMocks(): Record<string, jest.Mock> {
    // create/update/delete/findAll are from BaseRepository prototype
    jest.spyOn(BaseRepository.prototype, 'create').mockImplementation(repoMethods.create as any);
    jest.spyOn(BaseRepository.prototype, 'findById').mockImplementation(repoMethods.findById as any);
    jest.spyOn(BaseRepository.prototype, 'findAll').mockImplementation(repoMethods.findAll as any);
    jest.spyOn(BaseRepository.prototype, 'delete').mockImplementation(repoMethods.delete as any);
    // updateStatus is from HealingApprovalRequestRepository (overrides BaseRepository)
    jest.spyOn(HealingApprovalRequestRepository.prototype, 'updateStatus').mockImplementation(repoMethods.updateStatus as any);
    // findByStatus is from HealingApprovalRequestRepository
    jest.spyOn(HealingApprovalRequestRepository.prototype, 'findByStatus').mockImplementation(repoMethods.findByStatus as any);
    return repoMethods;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    storedEntities = new Map<string, any>();
    repoMethods = {
      create: jest.fn().mockImplementation(async (entity: any) => {
        storedEntities.set(entity.id, entity);
        console.log('CREATE entity.recommendedActions:', JSON.stringify(entity.recommendedActions));
      }),
      findById: jest.fn().mockImplementation(async (id: string) => {
        console.log('REPOMETHODS findById called with id:', id);
        const entity = storedEntities.get(id) || null;
        console.log('FINDBYID entity.recommendedActions:', entity?.recommendedActions);
        return entity;
      }),
      updateStatus: jest.fn().mockImplementation(async (id: string, status: string, approvedBy?: string, reason?: string) => {
        console.log('DEBUG updateStatus called with id:', id, 'status:', status);
        const entity = storedEntities.get(id);
        if (entity) {
          entity.status = status;
          entity.approvedBy = approvedBy || null;
          entity.approvalReason = reason || null;
          entity.respondedAt = new Date();
        }
      }),
      findByStatus: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue({ entities: [], total: 0 }),
      delete: jest.fn().mockResolvedValue(true),
    };
    applyRepoMocks();
    const fakeDb = { query: jest.fn() };
    dm = new HealingDecisionMaker(undefined, undefined, fakeDb as any);
  });

  // ==================== getDecision ====================

  describe('getDecision', () => {
    describe('environment-based decisions', () => {
      it('should require manual approval for production', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'production',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
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
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('manual');
        expect(decision.requiresApproval).toBe(true);
      });

      it('should allow auto-heal for dev', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('auto');
        expect(decision.requiresApproval).toBe(false);
      });

      it('should allow auto-heal for staging', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'staging',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
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
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('manual');
        expect(decision.reason).toContain('below threshold');
      });

      it('should allow auto for confidence at threshold', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 70 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('auto');
      });

      it('should allow auto for confidence above threshold', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 100 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('auto');
      });

      it('should use custom threshold', async () => {
        const customDm = new HealingDecisionMaker(
          { autoHealConfidenceThreshold: 90 },
          undefined,
          ({ query: jest.fn() } as any)
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
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
          incidentType: 'pod_crash' as IncidentType,
          severity: 'critical' as IncidentSeverity,
        });

        expect(decision.type).toBe('manual');
        expect(decision.reason).toContain('Critical severity');
      });

      it('should allow auto for warning severity in dev', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('auto');
      });

      it('should allow auto for info severity in dev', async () => {
        const decision = await dm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'info' as IncidentSeverity,
        });

        expect(decision.type).toBe('auto');
      });
    });

    describe('disabled environments', () => {
      it('should require manual for disabled environment', async () => {
        const customDm = new HealingDecisionMaker(
          { disabledEnvironments: ['staging', 'qa'] },
          undefined,
          ({ query: jest.fn() } as any)
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'staging',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

        expect(decision.type).toBe('manual');
        expect(decision.requiresApproval).toBe(true);
        expect(decision.reason).toContain('disabled for environment');
      });
    });

    describe('disabled incident types', () => {
      it('should require manual for disabled incident type', async () => {
        const customDm = new HealingDecisionMaker(
          { disabledIncidentTypes: ['high_cpu', 'high_memory'] },
          undefined,
          ({ query: jest.fn() } as any)
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 95 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'high_cpu' as IncidentType,
          severity: 'warning' as IncidentSeverity,
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
          mockAssessor,
          ({ query: jest.fn() } as any)
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 90 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
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
          failingAssessor,
          ({ query: jest.fn() } as any)
        );

        const decision = await customDm.getDecision({
          strategy: createStrategy({ confidence: 85 }),
          appName: 'app',
          environment: 'dev',
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
        });

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
          incidentType: 'pod_crash' as IncidentType,
          severity: 'warning' as IncidentSeverity,
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
        incidentType: 'pod_crash' as IncidentType,
        severity: 'warning' as IncidentSeverity,
      });

      expect(result).toBe(true);
    });

    it('should return false for production', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 85 }),
        appName: 'app',
        environment: 'production',
        incidentType: 'pod_crash' as IncidentType,
        severity: 'warning' as IncidentSeverity,
      });

      expect(result).toBe(false);
    });

    it('should return false for low confidence', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 40 }),
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash' as IncidentType,
        severity: 'warning' as IncidentSeverity,
      });

      expect(result).toBe(false);
    });

    it('should return false for critical severity', async () => {
      const result = await dm.shouldAutoHeal({
        strategy: createStrategy({ confidence: 90 }),
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash' as IncidentType,
        severity: 'critical' as IncidentSeverity,
      });

      expect(result).toBe(false);
    });
  });

  // ==================== Approval Workflow ====================

  describe('createApprovalRequest', () => {
    beforeEach(() => {
      applyRepoMocks();
      // Override create to store entity and return camelCase entity
      repoMethods.create.mockImplementation(async (entity: any) => {
        storedEntities.set(entity.id, entity);
        // Return camelCase entity — what mapRowToEntity would produce
        return {
          id: entity.id,
          incidentId: entity.incidentId,
          title: entity.title,
          description: entity.description,
          riskLevel: entity.riskLevel,
          recommendedActions: entity.recommendedActions || [],
          status: entity.status,
          requestedBy: entity.requestedBy,
          requestedAt: entity.requestedAt,
          expiresAt: entity.expiresAt,
          approvedBy: null,
          approvalReason: null,
          respondedAt: null,
          tenantId: null,
          createdAt: entity.requestedAt || new Date(),
          updatedAt: entity.requestedAt || new Date(),
        };
      });

      // findById should return camelCase entity (what mapRowToEntity produces)
      repoMethods.findById.mockImplementation(async (id: string) => {
        const raw = storedEntities.get(id);
        if (!raw) return null;
        // Return camelCase entity — this is what mapRowToEntity produces
        return {
          id: raw.id,
          incidentId: raw.incidentId,
          title: raw.title,
          description: raw.description,
          riskLevel: raw.riskLevel,
          recommendedActions: raw.recommendedActions || [],
          status: raw.status,
          requestedBy: raw.requestedBy,
          requestedAt: raw.requestedAt,
          expiresAt: raw.expiresAt,
          approvedBy: raw.approvedBy || null,
          approvalReason: raw.approvalReason || null,
          respondedAt: raw.respondedAt || null,
          tenantId: raw.tenantId || null,
          createdAt: raw.requestedAt || new Date(),
          updatedAt: raw.updatedAt || new Date(),
        };
      });
    });

    it('should create a pending request with correct fields', async () => {
      const decision = {
        type: 'manual' as const,
        reason: 'Needs review',
        confidence: 80,
        riskLevel: 'high' as const,
        requiresApproval: true,
        recommendedActions: [{ type: 'restart' as const, params: { target: 'app' } }],
      };

      const request = await dm.createApprovalRequest({
        incidentId: 'inc-123',
        decision,
        appName: 'my-app',
        environment: 'production',
        incidentType: 'pod_crash' as IncidentType,
        requestedBy: 'admin',
      });

      expect(request.id).toBeDefined();
      expect(request.incidentId).toBe('inc-123');
      expect(request.title).toContain('pod_crash');
      expect(request.title).toContain('my-app');
      expect(request.riskLevel).toBe('high');
      expect(request.recommendedActions).toEqual(decision.recommendedActions);
      expect(request.status).toBe('pending');
      expect(request.requestedBy).toBe('admin');
      expect(request.requestedAt).toBeInstanceOf(Date);
      expect(request.expiresAt).toBeInstanceOf(Date);
    });

    it('should default requestedBy to system', async () => {
      const decision = {
        type: 'manual' as const,
        reason: 'Test',
        confidence: 80,
        riskLevel: 'low' as const,
        requiresApproval: true,
        recommendedActions: [],
      };

      const request = await dm.createApprovalRequest({
        incidentId: 'inc-1',
        decision,
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash' as IncidentType,
      });

      expect(request.requestedBy).toBe('system');
    });

    it('should set expiration based on config', async () => {
      const customDm = new HealingDecisionMaker(
        { approvalExpirationMs: 600000 },
        undefined,
        ({ query: jest.fn() } as any)
      );

      // Override the repository's findById to return a known entity
      jest.spyOn(HealingApprovalRequestRepository.prototype, 'findById').mockImplementation(async (id: string) => ({
        id,
        incidentId: 'inc-1',
        title: 'Test',
        description: 'Test',
        riskLevel: 'low',
        recommendedActions: [],
        status: 'pending',
        requestedBy: 'system',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        approvedBy: null,
        approvalReason: null,
        respondedAt: null,
        tenantId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const before = Date.now();
      const request = await customDm.createApprovalRequest({
        incidentId: 'inc-1',
        decision: { type: 'manual', reason: 'Test', confidence: 80, riskLevel: 'low', requiresApproval: true, recommendedActions: [] },
        appName: 'app',
        environment: 'dev',
        incidentType: 'pod_crash' as IncidentType,
      });

      const expiresMs = request.expiresAt!.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 600000);
    });
  });

  describe('respondToApproval', () => {
    let savedRequestId: string | null = null;

    beforeEach(() => {
      applyRepoMocks();

      // Reset storedEntities for this describe block
      storedEntities.clear();

      // Create a stored entity that can be found
      const storedEntity: any = {
        id: 'req-1',
        incidentId: 'inc-1',
        title: 'Test Approval',
        description: 'Test',
        riskLevel: 'high',
        recommendedActions: [],
        status: 'pending',
        requestedBy: 'system',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 300000),
        approvedBy: null,
        approvalReason: null,
        respondedAt: null,
        tenantId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // findById returns camelCase entity (what mapRowToEntity produces)
      repoMethods.findById.mockImplementation(async (id: string) => {
        if (id === 'req-1') {
          return {
            id: storedEntity.id,
            incidentId: storedEntity.incidentId,
            title: storedEntity.title,
            description: storedEntity.description,
            riskLevel: storedEntity.riskLevel,
            recommendedActions: storedEntity.recommendedActions,
            status: storedEntity.status,
            requestedBy: storedEntity.requestedBy,
            requestedAt: storedEntity.requestedAt,
            expiresAt: storedEntity.expiresAt,
            approvedBy: storedEntity.approvedBy,
            approvalReason: storedEntity.approvalReason,
            respondedAt: storedEntity.respondedAt,
            tenantId: storedEntity.tenantId,
            createdAt: storedEntity.createdAt,
            updatedAt: storedEntity.updatedAt,
          };
        }
        const raw = storedEntities.get(id);
        if (!raw) return null;
        return {
          id: raw.id,
          incidentId: raw.incidentId,
          title: raw.title,
          description: raw.description,
          riskLevel: raw.riskLevel,
          recommendedActions: raw.recommendedActions || [],
          status: raw.status,
          requestedBy: raw.requestedBy,
          requestedAt: raw.requestedAt,
          expiresAt: raw.expiresAt,
          approvedBy: raw.approvedBy || null,
          approvalReason: raw.approvalReason || null,
          respondedAt: raw.respondedAt || null,
          tenantId: raw.tenantId || null,
          createdAt: raw.requestedAt || new Date(),
          updatedAt: raw.updatedAt || new Date(),
        };
      });

      // updateStatus mutates storedEntity and returns camelCase entity
      repoMethods.updateStatus.mockImplementation(async (id: string, status: string, approvedBy?: string, reason?: string) => {
        const entity = storedEntities.get(id) || storedEntity;
        if (entity) {
          entity.status = status;
          entity.approvedBy = approvedBy || null;
          entity.approvalReason = reason || null;
          entity.respondedAt = new Date();
        }
        // Return camelCase entity
        return {
          id: entity.id,
          incidentId: entity.incidentId,
          title: entity.title,
          description: entity.description,
          riskLevel: entity.riskLevel,
          recommendedActions: entity.recommendedActions || [],
          status: entity.status,
          requestedBy: entity.requestedBy,
          requestedAt: entity.requestedAt,
          expiresAt: entity.expiresAt,
          approvedBy: entity.approvedBy,
          approvalReason: entity.approvalReason,
          respondedAt: entity.respondedAt,
          tenantId: entity.tenantId,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
      });
    });

    it('should approve a pending request', async () => {
      // Need to wait for the create to settle, then use the stored entity directly
      const result = await dm.respondToApproval('req-1', {
        approved: true,
        reason: 'Good to go',
        respondedBy: 'admin',
      });

      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('admin');
      expect(result.approvalReason).toBe('Good to go');
      expect(result.respondedAt).toBeInstanceOf(Date);
    });

    it('should reject a pending request', async () => {
      const result = await dm.respondToApproval('req-1', {
        approved: false,
        reason: 'Too risky',
        respondedBy: 'admin',
      });

      expect(result.status).toBe('rejected');
      expect(result.approvedBy).toBe('admin');
      expect(result.approvalReason).toBe('Too risky');
    });

    it('should throw for non-existent request', async () => {
      repoMethods.findById.mockResolvedValue(null);

      await expect(
        dm.respondToApproval('non-existent', {
          approved: true,
          respondedBy: 'admin',
        })
      ).rejects.toThrow('not found');
    });

    it('should throw for already-approved request', async () => {
      // First approve
      await dm.respondToApproval('req-1', {
        approved: true,
        respondedBy: 'admin',
      });

      // Now try to approve again
      repoMethods.findById.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        incident_id: 'inc-1',
        title: 'Test',
        description: 'Test',
        risk_level: 'high',
        recommended_actions: [],
        requested_by: 'system',
        requested_at: new Date(),
        expires_at: new Date(Date.now() + 300000),
        approved_by: 'admin',
        approval_reason: 'Good',
        responded_at: new Date(),
        tenant_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(
        dm.respondToApproval('req-1', {
          approved: false,
          respondedBy: 'admin2',
        })
      ).rejects.toThrow('not pending');
    });

    it('should throw for already-rejected request', async () => {
      await dm.respondToApproval('req-1', {
        approved: false,
        respondedBy: 'admin',
      });

      repoMethods.findById.mockResolvedValue({
        id: 'req-1',
        status: 'rejected',
        incident_id: 'inc-1',
        title: 'Test',
        description: 'Test',
        risk_level: 'high',
        recommended_actions: [],
        requested_by: 'system',
        requested_at: new Date(),
        expires_at: new Date(Date.now() + 300000),
        approved_by: 'admin',
        approval_reason: null,
        responded_at: new Date(),
        tenant_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      await expect(
        dm.respondToApproval('req-1', {
          approved: true,
          respondedBy: 'admin2',
        })
      ).rejects.toThrow('not pending');
    });
  });

  describe('getApprovalRequest', () => {
    beforeEach(() => {
      applyRepoMocks();
      repoMethods.findById.mockResolvedValue({
        id: 'req-1',
        incident_id: 'inc-1',
        title: 'Test',
        description: 'Test desc',
        risk_level: 'high',
        recommended_actions: [],
        status: 'pending',
        requested_by: 'system',
        requested_at: new Date(),
        expires_at: new Date(Date.now() + 300000),
        approved_by: null,
        approval_reason: null,
        responded_at: null,
        tenant_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should return request by ID', async () => {
      const found = await dm.getApprovalRequest('req-1');
      expect(found).toBeDefined();
      expect(found?.id).toBe('req-1');
    });

    it('should return undefined for non-existent request', async () => {
      repoMethods.findById.mockResolvedValue(null);
      const found = await dm.getApprovalRequest('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('getApprovalRequests', () => {
    beforeEach(() => {
      applyRepoMocks();
    });

    it('should return all requests', async () => {
      const entity1 = {
        id: 'r1', status: 'pending', incidentId: 'inc-1', title: 'T', description: 'D',
        riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
        requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
        approvedBy: null, approvalReason: null, respondedAt: null,
        tenantId: null, createdAt: new Date(), updatedAt: new Date(),
      };
      const entity2 = {
        ...entity1, id: 'r2', incidentId: 'inc-2',
      };
      repoMethods.findAll.mockResolvedValueOnce({
        entities: [entity1, entity2],
        total: 2,
      });

      const all = await dm.getApprovalRequests();
      expect(all.length).toBe(2);
    });

    it('should filter by pending status', async () => {
      const entity = {
        id: 'r1', status: 'pending', incidentId: 'inc-1', title: 'T', description: 'D',
        riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
        requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
        approvedBy: null, approvalReason: null, respondedAt: null,
        tenantId: null, createdAt: new Date(), updatedAt: new Date(),
      };
      repoMethods.findByStatus.mockResolvedValueOnce([entity]);

      const pending = await dm.getApprovalRequests('pending');
      expect(pending.length).toBe(1);
    });

    it('should filter after response', async () => {
      // Initially all pending via findAll
      repoMethods.findAll.mockResolvedValueOnce({
        entities: [
          {
            id: 'r1', status: 'pending', incidentId: 'inc-1', title: 'T', description: 'D',
            riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
            requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
            approvedBy: null, approvalReason: null, respondedAt: null,
            tenantId: null, createdAt: new Date(), updatedAt: new Date(),
          } as any,
          {
            id: 'r2', status: 'pending', incidentId: 'inc-2', title: 'T', description: 'D',
            riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
            requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
            approvedBy: null, approvalReason: null, respondedAt: null,
            tenantId: null, createdAt: new Date(), updatedAt: new Date(),
          } as any,
        ],
        total: 2,
      });

      const all = await dm.getApprovalRequests();
      expect(all.length).toBe(2);

      // Approve r1 - findById returns the entity, updateStatus returns approved
      repoMethods.findById.mockResolvedValueOnce({
        id: 'r1', status: 'pending', incidentId: 'inc-1', title: 'T', description: 'D',
        riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
        requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
        approvedBy: null, approvalReason: null, respondedAt: null,
        tenantId: null, createdAt: new Date(), updatedAt: new Date(),
      } as any);
      repoMethods.updateStatus.mockResolvedValueOnce({
        id: 'r1', status: 'approved', approvedBy: 'admin', approvalReason: 'Good',
        respondedAt: new Date(), incidentId: 'inc-1', title: 'T', description: 'D',
        riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
        requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
        tenantId: null, createdAt: new Date(), updatedAt: new Date(),
      } as any);

      await dm.respondToApproval('r1', { approved: true, respondedBy: 'admin' });

      // Now filter pending - should only return r2
      repoMethods.findByStatus.mockResolvedValueOnce([
        {
          id: 'r2', status: 'pending', incidentId: 'inc-2', title: 'T', description: 'D',
          riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
          requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
          approvedBy: null, approvalReason: null, respondedAt: null,
          tenantId: null, createdAt: new Date(), updatedAt: new Date(),
        } as any,
      ]);
      const pending = await dm.getApprovalRequests('pending');
      expect(pending.length).toBe(1);

      repoMethods.findByStatus.mockResolvedValueOnce([
        {
          id: 'r1', status: 'approved', approvedBy: 'admin', respondedAt: new Date(),
          incidentId: 'inc-1', title: 'T', description: 'D',
          riskLevel: 'high', recommendedActions: [], requestedBy: 'system',
          requestedAt: new Date(), expiresAt: new Date(Date.now() + 300000),
          approvalReason: 'Good', tenantId: null, createdAt: new Date(), updatedAt: new Date(),
        } as any,
      ]);
      const approved = await dm.getApprovalRequests('approved');
      expect(approved.length).toBe(1);
    });
  });

  describe('checkExpiredRequests', () => {
    it('should mark requests as expired when past expiration', async () => {
      // Create DM with 0ms expiry (already expired)
      const expiredDm = new HealingDecisionMaker(
        { approvalExpirationMs: 0 },
        undefined,
        ({ query: jest.fn() } as any)
      );

      applyRepoMocks();
      repoMethods.findByStatus.mockResolvedValueOnce([
        {
          id: 'r1',
          status: 'pending',
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        } as any,
      ]);

      const count = await expiredDm.checkExpiredRequests();
      expect(count).toBe(1);
      expect(repoMethods.updateStatus).toHaveBeenCalledWith('r1', 'expired');
    });

    it('should not mark non-expired requests', async () => {
      applyRepoMocks();
      repoMethods.findByStatus.mockResolvedValueOnce([
        {
          id: 'r1',
          status: 'pending',
          expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
        } as any,
      ]);

      const count = await dm.checkExpiredRequests();
      expect(count).toBe(0);
    });

    it('should not mark non-expired pending requests', async () => {
      applyRepoMocks();
      repoMethods.findByStatus.mockResolvedValueOnce([
        {
          id: 'r1',
          status: 'pending',
          expiresAt: new Date(Date.now() + 300000), // 5 min from now
        } as any,
      ]);

      const count = await dm.checkExpiredRequests();
      expect(count).toBe(0);
      expect(repoMethods.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('clearExpiredRequests', () => {
    it('should clear old responded requests', async () => {
      applyRepoMocks();
      repoMethods.findAll.mockResolvedValueOnce({
        entities: [
          {
            id: 'r1',
            status: 'approved',
            respondedAt: new Date(Date.now() - 7200000), // 2 hours ago
          } as any,
        ],
        total: 1,
      });

      await dm.clearExpiredRequests(-1); // Negative means all are "old"
      expect(repoMethods.delete).toHaveBeenCalledWith('r1');
    });

    it('should not clear recent responses', async () => {
      applyRepoMocks();
      repoMethods.findAll.mockResolvedValueOnce({
        entities: [
          {
            id: 'r1',
            status: 'approved',
            respondedAt: new Date(), // Just now
          } as any,
        ],
        total: 1,
      });

      // Clear with large maxAgeMs should keep everything
      await dm.clearExpiredRequests(3600000);
      expect(repoMethods.delete).not.toHaveBeenCalled();
    });
  });
});
