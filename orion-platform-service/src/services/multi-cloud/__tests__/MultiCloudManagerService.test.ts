/**
 * MultiCloudManagerService 单元测试
 */

import { MultiCloudManagerService } from '../MultiCloudManagerService';

// Mock the repository module
const mockRepo = {
  createCloudAccount: jest.fn(),
  findAccountsByTenant: jest.fn(),
  findAccountById: jest.fn(),
  deleteCloudAccount: jest.fn(),
  deleteResourcesByAccount: jest.fn(),
  findResourcesByTenant: jest.fn(),
};

jest.mock('../../../repositories/MultiCloudRepository', () => ({
  MultiCloudRepository: jest.fn().mockImplementation(() => mockRepo),
}));

describe('MultiCloudManagerService', () => {
  let service: MultiCloudManagerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Create service with a mock db (which triggers repo creation)
    service = new MultiCloudManagerService({ query: jest.fn() } as any);
  });

  describe('addCloudProvider', () => {
    it('应该注册云提供商', async () => {
      mockRepo.createCloudAccount.mockResolvedValue({
        id: 'p1',
        tenant_id: 'tenant1',
        account_name: 'aws-primary',
        provider_id: 'aws',
        account_id: 'acc-1',
        credential_type: 'iam-role',
        credential_ref: 'secret-1',
        region: 'us-east-1',
        status: 'active',
        monthly_budget: null,
        current_spend: 0,
        tags: {},
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.addCloudProvider({
        tenant_id: 'tenant1',
        account_name: 'aws-primary',
        provider_id: 'aws',
        credential_type: 'iam-role',
        credential_ref: 'secret-1',
        region: 'us-east-1',
      });

      expect(result.account_name).toBe('aws-primary');
      expect(result.provider_id).toBe('aws');
      expect(result.status).toBe('active');
    });
  });

  describe('addCloudAccount', () => {
    it('应该添加云账户', async () => {
      mockRepo.createCloudAccount.mockResolvedValue({
        id: 'acc-1',
        tenant_id: 'tenant1',
        account_name: 'aws-prod',
        provider_id: 'aws',
        account_id: 'cloud-acc-001',
        credential_type: 'iam-role',
        credential_ref: 'secret-aws-001',
        region: 'us-east-1',
        status: 'active',
        monthly_budget: null,
        current_spend: 0,
        tags: { env: 'prod' },
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.addCloudAccount('tenant1', {
        name: 'aws-prod',
        provider: 'aws',
        region: 'us-east-1',
        credentials_ref: 'secret-aws-001',
        metadata: { env: 'prod' },
      });

      expect(result.account_name).toBe('aws-prod');
      expect(result.region).toBe('us-east-1');
    });
  });

  describe('listProviders', () => {
    it('应该返回提供商列表', async () => {
      mockRepo.findAccountsByTenant.mockResolvedValue([
        { id: 'p1', account_name: 'aws-primary', provider_id: 'aws' },
        { id: 'p2', account_name: 'gcp-secondary', provider_id: 'gcp' },
      ]);

      const result = await service.listProviders('tenant1');

      expect(result.length).toBe(2);
    });

    it('应该返回空列表如果没有提供商', async () => {
      mockRepo.findAccountsByTenant.mockResolvedValue([]);

      const result = await service.listProviders('tenant1');

      expect(result.length).toBe(0);
    });
  });

  describe('removeCloudAccount', () => {
    it('应该删除云账户及其资源', async () => {
      mockRepo.deleteResourcesByAccount.mockResolvedValue(5);
      mockRepo.deleteCloudAccount.mockResolvedValue(true);

      const result = await service.removeCloudAccount('acc-1', 'tenant1');

      expect(result).toBe(true);
    });

    it('应该返回 false 如果账户不存在', async () => {
      mockRepo.deleteResourcesByAccount.mockResolvedValue(0);
      mockRepo.deleteCloudAccount.mockResolvedValue(false);

      const result = await service.removeCloudAccount('nonexistent', 'tenant1');

      expect(result).toBe(false);
    });
  });

  describe('listCloudAccounts', () => {
    it('应该按租户列出云账户', async () => {
      mockRepo.findAccountsByTenant.mockResolvedValue([
        {
          id: 'acc-1',
          tenant_id: 'tenant1',
          account_name: 'aws-prod',
          provider_id: 'aws',
          account_id: 'cloud-acc-001',
          credential_type: 'iam-role',
          credential_ref: 'secret-1',
          region: 'us-east-1',
          status: 'active',
          monthly_budget: null,
          current_spend: 0,
          tags: {},
          created_by: 'system',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.listCloudAccounts('tenant1');

      expect(result.length).toBe(1);
    });
  });

  describe('getResourceInventory', () => {
    it('应该从数据库读取资源清单', async () => {
      mockRepo.findResourcesByTenant.mockResolvedValue([
        {
          id: 'res-1',
          tenant_id: 'tenant1',
          account_id: 'acc-1',
          resource_type: 'vm',
          resource_id: 'res-acc-1-vm',
          resource_name: 'aws-vm',
          region: 'us-east-1',
          state: 'running',
          spec: { instance_type: 't3.large', count: 5 },
          monthly_cost: 350.4,
          tags: { provider: 'aws' },
          discovered_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.getResourceInventory('tenant1');

      expect(result.length).toBe(1);
      expect(result[0].resource_type).toBe('vm');
    });
  });
});
