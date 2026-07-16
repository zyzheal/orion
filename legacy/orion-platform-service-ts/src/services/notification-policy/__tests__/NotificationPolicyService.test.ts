/**
 * NotificationPolicyService Tests
 */
import { NotificationPolicyService } from '../NotificationPolicyService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-id',
}));

const mockPolicyRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findEnabled: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockWorkflowRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByPolicyId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('NotificationPolicyService', () => {
  let service: NotificationPolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationPolicyService(mockPolicyRepo as any, mockWorkflowRepo as any);
  });

  describe('createPolicy', () => {
    it('should create a policy', async () => {
      mockPolicyRepo.create.mockResolvedValue({ id: 'p-1', name: 'Critical Alert' });
      const result = await service.createPolicy({
        name: 'Critical Alert', conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }],
        channels: ['email'], recipients: ['admin@test.com'],
      });
      expect(result.id).toBe('p-1');
    });
  });

  describe('getPolicy', () => {
    it('should throw when not found', async () => {
      mockPolicyRepo.findById.mockResolvedValue(null);
      await expect(service.getPolicy('missing')).rejects.toThrow('not found');
    });
  });

  describe('evaluatePolicies', () => {
    it('should match policies based on conditions', async () => {
      const policy = {
        id: 'p-1', enabled: true,
        conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }],
      };
      mockPolicyRepo.findEnabled.mockResolvedValue([policy]);

      const matched = await service.evaluatePolicies({ severity: 'critical' });
      expect(matched).toHaveLength(1);
    });

    it('should not match when conditions fail', async () => {
      const policy = {
        id: 'p-1', enabled: true,
        conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }],
      };
      mockPolicyRepo.findEnabled.mockResolvedValue([policy]);

      const matched = await service.evaluatePolicies({ severity: 'warning' });
      expect(matched).toHaveLength(0);
    });

    it('should support nested field access', async () => {
      const policy = {
        id: 'p-1', enabled: true,
        conditions: [{ field: 'alert.severity', operator: 'eq', value: 'critical' }],
      };
      mockPolicyRepo.findEnabled.mockResolvedValue([policy]);

      const matched = await service.evaluatePolicies({ alert: { severity: 'critical' } });
      expect(matched).toHaveLength(1);
    });

    it('should support contains operator', async () => {
      const policy = {
        id: 'p-1', enabled: true,
        conditions: [{ field: 'message', operator: 'contains', value: 'OOM' }],
      };
      mockPolicyRepo.findEnabled.mockResolvedValue([policy]);

      const matched = await service.evaluatePolicies({ message: 'OOMKilled pod restarted' });
      expect(matched).toHaveLength(1);
    });

    it('should support gt/lt operators', async () => {
      const policy = {
        id: 'p-1', enabled: true,
        conditions: [{ field: 'count', operator: 'gt', value: 5 }],
      };
      mockPolicyRepo.findEnabled.mockResolvedValue([policy]);

      expect(await service.evaluatePolicies({ count: 10 })).toHaveLength(1);
      expect(await service.evaluatePolicies({ count: 3 })).toHaveLength(0);
    });

    it('should support in operator', async () => {
      const policy = {
        id: 'p-1', enabled: true,
        conditions: [{ field: 'env', operator: 'in', value: ['prod', 'staging'] }],
      };
      mockPolicyRepo.findEnabled.mockResolvedValue([policy]);

      expect(await service.evaluatePolicies({ env: 'prod' })).toHaveLength(1);
      expect(await service.evaluatePolicies({ env: 'dev' })).toHaveLength(0);
    });
  });

  describe('deletePolicy', () => {
    it('should delete policy and associated workflows', async () => {
      mockPolicyRepo.findById.mockResolvedValue({ id: 'p-1' });
      mockWorkflowRepo.findByPolicyId.mockResolvedValue([{ id: 'w-1' }, { id: 'w-2' }]);
      await service.deletePolicy('p-1');
      expect(mockWorkflowRepo.delete).toHaveBeenCalledTimes(2);
      expect(mockPolicyRepo.delete).toHaveBeenCalledWith('p-1');
    });
  });

  describe('createWorkflow', () => {
    it('should create workflow for existing policy', async () => {
      mockPolicyRepo.findById.mockResolvedValue({ id: 'p-1' });
      mockWorkflowRepo.create.mockResolvedValue({ id: 'w-1', policyId: 'p-1' });

      const result = await service.createWorkflow({
        name: 'Escalate', policyId: 'p-1', steps: [{ id: 's1', type: 'notification', config: {} }],
      });
      expect(result.id).toBe('w-1');
    });

    it('should throw when policy not found', async () => {
      mockPolicyRepo.findById.mockResolvedValue(null);
      await expect(service.createWorkflow({
        name: 'Escalate', policyId: 'missing', steps: [],
      })).rejects.toThrow('not found');
    });
  });
});
