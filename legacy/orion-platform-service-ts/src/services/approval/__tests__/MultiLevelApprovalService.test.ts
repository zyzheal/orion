/**
 * Tests for MultiLevelApprovalService
 */
import { MultiLevelApprovalService, ApprovalAction, ApprovalMode } from '../MultiLevelApprovalService';

const mockCreate = jest.fn();
const mockFindById = jest.fn();
const mockFindStepsByApproval = jest.fn();
const mockUpdateStepStatus = jest.fn();
const mockUpdateStatus = jest.fn();
const mockCreateStep = jest.fn();
const mockAdvanceStep = jest.fn();
const mockFindPendingByTenant = jest.fn();

jest.mock('../../../repositories/ApprovalRepository', () => ({
  ApprovalRepository: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    findById: mockFindById,
    findStepsByApproval: mockFindStepsByApproval,
    updateStepStatus: mockUpdateStepStatus,
    updateStatus: mockUpdateStatus,
    createStep: mockCreateStep,
    advanceStep: mockAdvanceStep,
    findPendingByTenant: mockFindPendingByTenant,
  })),
}));

describe('MultiLevelApprovalService', () => {
  let service: MultiLevelApprovalService;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MultiLevelApprovalService(mockDb);
  });

  describe('submitApprovalRequest', () => {
    it('should create multi-level approval request', async () => {
      mockCreate.mockResolvedValue({
        id: 'approval-1',
        tenantId: 'tenant-1',
        status: 'pending',
        currentStep: 0,
        totalSteps: 3,
        requiredApprovals: 2,
        createdAt: new Date(),
      });
      mockCreateStep.mockResolvedValue({ id: 'step-1' });

      const result = await service.submitApprovalRequest('tenant-1', {
        title: 'Deploy to prod',
        requesterId: 'user1',
        resourceType: 'deployment',
        resourceId: 'deploy-1',
        levels: [
          { levelIndex: 0, approverIds: ['approver1', 'approver2'], requiredApprovals: 1 },
          { levelIndex: 1, approverIds: ['approver3'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.SERIAL,
      });

      expect(result.id).toBe('approval-1');
      expect(result.mode).toBe(ApprovalMode.SERIAL);
      expect(mockCreateStep).toHaveBeenCalledTimes(3);
    });

    it('should default to serial mode', async () => {
      mockCreate.mockResolvedValue({
        id: 'approval-1',
        tenantId: 'tenant-1',
        status: 'pending',
        createdAt: new Date(),
      });
      mockCreateStep.mockResolvedValue({ id: 'step-1' });

      const result = await service.submitApprovalRequest('tenant-1', {
        title: 'Test',
        requesterId: 'user1',
        resourceType: 'generic',
        resourceId: 'res-1',
        levels: [
          { levelIndex: 0, approverIds: ['approver1'], requiredApprovals: 1 },
        ],
      });

      expect(result.mode).toBe(ApprovalMode.SERIAL);
    });

    it('should set waiting status for serial mode higher levels', async () => {
      mockCreate.mockResolvedValue({
        id: 'approval-1',
        tenantId: 'tenant-1',
        status: 'pending',
        createdAt: new Date(),
      });
      mockCreateStep.mockResolvedValue({ id: 'step-1' });

      await service.submitApprovalRequest('tenant-1', {
        title: 'Test',
        requesterId: 'user1',
        resourceType: 'generic',
        resourceId: 'res-1',
        levels: [
          { levelIndex: 0, approverIds: ['approver1'], requiredApprovals: 1 },
          { levelIndex: 1, approverIds: ['approver2'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.SERIAL,
      });

      // First level should be pending, second should be waiting
      const calls = mockCreateStep.mock.calls;
      expect(calls[0][0].status).toBe('pending');
      expect(calls[1][0].status).toBe('waiting');
    });

    it('should set all steps to pending in parallel mode', async () => {
      mockCreate.mockResolvedValue({
        id: 'approval-1',
        tenantId: 'tenant-1',
        status: 'pending',
        createdAt: new Date(),
      });
      mockCreateStep.mockResolvedValue({ id: 'step-1' });

      await service.submitApprovalRequest('tenant-1', {
        title: 'Test',
        requesterId: 'user1',
        resourceType: 'generic',
        resourceId: 'res-1',
        levels: [
          { levelIndex: 0, approverIds: ['approver1'], requiredApprovals: 1 },
          { levelIndex: 1, approverIds: ['approver2'], requiredApprovals: 1 },
        ],
        mode: ApprovalMode.PARALLEL,
      });

      const calls = mockCreateStep.mock.calls;
      expect(calls[0][0].status).toBe('pending');
      expect(calls[1][0].status).toBe('pending');
    });
  });

  describe('review', () => {
    it('should approve a step', async () => {
      // First call: check if request exists and is pending
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
        requiredApprovals: 1,
        createdAt: new Date(),
      });
      // First call to findSteps: get steps for review
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'approver1', status: 'pending', stepIndex: 0 },
      ]);
      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);

      const result = await service.review('approval-1', 'approver1', ApprovalAction.APPROVE, 'Looks good');

      expect(mockUpdateStepStatus).toHaveBeenCalledWith(
        'step-1',
        'approved',
        'Looks good',
        expect.any(Date),
      );
    });

    it('should reject entire request on rejection', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
        requiredApprovals: 1,
        createdAt: new Date(),
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'approver1', status: 'pending', stepIndex: 0 },
      ]);
      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);

      await service.review('approval-1', 'approver1', ApprovalAction.REJECT, 'Not approved');

      expect(mockUpdateStatus).toHaveBeenCalledWith('approval-1', 'rejected');
    });

    it('should throw if request not found', async () => {
      mockFindById.mockResolvedValue(undefined);

      await expect(
        service.review('nonexistent', 'approver1', ApprovalAction.APPROVE),
      ).rejects.toThrow('not found');
    });

    it('should throw if request is not pending', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'approved',
        createdAt: new Date(),
      });

      await expect(
        service.review('approval-1', 'approver1', ApprovalAction.APPROVE),
      ).rejects.toThrow('not pending');
    });

    it('should throw if reviewer not authorized', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
        createdAt: new Date(),
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'other-user', status: 'pending', stepIndex: 0 },
      ]);

      await expect(
        service.review('approval-1', 'unauthorized', ApprovalAction.APPROVE),
      ).rejects.toThrow('Not authorized');
    });

    it('should throw if step is waiting', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
        createdAt: new Date(),
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'approver1', status: 'waiting', stepIndex: 1 },
      ]);

      await expect(
        service.review('approval-1', 'approver1', ApprovalAction.APPROVE),
      ).rejects.toThrow('waiting');
    });

    it('should advance step when not all approvals met', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
        requiredApprovals: 2,
        createdAt: new Date(),
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'approver1', status: 'pending', stepIndex: 0 },
        { id: 'step-2', approverId: 'approver2', status: 'pending', stepIndex: 1 },
      ]);
      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockAdvanceStep.mockResolvedValue(undefined);

      await service.review('approval-1', 'approver1', ApprovalAction.APPROVE);

      expect(mockAdvanceStep).toHaveBeenCalledWith('approval-1');
    });
  });

  describe('getApprovalChain', () => {
    it('should return approval chain info', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        title: 'Deploy',
        status: 'pending',
        currentStep: 0,
        resourceType: 'deployment',
        createdAt: new Date(),
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'approver1', status: 'approved', stepIndex: 0 },
        { id: 'step-2', approverId: 'approver2', status: 'pending', stepIndex: 1 },
      ]);

      const result = await service.getApprovalChain('approval-1');

      expect(result.requestId).toBe('approval-1');
      expect(result.title).toBe('Deploy');
      expect(result.steps.length).toBe(2);
    });

    it('should throw if not found', async () => {
      mockFindById.mockResolvedValue(undefined);

      await expect(service.getApprovalChain('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getPendingApprovals', () => {
    it('should return approvals pending for user', async () => {
      mockFindPendingByTenant.mockResolvedValue([
        {
          id: 'approval-1',
          tenantId: 'tenant-1',
          status: 'pending',
          createdAt: new Date(),
        },
      ]);
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'user1', status: 'pending', stepIndex: 0 },
      ]);

      const result = await service.getPendingApprovals('user1', 'tenant-1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('approval-1');
    });

    it('should filter out approvals where user is not approver', async () => {
      mockFindPendingByTenant.mockResolvedValue([
        {
          id: 'approval-1',
          tenantId: 'tenant-1',
          status: 'pending',
          createdAt: new Date(),
        },
      ]);
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'other-user', status: 'pending', stepIndex: 0 },
      ]);

      const result = await service.getPendingApprovals('user1', 'tenant-1');

      expect(result.length).toBe(0);
    });
  });

  describe('isApproved', () => {
    it('should return true when approved', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'approved',
      });

      const result = await service.isApproved('approval-1');
      expect(result).toBe(true);
    });

    it('should return false when not approved', async () => {
      mockFindById.mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
      });

      const result = await service.isApproved('approval-1');
      expect(result).toBe(false);
    });

    it('should return false when not found', async () => {
      mockFindById.mockResolvedValue(undefined);

      const result = await service.isApproved('nonexistent');
      expect(result).toBe(false);
    });
  });
});
