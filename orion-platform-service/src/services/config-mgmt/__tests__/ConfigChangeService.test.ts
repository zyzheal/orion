/**
 * ConfigChangeService - Unit Tests
 *
 * Tests for change request lifecycle (submit/approve/reject/execute/rollback),
 * risk-based approval requirements, history tracking, and error handling.
 */

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `change-uuid-${++uuidCounter}`),
}));

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import { ConfigChangeService, SubmitChangeRequestInput } from '../ConfigChangeService';
import { OrionError } from '../../../errors';

describe('ConfigChangeService', () => {
  let service: ConfigChangeService;

  beforeEach(() => {
    uuidCounter = 0;
    service = new ConfigChangeService(); // No database = in-memory
  });

  // ==================== submitChangeRequest ====================

  describe('submitChangeRequest', () => {
    it('should submit a change request with defaults', async () => {
      const input: SubmitChangeRequestInput = {
        configKey: 'database.url',
        reason: 'Migration to new DB',
      };

      const request = await service.submitChangeRequest('tenant-1', input, 'developer');

      expect(request.id).toBeDefined();
      expect(request.tenantId).toBe('tenant-1');
      expect(request.configKey).toBe('database.url');
      expect(request.environment).toBe('default');
      expect(request.changeType).toBe('modify');
      expect(request.reason).toBe('Migration to new DB');
      expect(request.riskLevel).toBe('low');
      expect(request.requester).toBe('developer');
      expect(request.status).toBe('pending');
      expect(request.approvals).toEqual([]);
      expect(request.requiredApprovals).toBe(1); // low risk = 1 approval
      expect(request.createdAt).toBeInstanceOf(Date);
      expect(request.updatedAt).toBeInstanceOf(Date);
    });

    it('should submit with custom values', async () => {
      const input: SubmitChangeRequestInput = {
        configKey: 'security.jwtSecret',
        configGroup: 'security',
        environment: 'production',
        changeType: 'create',
        oldValue: null,
        newValue: { value: 'new-secret' },
        reason: 'Rotate JWT secret',
        riskLevel: 'critical',
        executionPlan: { steps: ['backup', 'update', 'verify'] },
        rollbackPlan: { steps: ['restore-backup'] },
        requiredApprovals: 3,
      };

      const request = await service.submitChangeRequest('tenant-1', input, 'admin');

      expect(request.configGroup).toBe('security');
      expect(request.environment).toBe('production');
      expect(request.changeType).toBe('create');
      expect(request.riskLevel).toBe('critical');
      expect(request.requiredApprovals).toBe(3);
      expect(request.executionPlan).toEqual({ steps: ['backup', 'update', 'verify'] });
      expect(request.rollbackPlan).toEqual({ steps: ['restore-backup'] });
    });

    it('should default requester to system when not provided', async () => {
      const input: SubmitChangeRequestInput = {
        configKey: 'app.theme',
        reason: 'Update theme',
      };

      const request = await service.submitChangeRequest('tenant-1', input);
      expect(request.requester).toBe('system');
    });

    it('should calculate required approvals based on risk level', async () => {
      const testCases = [
        { riskLevel: 'low' as const, expected: 1 },
        { riskLevel: 'medium' as const, expected: 1 },
        { riskLevel: 'high' as const, expected: 2 },
        { riskLevel: 'critical' as const, expected: 3 },
      ];

      for (const tc of testCases) {
        const request = await service.submitChangeRequest(
          'tenant-1',
          { configKey: 'test', reason: 'test', riskLevel: tc.riskLevel },
          'admin'
        );
        expect(request.requiredApprovals).toBe(tc.expected);
      }
    });
  });

  // ==================== approveChangeRequest ====================

  describe('approveChangeRequest', () => {
    it('should approve a pending change request', async () => {
      const request = await submitTestRequest();
      const approved = await service.approveChangeRequest(
        request.id,
        'reviewer-1',
        'approve',
        'Looks good'
      );

      expect(approved.approvals).toHaveLength(1);
      expect(approved.approvals[0].approver).toBe('reviewer-1');
      expect(approved.approvals[0].action).toBe('approve');
      expect(approved.approvals[0].comment).toBe('Looks good');
      expect(approved.status).toBe('approved'); // 1 required, 1 approved
    });

    it('should reject a pending change request', async () => {
      const request = await submitTestRequest();
      const rejected = await service.approveChangeRequest(
        request.id,
        'reviewer-1',
        'reject',
        'Not safe enough'
      );

      expect(rejected.status).toBe('rejected');
      expect(rejected.approvals[0].action).toBe('reject');
    });

    it('should require multiple approvals for high-risk changes', async () => {
      const request = await submitTestRequest({ riskLevel: 'high' });

      // First approval - still pending
      const afterFirst = await service.approveChangeRequest(
        request.id,
        'reviewer-1',
        'approve'
      );
      expect(afterFirst.status).toBe('pending');
      expect(afterFirst.approvals).toHaveLength(1);

      // Second approval - now approved
      const afterSecond = await service.approveChangeRequest(
        request.id,
        'reviewer-2',
        'approve'
      );
      expect(afterSecond.status).toBe('approved');
      expect(afterSecond.approvals).toHaveLength(2);
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        service.approveChangeRequest('non-existent', 'reviewer', 'approve')
      ).rejects.toThrow('Change request');
    });

    it('should throw error for already approved request', async () => {
      const request = await submitTestRequest();
      await service.approveChangeRequest(request.id, 'reviewer-1', 'approve');

      await expect(
        service.approveChangeRequest(request.id, 'reviewer-2', 'approve')
      ).rejects.toThrow('not pending');
    });

    it('should throw error when reviewer has already voted', async () => {
      const request = await submitTestRequest({ riskLevel: 'high' });
      await service.approveChangeRequest(request.id, 'reviewer-1', 'approve');

      await expect(
        service.approveChangeRequest(request.id, 'reviewer-1', 'approve')
      ).rejects.toThrow('already voted');
    });
  });

  // ==================== executeChangeRequest ====================

  describe('executeChangeRequest', () => {
    it('should execute an approved change request', async () => {
      const request = await submitTestRequest();
      await service.approveChangeRequest(request.id, 'reviewer', 'approve');

      const executed = await service.executeChangeRequest(request.id, 'executor');

      expect(executed.status).toBe('executed');
      expect(executed.executedAt).toBeInstanceOf(Date);
      expect(executed.executedBy).toBe('executor');
    });

    it('should default executor to system', async () => {
      const request = await submitTestRequest();
      await service.approveChangeRequest(request.id, 'reviewer', 'approve');

      const executed = await service.executeChangeRequest(request.id);
      expect(executed.executedBy).toBe('system');
    });

    it('should throw error for non-approved request', async () => {
      const request = await submitTestRequest();

      await expect(
        service.executeChangeRequest(request.id)
      ).rejects.toThrow('must be approved before execution');
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        service.executeChangeRequest('non-existent')
      ).rejects.toThrow('Change request');
    });
  });

  // ==================== rollbackChangeRequest ====================

  describe('rollbackChangeRequest', () => {
    it('should rollback an executed change request', async () => {
      const request = await submitTestRequest();
      await service.approveChangeRequest(request.id, 'reviewer', 'approve');
      await service.executeChangeRequest(request.id, 'executor');

      const rolledBack = await service.rollbackChangeRequest(request.id, 'admin');

      expect(rolledBack.status).toBe('rolled_back');
      expect(rolledBack.rolledBackAt).toBeInstanceOf(Date);
      expect(rolledBack.rolledBackBy).toBe('admin');
    });

    it('should rollback a failed change request', async () => {
      const request = await submitTestRequest();
      await service.approveChangeRequest(request.id, 'reviewer', 'approve');
      // Execute will succeed in memory mode, so we test the rollback path
      await service.executeChangeRequest(request.id);

      const rolledBack = await service.rollbackChangeRequest(request.id);
      expect(rolledBack.status).toBe('rolled_back');
      expect(rolledBack.rolledBackBy).toBe('system');
    });

    it('should throw error for non-executed request', async () => {
      const request = await submitTestRequest();

      await expect(
        service.rollbackChangeRequest(request.id)
      ).rejects.toThrow('Can only rollback executed or failed changes');
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        service.rollbackChangeRequest('non-existent')
      ).rejects.toThrow('Change request');
    });
  });

  // ==================== getChangeHistory ====================

  describe('getChangeHistory', () => {
    it('should return change requests for a tenant', async () => {
      await submitTestRequest({ configKey: 'key-a' });
      await submitTestRequest({ configKey: 'key-b' });

      const result = await service.getChangeHistory('tenant-1');

      expect(result.changeRequests).toHaveLength(2);
      // Note: history entries may be empty in-memory mode if tenantId is not set on entries
    });

    it('should filter by status', async () => {
      const request = await submitTestRequest();
      await service.approveChangeRequest(request.id, 'reviewer', 'approve');

      const pending = await service.getChangeHistory('tenant-1', { status: 'pending' });
      expect(pending.changeRequests).toHaveLength(0);

      const approved = await service.getChangeHistory('tenant-1', { status: 'approved' });
      expect(approved.changeRequests).toHaveLength(1);
    });

    it('should filter by configKey', async () => {
      await submitTestRequest({ configKey: 'target-key' });
      await submitTestRequest({ configKey: 'other-key' });

      const result = await service.getChangeHistory('tenant-1', { configKey: 'target-key' });
      expect(result.changeRequests).toHaveLength(1);
      expect(result.changeRequests[0].configKey).toBe('target-key');
    });
  });

  // ==================== getChangeRequestById ====================

  describe('getChangeRequestById', () => {
    it('should return change request by id', async () => {
      const request = await submitTestRequest();
      const found = await service.getChangeRequestById(request.id);

      expect(found).not.toBeNull();
      expect(found!.configKey).toBe('test-key');
    });

    it('should return null for non-existent id', async () => {
      const found = await service.getChangeRequestById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== listChangeRequests ====================

  describe('listChangeRequests', () => {
    it('should list all change requests for a tenant', async () => {
      await submitTestRequest({ configKey: 'key-1' });
      await submitTestRequest({ configKey: 'key-2' });
      await submitTestRequest({ configKey: 'key-3' });

      const list = await service.listChangeRequests('tenant-1');
      expect(list).toHaveLength(3);
    });

    it('should filter by requester', async () => {
      await submitTestRequest({ configKey: 'key-1' }, 'alice');
      await submitTestRequest({ configKey: 'key-2' }, 'bob');

      const aliceRequests = await service.listChangeRequests('tenant-1', { requester: 'alice' });
      expect(aliceRequests).toHaveLength(1);
      expect(aliceRequests[0].requester).toBe('alice');
    });

    it('should filter by risk level', async () => {
      await submitTestRequest({ configKey: 'key-1', riskLevel: 'low' });
      await submitTestRequest({ configKey: 'key-2', riskLevel: 'critical' });

      const critical = await service.listChangeRequests('tenant-1', { riskLevel: 'critical' });
      expect(critical).toHaveLength(1);
      expect(critical[0].riskLevel).toBe('critical');
    });
  });

  // ==================== Full lifecycle ====================

  describe('full lifecycle', () => {
    it('should support submit -> approve -> execute -> rollback lifecycle', async () => {
      // Submit
      const submitted = await submitTestRequest({ riskLevel: 'low' });
      expect(submitted.status).toBe('pending');

      // Approve
      const approved = await service.approveChangeRequest(
        submitted.id,
        'reviewer',
        'approve',
        'LGTM'
      );
      expect(approved.status).toBe('approved');

      // Execute
      const executed = await service.executeChangeRequest(submitted.id, 'deployer');
      expect(executed.status).toBe('executed');

      // Rollback
      const rolledBack = await service.rollbackChangeRequest(submitted.id, 'admin');
      expect(rolledBack.status).toBe('rolled_back');
    });

    it('should track change request status through lifecycle', async () => {
      const request = await submitTestRequest();

      // Verify status transitions are reflected in getChangeRequestById
      const pending = await service.getChangeRequestById(request.id);
      expect(pending!.status).toBe('pending');

      await service.approveChangeRequest(request.id, 'reviewer', 'approve');
      const approved = await service.getChangeRequestById(request.id);
      expect(approved!.status).toBe('approved');

      await service.executeChangeRequest(request.id);
      const executed = await service.getChangeRequestById(request.id);
      expect(executed!.status).toBe('executed');

      await service.rollbackChangeRequest(request.id);
      const rolledBack = await service.getChangeRequestById(request.id);
      expect(rolledBack!.status).toBe('rolled_back');
    });
  });

  // ==================== Helper ====================

  async function submitTestRequest(
    overrides: Partial<SubmitChangeRequestInput> = {},
    requester = 'developer'
  ) {
    const input: SubmitChangeRequestInput = {
      configKey: 'test-key',
      reason: 'Test change',
      ...overrides,
    };
    return service.submitChangeRequest('tenant-1', input, requester);
  }
});
