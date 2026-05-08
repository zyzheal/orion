/**
 * ApprovalGateService 单元测试
 */

import { ApprovalGateService, ApprovalStatus } from '../ApprovalGateService';

describe('ApprovalGateService', () => {
  let service: ApprovalGateService;

  beforeEach(() => {
    service = new ApprovalGateService();
  });

  describe('requestApproval', () => {
    it('should create a new approval request', async () => {
      const result = await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy to Production',
        approvers: ['user-1', 'user-2'],
        reason: 'Production deployment requires approval',
      });

      expect(result.id).toBeDefined();
      expect(result.runId).toBe('run-1');
      expect(result.stageId).toBe('stage-deploy');
      expect(result.stageName).toBe('Deploy to Production');
      expect(result.approvers).toEqual(['user-1', 'user-2']);
      expect(result.status).toBe('pending');
    });

    it('should return existing pending request if already requested', async () => {
      const first = await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      const second = await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-2'],
      });

      expect(first.id).toBe(second.id);
    });

    it('should throw if approvers is empty', async () => {
      await expect(
        service.requestApproval({
          runId: 'run-1',
          stageId: 'stage-deploy',
          stageName: 'Deploy',
          approvers: [],
        })
      ).rejects.toThrow('Missing required fields');
    });

    it('should use default reason if not provided', async () => {
      const result = await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      expect(result.reason).toBe('Approval required before proceeding');
    });
  });

  describe('approve', () => {
    it('should approve a pending request', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      const result = await service.approve('run-1', 'stage-deploy', 'user-1', 'Looks good');

      expect(result.status).toBe('approved');
      expect(result.respondedBy).toBe('user-1');
      expect(result.responseComment).toBe('Looks good');
      expect(result.respondedAt).toBeDefined();
    });

    it('should reject unauthorized approver', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      await expect(
        service.approve('run-1', 'stage-deploy', 'unauthorized-user')
      ).rejects.toThrow('is not authorized to approve');
    });

    it('should reject if no pending approval exists', async () => {
      await expect(
        service.approve('non-existent', 'stage', 'user-1')
      ).rejects.toThrow('No pending approval request');
    });

    it('should reject if already approved', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      await service.approve('run-1', 'stage-deploy', 'user-1');

      await expect(
        service.approve('run-1', 'stage-deploy', 'user-1')
      ).rejects.toThrow('already approved');
    });
  });

  describe('reject', () => {
    it('should reject a pending request', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      const result = await service.reject('run-1', 'stage-deploy', 'user-1', 'Not ready');

      expect(result.status).toBe('rejected');
      expect(result.respondedBy).toBe('user-1');
      expect(result.responseComment).toBe('Not ready');
    });

    it('should reject unauthorized user', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      await expect(
        service.reject('run-1', 'stage-deploy', 'unauthorized')
      ).rejects.toThrow('is not authorized to reject');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending approval request', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      const result = await service.cancel('run-1', 'stage-deploy');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('cancelled');
    });

    it('should return null for non-existent request', async () => {
      const result = await service.cancel('non-existent', 'stage');
      expect(result).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return approval status', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      const status = service.getStatus('run-1', 'stage-deploy');
      expect(status).not.toBeNull();
      expect(status!.status).toBe('pending');
    });

    it('should return null for non-existent request', () => {
      expect(service.getStatus('non-existent', 'stage')).toBeNull();
    });
  });

  describe('getByRun', () => {
    it('should return all approval requests for a run', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-1',
        stageName: 'Stage 1',
        approvers: ['user-1'],
      });
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-2',
        stageName: 'Stage 2',
        approvers: ['user-1'],
      });
      await service.requestApproval({
        runId: 'run-2',
        stageId: 'stage-1',
        stageName: 'Stage 1',
        approvers: ['user-1'],
      });

      const results = service.getByRun('run-1');
      expect(results.length).toBe(2);
      expect(results.map(r => r.stageId)).toContain('stage-1');
      expect(results.map(r => r.stageId)).toContain('stage-2');
    });
  });

  describe('isApprovalPending', () => {
    it('should return true for pending approval', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      expect(service.isApprovalPending('run-1', 'stage-deploy')).toBe(true);
    });

    it('should return false after approval', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      await service.approve('run-1', 'stage-deploy', 'user-1');

      expect(service.isApprovalPending('run-1', 'stage-deploy')).toBe(false);
    });
  });

  describe('isApproved', () => {
    it('should return true after approval', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      await service.approve('run-1', 'stage-deploy', 'user-1');

      expect(service.isApproved('run-1', 'stage-deploy')).toBe(true);
    });

    it('should return false for non-existent request', () => {
      expect(service.isApproved('non-existent', 'stage')).toBe(false);
    });
  });

  describe('isRejected', () => {
    it('should return true after rejection', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-deploy',
        stageName: 'Deploy',
        approvers: ['user-1'],
      });

      await service.reject('run-1', 'stage-deploy', 'user-1');

      expect(service.isRejected('run-1', 'stage-deploy')).toBe(true);
    });
  });

  describe('cleanupRun', () => {
    it('should remove all approval requests for a run', async () => {
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-1',
        stageName: 'Stage 1',
        approvers: ['user-1'],
      });
      await service.requestApproval({
        runId: 'run-1',
        stageId: 'stage-2',
        stageName: 'Stage 2',
        approvers: ['user-1'],
      });

      service.cleanupRun('run-1');

      expect(service.getByRun('run-1')).toEqual([]);
    });
  });
});
