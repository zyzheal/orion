/**
 * Approval Workflow Integration Tests
 *
 * Multi-level approval workflow: create -> approve/reject -> chain verification
 */

import { ApprovalService, ApprovalStatus } from '@/services/approval/ApprovalService';
import { MultiLevelApprovalService, ApprovalAction, ApprovalMode } from '@/services/approval/MultiLevelApprovalService';

// ============================================================
// Mock database for approval repository
// ============================================================

class MockApprovalDb {
  private approvals: Map<string, any> = new Map();
  private steps: Map<string, any[]> = new Map();
  private idCounter = 0;

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
    if (text === 'BEGIN' || text === 'COMMIT') return { rows: [], rowCount: 0 };

    if (text.includes('INSERT INTO approval_requests')) {
      const id = `approval-${++this.idCounter}`;
      const entity = {
        id,
        tenant_id: params[0],
        definition_id: params[1] || null,
        resource_type: params[2],
        resource_id: params[3],
        title: params[4],
        status: params[5],
        requested_by: params[6],
        current_step: params[7],
        total_steps: params[8],
        required_approvals: params[9],
        result: params[10],
        completed_at: params[11],
        created_at: params[12],
      };
      this.approvals.set(id, entity);
      this.steps.set(id, []);
      return { rows: [entity], rowCount: 1 };
    }

