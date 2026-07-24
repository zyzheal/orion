/**
 * Tests for EmergencyApprovalService
 */
import { EmergencyApprovalService, EmergencyReason } from '../EmergencyApprovalService';
import { ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';

// Mock ApprovalRepository
const mockCreate = jest.fn();
const mockFindById = jest.fn();
const mockFindStepsByApproval = jest.fn();
const mockUpdateStepStatus = jest.fn();
const mockUpdateStatus = jest.fn();
const mockCreateStep = jest.fn();

jest.mock('../../../repositories/ApprovalRepository', () => ({
  ApprovalRepository: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    findById: mockFindById,
    findStepsByApproval: mockFindStepsByApproval,
    updateStepStatus: mockUpdateStepStatus,
    updateStatus: mockUpdateStatus,
    createStep: mockCreateStep,
  })),
}));

describe('EmergencyApprovalService', () => {
  let service: EmergencyApprovalService;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmergencyApprovalService(mockDb);
  });

  describe('requestEmergencyApproval', () => {
    it('should create emergency approval request', async () => {
      const now = new Date();
      const mockEntity: ApprovalEntity = {
        id: 'emergency-1',
        tenantId: 'tenant-1',
        definitionId: null,
        resourceType: 'deployment',
        resourceId: 'deploy-1',
        title: '[EMERGENCY] Hotfix',
        status: 'pending',
        requestedBy: 'user1',
        currentStep: 0,
        totalSteps: 2,
        requiredApprovals: 1,
        result: { isEmergency: true },
        completedAt: null,
        createdAt: now,
      };

      mockCreate.mockResolvedValue(mockEntity);
      mockCreateStep.mockResolvedValue({ id: 'step-1' });

      const result = await service.requestEmergencyApproval('tenant-1', {
        title: 'Hotfix',
        description: 'Critical production fix',
        requesterId: 'user1',
        resourceType: 'deployment',
        resourceId: 'deploy-1',
        reason: EmergencyReason.PRODUCTION_INCIDENT,
        impactDescription: 'Service down',
        approverIds: ['approver1', 'approver2'],
      });

      expect(result.id).toBe('emergency-1');
      expect(result.status).toBe('pending');
      expect(result.autoApproved).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreateStep).toHaveBeenCalledTimes(2);
    });

    it('should mark request as emergency in result metadata', async () => {
      const now = new Date();
      mockCreate.mockResolvedValue({
        id: 'emergency-2',
        tenantId: 'tenant-1',
        status: 'pending',
        createdAt: now,
        result: { isEmergency: true },
      });
      mockCreateStep.mockResolvedValue({ id: 'step-1' });

      await service.requestEmergencyApproval('tenant-1', {
        title: 'Security patch',
        description: 'Critical vulnerability',
        requesterId: 'user1',
        resourceType: 'config',
        resourceId: 'config-1',
        reason: EmergencyReason.SECURITY_VULNERABILITY,
        impactDescription: 'Data at risk',
        approverIds: ['approver1'],
      });

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.result.isEmergency).toBe(true);
      expect(createCall.title).toBe('[EMERGENCY] Security patch');
    });
  });

  describe('autoApproveIfEmergency', () => {
    it('should throw if request not found', async () => {
      mockFindById.mockResolvedValue(undefined);

      await expect(service.autoApproveIfEmergency('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw if request is not pending', async () => {
      mockFindById.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        result: { isEmergency: true },
        createdAt: new Date(),
      });

      await expect(service.autoApproveIfEmergency('req-1')).rejects.toThrow('not pending');
    });

    it('should throw if request is not emergency', async () => {
      mockFindById.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        result: { isEmergency: false },
        createdAt: new Date(),
      });

      await expect(service.autoApproveIfEmergency('req-1')).rejects.toThrow('not an emergency');
    });

    it('should not auto-approve if timeout not reached', async () => {
      const now = new Date();
      mockFindById.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        result: { isEmergency: true, autoApproveTimeoutMs: 300000 },
        createdAt: now, // Just created, timeout not reached
      });

      const result = await service.autoApproveIfEmergency('req-1');

      expect(result.autoApproved).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('should auto-approve if timeout reached', async () => {
      const oldDate = new Date(Date.now() - 600000); // 10 minutes ago
      mockFindById
        .mockResolvedValueOnce({
          id: 'req-1',
          status: 'pending',
          result: { isEmergency: true, autoApproveTimeoutMs: 300000 },
          createdAt: oldDate,
        })
        .mockResolvedValueOnce({
          id: 'req-1',
          status: 'approved',
          result: { isEmergency: true },
          createdAt: oldDate,
        });
      mockUpdateStatus.mockResolvedValue(undefined);

      const result = await service.autoApproveIfEmergency('req-1');

      expect(result.autoApproved).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('system');
      expect(mockUpdateStatus).toHaveBeenCalledWith('req-1', 'approved', expect.any(Date));
    });
  });

  describe('approveEmergency', () => {
    it('should manually approve emergency request', async () => {
      const mockEntity = {
        id: 'req-1',
        status: 'pending',
        result: { isEmergency: true },
        createdAt: new Date(),
      };
      mockFindById
        .mockResolvedValueOnce(mockEntity)
        .mockResolvedValueOnce({ ...mockEntity, status: 'approved' });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'reviewer1', status: 'pending' },
      ]);
      mockUpdateStepStatus.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);

      const result = await service.approveEmergency('req-1', 'reviewer1', 'Approved');

      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe('reviewer1');
      expect(result.autoApproved).toBe(false);
    });

    it('should throw if request not found', async () => {
      mockFindById.mockResolvedValue(undefined);

      await expect(service.approveEmergency('nonexistent', 'reviewer1')).rejects.toThrow('not found');
    });

    it('should throw if request is not pending', async () => {
      mockFindById.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        result: { isEmergency: true },
      });

      await expect(service.approveEmergency('req-1', 'reviewer1')).rejects.toThrow('not pending');
    });

    it('should throw if request is not emergency', async () => {
      mockFindById.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        result: { isEmergency: false },
      });

      await expect(service.approveEmergency('req-1', 'reviewer1')).rejects.toThrow('not an emergency');
    });

    it('should throw if reviewer is not authorized', async () => {
      mockFindById.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        result: { isEmergency: true },
      });
      mockFindStepsByApproval.mockResolvedValue([
        { id: 'step-1', approverId: 'other-reviewer', status: 'pending' },
      ]);

      await expect(service.approveEmergency('req-1', 'unauthorized')).rejects.toThrow('Not authorized');
    });
  });

  describe('getAutoApproveTimeoutMs', () => {
    it('should return default timeout', () => {
      expect(service.getAutoApproveTimeoutMs()).toBe(300000);
    });

    it('should return custom timeout', () => {
      const customService = new EmergencyApprovalService(mockDb, { autoApproveTimeoutMs: 60000 });
      expect(customService.getAutoApproveTimeoutMs()).toBe(60000);
    });
  });

  describe('setAutoApproveTimeoutMs', () => {
    it('should update timeout', () => {
      service.setAutoApproveTimeoutMs(120000);
      expect(service.getAutoApproveTimeoutMs()).toBe(120000);
    });
  });
});
