/**
 * Tests for EmergencyDeployService
 */
import { EmergencyDeployService, EmergencyDeployServiceError } from '../EmergencyDeployService';

const mockCreate = jest.fn();
const mockFindById = jest.fn();
const mockApprove = jest.fn();
const mockComplete = jest.fn();
const mockReject = jest.fn();
const mockFindAll = jest.fn();
const mockCount = jest.fn();

const mockRepository = {
  create: mockCreate,
  findById: mockFindById,
  approve: mockApprove,
  complete: mockComplete,
  reject: mockReject,
  findAll: mockFindAll,
  count: mockCount,
};

const mockDeployFindById = jest.fn();
const mockDeployRepository = {
  findById: mockDeployFindById,
};

describe('EmergencyDeployService', () => {
  let service: EmergencyDeployService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmergencyDeployService(mockRepository as any, mockDeployRepository as any);
  });

  describe('requestEmergencyDeploy', () => {
    it('should create emergency deploy request', async () => {
      mockDeployFindById.mockResolvedValue({ id: 'deploy-1', tenant_id: 'tenant-1' });
      mockCreate.mockResolvedValue({ id: 'emerg-1', status: 'pending' });

      const result = await service.requestEmergencyDeploy('tenant-1', 'deploy-1', 'Production down', 'user1');

      expect(result.id).toBe('emerg-1');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should throw when reason is empty', async () => {
      await expect(
        service.requestEmergencyDeploy('tenant-1', 'deploy-1', '', 'user1'),
      ).rejects.toThrow('Reason is required');
    });

    it('should throw when requestedBy is empty', async () => {
      await expect(
        service.requestEmergencyDeploy('tenant-1', 'deploy-1', 'reason', ''),
      ).rejects.toThrow('RequestedBy is required');
    });

    it('should throw when deployment not found', async () => {
      mockDeployFindById.mockResolvedValue(null);

      await expect(
        service.requestEmergencyDeploy('tenant-1', 'nonexistent', 'reason', 'user1'),
      ).rejects.toThrow('Deployment not found');
    });

    it('should throw when tenant mismatch', async () => {
      mockDeployFindById.mockResolvedValue({ id: 'deploy-1', tenant_id: 'other-tenant' });

      await expect(
        service.requestEmergencyDeploy('tenant-1', 'deploy-1', 'reason', 'user1'),
      ).rejects.toThrow('does not belong');
    });
  });

  describe('approveEmergencyDeploy', () => {
    it('should approve emergency deploy', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1', status: 'pending' });
      mockApprove.mockResolvedValue({ id: 'emerg-1', status: 'approved' });

      const result = await service.approveEmergencyDeploy('tenant-1', 'emerg-1', 'approver1');

      expect(result.status).toBe('approved');
    });

    it('should throw when emergency not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.approveEmergencyDeploy('tenant-1', 'nonexistent', 'approver1'),
      ).rejects.toThrow('not found');
    });

    it('should throw when tenant mismatch', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'other-tenant', status: 'pending' });

      await expect(
        service.approveEmergencyDeploy('tenant-1', 'emerg-1', 'approver1'),
      ).rejects.toThrow('does not belong');
    });

    it('should throw when not pending', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1', status: 'approved' });

      await expect(
        service.approveEmergencyDeploy('tenant-1', 'emerg-1', 'approver1'),
      ).rejects.toThrow('not pending');
    });
  });

  describe('completeEmergencyDeploy', () => {
    it('should complete emergency deploy', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1', status: 'approved' });
      mockComplete.mockResolvedValue({ id: 'emerg-1', status: 'completed' });

      const result = await service.completeEmergencyDeploy('tenant-1', 'emerg-1', 'Post-mortem text');

      expect(result.status).toBe('completed');
    });

    it('should throw when not approved', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1', status: 'pending' });

      await expect(
        service.completeEmergencyDeploy('tenant-1', 'emerg-1'),
      ).rejects.toThrow('not approved');
    });
  });

  describe('rejectEmergencyDeploy', () => {
    it('should reject emergency deploy', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1', status: 'pending' });
      mockReject.mockResolvedValue({ id: 'emerg-1', status: 'rejected' });

      const result = await service.rejectEmergencyDeploy('tenant-1', 'emerg-1');

      expect(result.status).toBe('rejected');
    });

    it('should throw when not pending', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1', status: 'approved' });

      await expect(
        service.rejectEmergencyDeploy('tenant-1', 'emerg-1'),
      ).rejects.toThrow('not pending');
    });
  });

  describe('getEmergencies', () => {
    it('should return paginated emergencies', async () => {
      mockFindAll.mockResolvedValue([{ id: 'emerg-1' }]);
      mockCount.mockResolvedValue(1);

      const result = await service.getEmergencies({ tenantId: 'tenant-1' });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getEmergency', () => {
    it('should return emergency by id', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'tenant-1' });

      const result = await service.getEmergency('tenant-1', 'emerg-1');

      expect(result.id).toBe('emerg-1');
    });

    it('should throw when not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getEmergency('tenant-1', 'nonexistent')).rejects.toThrow('not found');
    });

    it('should throw when tenant mismatch', async () => {
      mockFindById.mockResolvedValue({ id: 'emerg-1', tenant_id: 'other-tenant' });

      await expect(service.getEmergency('tenant-1', 'emerg-1')).rejects.toThrow('does not belong');
    });
  });
});