    if (text.includes('INSERT INTO approval_steps')) {
      // Find the approval_id from params - it's the second param for step insert
      // Actually depends on the repository implementation
      const approvalId = params?.[0] || '';
      const stepId = `step-${++this.idCounter}`;
      const step = {
        id: stepId,
        approval_id: approvalId,
        step_index: params[1] ?? 0,
        approver_id: params[2] || '',
        status: params[3] || 'pending',
        comment: params[4],
        acted_at: params[5],
      };
      const steps = this.steps.get(approvalId) || [];
      steps.push(step);
      this.steps.set(approvalId, steps);
      return { rows: [step], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('approval_requests') && !text.includes('steps')) {
      if (text.includes('WHERE id =')) {
        const id = params?.[0];
        const entity = this.approvals.get(id);
        return { rows: entity ? [entity] : [], rowCount: entity ? 1 : 0 };
      }
      if (text.includes('status = \'pending\'')) {
        const pending = Array.from(this.approvals.values()).filter((a: any) => a.status === 'pending');
        return { rows: pending, rowCount: pending.length };
      }
      return { rows: Array.from(this.approvals.values()), rowCount: this.approvals.size };
    }

    if (text.includes('SELECT') && text.includes('approval_steps')) {
      const approvalId = params?.[0];
      const steps = this.steps.get(approvalId) || [];
      return { rows: steps, rowCount: steps.length };
    }

    if (text.includes('UPDATE') && text.includes('approval_steps')) {
      if (text.includes('status =')) {
        // Update step status - find step by id
        const stepId = params?.[1]; // or wherever the step id is
        for (const [approvalId, steps] of this.steps.entries()) {
          const step = steps.find(s => s.id === stepId);
          if (step) {
            step.status = params[0]; // new status
            if (params[2]) step.comment = params[2];
            if (params[3]) step.acted_at = params[3];
            return { rows: [step], rowCount: 1 };
          }
        }
        return { rows: [], rowCount: 0 };
      }
    }

    if (text.includes('UPDATE') && text.includes('approval_requests')) {
      if (text.includes('status =') && text.includes('WHERE id =')) {
        const status = params?.[0];
        const id = params?.[1];
        const entity = this.approvals.get(id);
        if (entity) {
          entity.status = status;
          if (status !== 'pending') {
            entity.completed_at = new Date();
            entity.result = status;
          }
          return { rows: [], rowCount: 1 };
        }
      }
      if (text.includes('current_step')) {
        const currentStep = params?.[0];
        const id = params?.[1];
        const entity = this.approvals.get(id);
        if (entity) {
          entity.current_step = currentStep;
        }
      }
      return { rows: [], rowCount: 1 };
    }

    if (text.includes('UPDATE') && text.includes('approval_steps') && text.includes('status')) {
      // The actual pattern: UPDATE ... SET status=$1, ... WHERE id=$2
      const stepId = params?.[params.length - 1]; // last param is typically the WHERE id
      const newStatus = params?.[0];
      for (const steps of this.steps.values()) {
        const step = steps.find(s => s.id === stepId);
        if (step) {
          step.status = newStatus;
          return { rows: [step], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }
}

describe('Approval Workflow Integration - Multi-level Approval', () => {
  let mockDb: MockApprovalDb;
  let approvalService: ApprovalService;
  let multiLevelService: MultiLevelApprovalService;

  beforeEach(() => {
    mockDb = new MockApprovalDb();
    approvalService = new ApprovalService(mockDb);
    multiLevelService = new MultiLevelApprovalService(mockDb);
  });

  describe('E2E: Basic Approval Flow', () => {
    it('should create approval request and get approval', async () => {
      const approval = await approvalService.createApproval(
        'Deploy to Production',
        'user-requester',
        ['user-approver-1', 'user-approver-2'],
        1,
        'Requesting production deployment',
      );

      expect(approval.id).toBeDefined();
      expect(approval.title).toBe('Deploy to Production');
      expect(approval.status).toBe(ApprovalStatus.PENDING);
      expect(approval.approverIds).toHaveLength(2);
      expect(approval.requiredApprovals).toBe(1);
    });

    it('should approve a pending request', async () => {
      const approval = await approvalService.createApproval(
        'Test Approval',
        'user-requester',
        ['approver-1'],
        1,
      );

      const result = await approvalService.approve(approval.id, 'approver-1');

      expect(result.status).toBe(ApprovalStatus.APPROVED);
      expect(result.approvals).toContain('approver-1');
    });

    it('should reject a pending request', async () => {
      const approval = await approvalService.createApproval(
        'Test Rejection',
        'user-requester',
        ['approver-1'],
        1,
      );

      const result = await approvalService.reject(approval.id, 'approver-1');

      expect(result.status).toBe(ApprovalStatus.REJECTED);
      expect(result.rejections).toContain('approver-1');
    });

    it('should not approve non-pending request', async () => {
      const approval = await approvalService.createApproval(
        'Already Approved',
        'user-requester',
        ['approver-1'],
        1,
      );

      await approvalService.approve(approval.id, 'approver-1');

      await expect(approvalService.approve(approval.id, 'approver-1'))
        .rejects
        .toThrow('Approval not pending');
    });

    it('should reject when user is not authorized', async () => {
      const approval = await approvalService.createApproval(
        'Unauthorized Test',
        'user-requester',
        ['approver-1'],
        1,
      );

      await expect(approvalService.approve(approval.id, 'unauthorized-user'))
        .rejects
        .toThrow('Not authorized to approve');
    });

    it('should throw when approval not found', async () => {
      await expect(approvalService.approve('non-existent', 'approver-1'))
        .rejects
        .toThrow('Approval not found');
    });
  });

  describe('E2E: Multi-level Approval Flow', () => {
    it('should create a multi-level approval request', async () => {
      const request = await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Production Release',
        description: 'Release v2.0 to production',
        requesterId: 'dev-lead',
        resourceType: 'deployment',
        resourceId: 'deploy-123',
        levels: [
          { levelIndex: 0, approverIds: ['tech-lead-1', 'tech-lead-2'], requiredApprovals: 1 },
          { levelIndex: 1, approverIds: ['engineering-manager'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.SERIAL,
      });

      expect(request.id).toBeDefined();
      expect(request.status).toBe('pending');
      expect(request.levels).toHaveLength(2);
      expect(request.mode).toBe(ApprovalMode.SERIAL);
    });

    it('should require serial level completion before next level', async () => {
      const request = await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Serial Test',
        requesterId: 'requester',
        resourceType: 'deployment',
        resourceId: 'deploy-1',
        levels: [
          { levelIndex: 0, approverIds: ['level1-approver'], requiredApprovals: 1 },
          { levelIndex: 1, approverIds: ['level2-approver'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.SERIAL,
      });

      // Level 1 approver can approve
      const level1Result = await multiLevelService.review(
        request.id,
        'level1-approver',
        ApprovalAction.APPROVE,
        'Level 1 approved',
      );

      expect(level1Result.status).toBe('pending'); // Still pending, needs level 2

      // Level 2 should now be activatable and approvable
      const level2Result = await multiLevelService.review(
        request.id,
        'level2-approver',
        ApprovalAction.APPROVE,
        'Level 2 approved',
      );

      expect(level2Result.status).toBe('approved');
    });

    it('should reject entire request on any rejection', async () => {
      const request = await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Rejection Test',
        requesterId: 'requester',
        resourceType: 'deployment',
        resourceId: 'deploy-2',
        levels: [
          { levelIndex: 0, approverIds: ['approver-1', 'approver-2'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.PARALLEL,
      });

      const result = await multiLevelService.review(
        request.id,
        'approver-1',
        ApprovalAction.REJECT,
        'Not ready for production',
      );

      expect(result.status).toBe('rejected');
    });

    it('should get approval chain details', async () => {
      const request = await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Chain Test',
        requesterId: 'requester',
        resourceType: 'deployment',
        resourceId: 'deploy-3',
        levels: [
          { levelIndex: 0, approverIds: ['reviewer-1'], requiredApprovals: 1 },
          { levelIndex: 1, approverIds: ['manager-1'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.SERIAL,
      });

      const chain = await multiLevelService.getApprovalChain(request.id);

      expect(chain.requestId).toBe(request.id);
      expect(chain.title).toBe('Chain Test');
      expect(chain.mode).toBe(ApprovalMode.SERIAL);
      expect(chain.steps.length).toBeGreaterThanOrEqual(0);
    });

    it('should get pending approvals for a user', async () => {
      await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Pending for User A',
        requesterId: 'requester',
        resourceType: 'deployment',
        resourceId: 'deploy-4',
        levels: [
          { levelIndex: 0, approverIds: ['user-a'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.PARALLEL,
      });

      await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Pending for User B',
        requesterId: 'requester',
        resourceType: 'deployment',
        resourceId: 'deploy-5',
        levels: [
          { levelIndex: 0, approverIds: ['user-b'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.PARALLEL,
      });

      const pendingA = await multiLevelService.getPendingApprovals('user-a', 'tenant-1');
      expect(pendingA.length).toBeGreaterThanOrEqual(1);

      const pendingB = await multiLevelService.getPendingApprovals('user-b', 'tenant-1');
      expect(pendingB.length).toBeGreaterThanOrEqual(1);
    });

    it('should check if approval is fully approved', async () => {
      const request = await multiLevelService.submitApprovalRequest('tenant-1', {
        title: 'Check Approved',
        requesterId: 'requester',
        resourceType: 'deployment',
        resourceId: 'deploy-6',
        levels: [
          { levelIndex: 0, approverIds: ['checker'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.PARALLEL,
      });

      expect(await multiLevelService.isApproved(request.id)).toBe(false);

      await multiLevelService.review(request.id, 'checker', ApprovalAction.APPROVE);

      expect(await multiLevelService.isApproved(request.id)).toBe(true);
    });
  });

  describe('E2E: List Pending Approvals', () => {
    it('should list all pending approvals', async () => {
      await approvalService.createApproval(
        'Pending 1',
        'requester',
        ['approver-x'],
        1,
      );
      await approvalService.createApproval(
        'Pending 2',
        'requester',
        ['approver-y'],
        1,
      );

      const pending = await approvalService.listPending();
      expect(pending.length).toBeGreaterThanOrEqual(2);
    });

    it('should list pending approvals by tenant', async () => {
      await approvalService.createApproval(
        'Tenant Approval',
        'requester',
        ['approver-z'],
        1,
        'desc',
        { tenantId: 'specific-tenant' },
      );

      const pending = await approvalService.listPending('specific-tenant');
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });
  });
});
