/**
 * ApprovalGateService Tests
 *
 * Tests for Pipeline approval gate functionality.
 */

import { ApprovalGateService } from '../ApprovalGateService';
import { ApprovalGateRepository, ApprovalGateEntity } from '../../../repositories/ApprovalGateRepository';

// Mock repository
const createMockRepository = () => {
  const gates: Map<string, ApprovalGateEntity> = new Map();

  return {
    repository: {
      create: jest.fn(async (input: any) => {
        const entity: ApprovalGateEntity = {
          id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          tenantId: input.tenantId,
          runId: input.runId,
          stageId: input.stageId,
          status: 'pending',
          requestedBy: input.requestedBy,
          requestedAt: new Date(),
          approverIds: input.approverIds,
          metadata: input.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        gates.set(entity.id, entity);
        return entity;
      }),
      findById: jest.fn(async (id: string) => gates.get(id) || null),
      findByRunId: jest.fn(async (runId: string) =>
        Array.from(gates.values()).filter(g => g.runId === runId)
      ),
      findByRunAndStage: jest.fn(async (runId: string, stageId: string) => {
        const found = Array.from(gates.values()).find(
          g => g.runId === runId && g.stageId === stageId
        );
        return found || null;
      }),
      findPendingByApprover: jest.fn(async (approverId: string, tenantId: string) =>
        Array.from(gates.values()).filter(
          g => g.tenantId === tenantId && g.status === 'pending' && g.approverIds.includes(approverId)
        )
      ),
      update: jest.fn(async (id: string, input: any) => {
        const existing = gates.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...input, updatedAt: new Date() };
        gates.set(id, updated);
        return updated;
      }),
      isApprovalRequired: jest.fn(async (runId: string, stageId: string) => {
        return Array.from(gates.values()).some(
          g => g.runId === runId && g.stageId === stageId && g.status === 'pending'
        );
      }),
    } as unknown as ApprovalGateRepository,
    gates,
  };
};

describe('ApprovalGateService', () => {
  let service: ApprovalGateService;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new ApprovalGateService(mockRepo.repository);
  });

  describe('requestApproval', () => {
    it('should create a new approval gate', async () => {
      const result = await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        stageName: 'deploy',
        approvers: ['user1', 'user2'],
        reason: 'Need approval for deployment',
        tenantId: 'tenant-1',
      });

      expect(result).toBeDefined();
      expect(result.runId).toBe('run-123');
      expect(result.stageId).toBe('stage-456');
      expect(result.status).toBe('pending');
      expect(result.approverIds).toEqual(['user1', 'user2']);
    });

    it('should use default tenant when not provided', async () => {
      const result = await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
      });

      expect(result.tenantId).toBe('__system__');
    });
  });

  describe('getStatus', () => {
    it('should return undefined when no gate exists', async () => {
      const result = await service.getStatus('run-123', 'stage-456');
      expect(result).toBeUndefined();
    });

    it('should return correct status for pending gate', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      const result = await service.getStatus('run-123', 'stage-456');
      expect(result).toBeDefined();
      expect(result?.status).toBe('pending');
      expect(result?.canProceed).toBe(false);
      expect(result?.message).toContain('Pending approval');
    });
  });

  describe('approve', () => {
    it('should approve a pending gate', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      const result = await service.approve('run-123', 'stage-456', 'user1', 'Approved!');

      expect(result.status).toBe('approved');
      expect(result.reviewedBy).toBe('user1');
      expect(result.comment).toBe('Approved!');
    });

    it('should throw when gate not found', async () => {
      await expect(
        service.approve('run-none', 'stage-none', 'user1')
      ).rejects.toThrow('No pending approval request found');
    });

    it('should throw when status is not pending', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      await service.approve('run-123', 'stage-456', 'user1');

      await expect(
        service.approve('run-123', 'stage-456', 'user1')
      ).rejects.toThrow('Approval is approved, not pending');
    });

    it('should throw when user is not authorized', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      await expect(
        service.approve('run-123', 'stage-456', 'unauthorized-user')
      ).rejects.toThrow('Not authorized to approve');
    });
  });

  describe('reject', () => {
    it('should reject a pending gate', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      const result = await service.reject('run-123', 'stage-456', 'user1', 'Not ready');

      expect(result.status).toBe('rejected');
      expect(result.reviewedBy).toBe('user1');
      expect(result.comment).toBe('Not ready');
    });
  });

  describe('cancelGate', () => {
    it('should cancel an existing gate', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      await service.cancelGate('run-123', 'stage-456');

      const result = await service.getStatus('run-123', 'stage-456');
      expect(result?.status).toBe('cancelled');
    });

    it('should do nothing when gate not found', async () => {
      await expect(service.cancelGate('run-none', 'stage-none')).resolves.not.toThrow();
    });
  });

  describe('isApprovalRequired', () => {
    it('should return true when pending gate exists', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      const result = await service.isApprovalRequired('run-123', 'stage-456');
      expect(result).toBe(true);
    });

    it('should return false when no pending gate', async () => {
      const result = await service.isApprovalRequired('run-123', 'stage-456');
      expect(result).toBe(false);
    });
  });

  describe('getByRun', () => {
    it('should return all gates for a run', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-1',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-2',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      const result = await service.getByRun('run-123');
      expect(result).toHaveLength(2);
    });
  });

  describe('getPendingByApprover', () => {
    it('should return pending gates for approver', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1', 'user2'],
        tenantId: 'tenant-1',
      });

      const result = await service.getPendingByApprover('user1', 'tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].approverIds).toContain('user1');
    });

    it('should not return gates for other tenants', async () => {
      await service.requestApproval({
        runId: 'run-123',
        stageId: 'stage-456',
        approvers: ['user1'],
        tenantId: 'tenant-1',
      });

      const result = await service.getPendingByApprover('user1', 'tenant-2');
      expect(result).toHaveLength(0);
    });
  });
});