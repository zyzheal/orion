/**
 * ChangeRequestService Tests
 * Covers CRUD, approval chain, execution management, state transitions
 */
import { ChangeRequestService } from '../ChangeRequestService';
import { OrionError } from '../../../errors';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-id',
}));

const mockRequestRepo = {
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findWithFilters: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getDb: jest.fn(),
};

const mockApprovalRepo = {
  findById: jest.fn(),
  listByChange: jest.fn(),
  getNextPending: jest.fn(),
  create: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  areAllApproved: jest.fn(),
  countByStatus: jest.fn(),
};

const mockExecutionRepo = {
  findById: jest.fn(),
  listByChange: jest.fn(),
  create: jest.fn(),
  getProgress: jest.fn(),
  startStep: jest.fn(),
  completeStep: jest.fn(),
  failStep: jest.fn(),
  updateStatus: jest.fn(),
};

let service: ChangeRequestService;

const mockRequest = {
  id: 'cr-1',
  tenantId: 'test-tenant',
  title: 'Upgrade DB',
  description: 'Upgrade to PG16',
  changeType: 'standard',
  riskLevel: 'medium',
  impactScope: 'minor',
  rollbackPlan: 'Restore backup',
  scheduledStart: null,
  scheduledEnd: null,
  status: 'draft',
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockApproval = {
  id: 'appr-1',
  tenantId: 'test-tenant',
  changeRequestId: 'cr-1',
  approverRole: 'supervisor',
  approverId: null,
  approvalOrder: 1,
  status: 'pending',
  comment: null,
  decidedAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  service = new ChangeRequestService(
    mockRequestRepo as any,
    mockApprovalRepo as any,
    mockExecutionRepo as any,
  );
});

describe('ChangeRequestService', () => {
  // ==================== CRUD ====================
  describe('listRequests', () => {
    it('should return all requests when no filters', async () => {
      mockRequestRepo.findByTenant.mockResolvedValue({ entities: [mockRequest], total: 1 });
      const result = await service.listRequests();
      expect(result).toHaveLength(1);
      expect(mockRequestRepo.findByTenant).toHaveBeenCalledWith('test-tenant');
    });

    it('should use findWithFilters when filters provided', async () => {
      mockRequestRepo.findWithFilters.mockResolvedValue({ entities: [mockRequest], total: 1 });
      const result = await service.listRequests({ status: 'draft' });
      expect(result).toHaveLength(1);
      expect(mockRequestRepo.findWithFilters).toHaveBeenCalledWith('test-tenant', { status: 'draft' });
    });
  });

  describe('getRequest', () => {
    it('should return request when found', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      const result = await service.getRequest('cr-1');
      expect(result.title).toBe('Upgrade DB');
    });

    it('should throw NOT_FOUND when missing', async () => {
      mockRequestRepo.findById.mockResolvedValue(null);
      await expect(service.getRequest('missing')).rejects.toThrow(OrionError);
    });
  });

  describe('createRequest', () => {
    it('should create with defaults', async () => {
      mockRequestRepo.create.mockResolvedValue(mockRequest);
      const result = await service.createRequest({ title: 'Upgrade DB', changeType: 'standard' });
      expect(result.title).toBe('Upgrade DB');
      expect(mockRequestRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'draft',
        riskLevel: 'low',
      }));
    });
  });

  describe('updateRequest', () => {
    it('should update draft request', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      mockRequestRepo.update.mockResolvedValue({ ...mockRequest, title: 'Updated' });
      const result = await service.updateRequest('cr-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('should update rejected request', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'rejected' });
      mockRequestRepo.update.mockResolvedValue({ ...mockRequest, status: 'rejected', title: 'Revised' });
      const result = await service.updateRequest('cr-1', { title: 'Revised' });
      expect(result.title).toBe('Revised');
    });

    it('should throw STATE_CONFLICT for non-draft/rejected status', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'approved' });
      await expect(service.updateRequest('cr-1', { title: 'x' })).rejects.toThrow('draft or rejected');
    });
  });

  describe('deleteRequest', () => {
    it('should delete draft request', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      mockRequestRepo.delete.mockResolvedValue(undefined);
      await expect(service.deleteRequest('cr-1')).resolves.toBeUndefined();
    });

    it('should throw STATE_CONFLICT for non-draft/cancelled status', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'approved' });
      await expect(service.deleteRequest('cr-1')).rejects.toThrow('draft or cancelled');
    });
  });

  // ==================== Approval Chain ====================
  describe('submitForApproval', () => {
    it('should create approval chain and update status', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      mockApprovalRepo.listByChange.mockResolvedValue([]);
      mockApprovalRepo.create.mockResolvedValue(mockApproval);
      mockRequestRepo.update.mockResolvedValue({ ...mockRequest, status: 'pending_approval' });
      mockRequestRepo.getDb.mockReturnValue({}); // no transaction
      // Re-get after status update
      mockRequestRepo.findById.mockResolvedValueOnce(mockRequest).mockResolvedValueOnce({ ...mockRequest, status: 'pending_approval' });

      const result = await service.submitForApproval('cr-1');
      expect(result.status).toBe('pending_approval');
      // medium risk = 2 approval steps
      expect(mockApprovalRepo.create).toHaveBeenCalledTimes(2);
    });

    it('should throw STATE_CONFLICT when not draft', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'approved' });
      await expect(service.submitForApproval('cr-1')).rejects.toThrow('draft');
    });

    it('should throw when approval chain already exists', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      mockApprovalRepo.listByChange.mockResolvedValue([mockApproval]);
      await expect(service.submitForApproval('cr-1')).rejects.toThrow('already exists');
    });
  });

  describe('approveRequest', () => {
    it('should approve and update status when all approved', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'pending_approval' });
      mockApprovalRepo.findById.mockResolvedValue(mockApproval);
      mockApprovalRepo.getNextPending.mockResolvedValue(mockApproval);
      mockApprovalRepo.approve.mockResolvedValue({ ...mockApproval, status: 'approved' });
      mockApprovalRepo.areAllApproved.mockResolvedValue(true);
      mockRequestRepo.update.mockResolvedValue({ ...mockRequest, status: 'approved' });

      const result = await service.approveRequest('cr-1', 'appr-1', 'mgr-1', 'LGTM');
      expect(result.status).toBe('approved');
      expect(mockRequestRepo.update).toHaveBeenCalledWith('cr-1', { status: 'approved' });
    });

    it('should throw when not in pending_approval', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'draft' });
      await expect(service.approveRequest('cr-1', 'appr-1', 'mgr-1')).rejects.toThrow('pending_approval');
    });

    it('should throw when approval order violated', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'pending_approval' });
      mockApprovalRepo.findById.mockResolvedValue(mockApproval);
      mockApprovalRepo.getNextPending.mockResolvedValue({ ...mockApproval, id: 'appr-2' }); // different next
      await expect(service.approveRequest('cr-1', 'appr-1', 'mgr-1')).rejects.toThrow('in order');
    });
  });

  describe('rejectRequest', () => {
    it('should reject and update request status', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'pending_approval' });
      mockApprovalRepo.findById.mockResolvedValue(mockApproval);
      mockApprovalRepo.reject.mockResolvedValue({ ...mockApproval, status: 'rejected' });
      mockRequestRepo.update.mockResolvedValue({ ...mockRequest, status: 'rejected' });

      const result = await service.rejectRequest('cr-1', 'appr-1', 'mgr-1', 'Needs changes');
      expect(result.status).toBe('rejected');
      expect(mockRequestRepo.update).toHaveBeenCalledWith('cr-1', { status: 'rejected' });
    });
  });

  describe('getApprovalChain', () => {
    it('should return approval chain', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      mockApprovalRepo.listByChange.mockResolvedValue([mockApproval]);
      const result = await service.getApprovalChain('cr-1');
      expect(result).toHaveLength(1);
    });
  });

  // ==================== Execution ====================
  describe('startExecution', () => {
    it('should create execution steps and update status', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'approved' });
      mockRequestRepo.getDb.mockReturnValue({}); // no transaction
      mockExecutionRepo.create.mockResolvedValue({ id: 'exec-1', stepOrder: 1 });
      mockRequestRepo.update.mockResolvedValue({ ...mockRequest, status: 'implementing' });

      const result = await service.startExecution('cr-1', [
        { stepOrder: 1, stepName: 'Backup' },
        { stepOrder: 2, stepName: 'Upgrade' },
      ]);
      expect(result).toHaveLength(2);
      expect(mockRequestRepo.update).toHaveBeenCalledWith('cr-1', { status: 'implementing' });
    });

    it('should throw when not approved', async () => {
      mockRequestRepo.findById.mockResolvedValue({ ...mockRequest, status: 'draft' });
      await expect(service.startExecution('cr-1', [])).rejects.toThrow('approved');
    });
  });

  describe('updateExecutionStep', () => {
    it('should start step when status is running', async () => {
      mockExecutionRepo.findById.mockResolvedValue({ id: 'exec-1', status: 'pending' });
      mockExecutionRepo.startStep.mockResolvedValue({ id: 'exec-1', status: 'running' });
      const result = await service.updateExecutionStep('exec-1', { status: 'running', executedBy: 'user-1' });
      expect(result.status).toBe('running');
    });

    it('should complete step when status is completed', async () => {
      mockExecutionRepo.findById.mockResolvedValue({ id: 'exec-1', status: 'running' });
      mockExecutionRepo.completeStep.mockResolvedValue({ id: 'exec-1', status: 'completed' });
      const result = await service.updateExecutionStep('exec-1', { status: 'completed', output: 'Done' });
      expect(result.status).toBe('completed');
    });

    it('should fail step when status is failed', async () => {
      mockExecutionRepo.findById.mockResolvedValue({ id: 'exec-1', status: 'running' });
      mockExecutionRepo.failStep.mockResolvedValue({ id: 'exec-1', status: 'failed' });
      const result = await service.updateExecutionStep('exec-1', { status: 'failed', error: 'Timeout' });
      expect(result.status).toBe('failed');
    });

    it('should throw when step not found', async () => {
      mockExecutionRepo.findById.mockResolvedValue(null);
      await expect(service.updateExecutionStep('missing', { status: 'running' })).rejects.toThrow(OrionError);
    });
  });

  describe('getExecutionProgress', () => {
    it('should return steps and progress', async () => {
      mockRequestRepo.findById.mockResolvedValue(mockRequest);
      mockExecutionRepo.listByChange.mockResolvedValue([{ id: 'exec-1' }]);
      mockExecutionRepo.getProgress.mockResolvedValue({ total: 2, completed: 1, failed: 0, pending: 1, running: 0 });
      const result = await service.getExecutionProgress('cr-1');
      expect(result.steps).toHaveLength(1);
      expect(result.progress.total).toBe(2);
    });
  });
});
