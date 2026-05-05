/**
 * MultiCloudManagerService 单元测试
 */

import { MultiCloudManagerService } from '../MultiCloudManagerService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('MultiCloudManagerService', () => {
  let service: MultiCloudManagerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MultiCloudManagerService(mockPool as any);
  });

  describe('registerProvider', () => {
    it('应该注册云提供商', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'p1',
          tenant_id: 'tenant1',
          name: 'aws-primary',
          type: 'aws',
          region: 'us-east-1',
          credentials_ref: 'secret-1',
          status: 'active',
        }],
      });

      const result = await service.registerProvider({
        tenant_id: 'tenant1',
        name: 'aws-primary',
        type: 'aws',
        region: 'us-east-1',
        credentials_ref: 'secret-1',
      });

      expect(result.name).toBe('aws-primary');
      expect(result.type).toBe('aws');
      expect(result.status).toBe('active');
    });

    it('应该支持不同的云提供商类型', async () => {
      const providerTypes = ['aws', 'gcp', 'azure', 'alicloud', 'private'];

      for (const type of providerTypes) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'p1', type }],
        });

        const result = await service.registerProvider({
          tenant_id: 'tenant1',
          name: `provider-${type}`,
          type,
          region: 'region-1',
          credentials_ref: 'secret',
        });

        expect(result.type).toBe(type);
      }
    });

    it('应该存储凭证引用', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'p1', credentials_ref: 'vault-secret-123' }],
      });

      const result = await service.registerProvider({
        tenant_id: 'tenant1',
        name: 'provider',
        type: 'aws',
        region: 'us-east-1',
        credentials_ref: 'vault-secret-123',
      });

      expect(result.credentials_ref).toBe('vault-secret-123');
    });
  });

  describe('listProviders', () => {
    it('应该返回提供商列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'p1', name: 'aws-primary', type: 'aws' },
          { id: 'p2', name: 'gcp-secondary', type: 'gcp' },
        ],
      });

      const result = await service.listProviders('tenant1');

      expect(result.length).toBe(2);
    });

    it('应该返回空列表如果没有提供商', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.listProviders('tenant1');

      expect(result.length).toBe(0);
    });
  });

  describe('deployMultiCloud', () => {
    it('应该部署多云配置', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', status: 'active' },
            { id: 'p2', status: 'active' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'd1',
            tenant_id: 'tenant1',
            deployment_id: 'deployment1',
            providers: ['p1', 'p2'],
            strategy: 'active-active',
            primary_provider: 'p1',
            status: 'deploying',
          }],
        });

      const result = await service.deployMultiCloud({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.deployment_id).toBe('deployment1');
      expect(result.status).toBe('deploying');
    });

    it('应该只选择活跃提供商', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', status: 'active' },
            { id: 'p2', status: 'inactive' },
            { id: 'p3', status: 'error' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'd1',
            providers: ['p1'],
          }],
        });

      await service.deployMultiCloud({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['p1'])
      );
    });

    it('应该支持不同的部署策略', async () => {
      const strategies = ['primary-backup', 'active-active', 'failover'];

      for (const strategy of strategies) {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'p1', status: 'active' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'd1', strategy }] });

        const result = await service.deployMultiCloud({
          tenant_id: 'tenant1',
          deployment_id: 'deployment1',
          strategy,
        });

        expect(result.strategy).toBe(strategy);
      }
    });

    it('应该默认使用 active-active 策略', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'd1', strategy: 'active-active' }] });

      const result = await service.deployMultiCloud({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.strategy).toBe('active-active');
    });

    it('应该设置主提供商', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', status: 'active' },
            { id: 'p2', status: 'active' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'd1', primary_provider: 'p1' }],
        });

      const result = await service.deployMultiCloud({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.primary_provider).toBe('p1');
    });
  });

  describe('failover', () => {
    it('应该执行故障转移', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd1', primary_provider: 'p2' }],
      });

      const result = await service.failover('d1', 'p2');

      expect(result.success).toBe(true);
    });

    it('应该更新主提供商', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
      });

      await service.failover('d1', 'p2');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['d1', 'p2']
      );
    });
  });

  describe('CloudProvider', () => {
    it('应该包含完整的提供商信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'p1',
          tenant_id: 'tenant1',
          name: 'aws-primary',
          type: 'aws',
          region: 'us-east-1',
          credentials_ref: 'secret',
          status: 'active',
          created_at: new Date(),
        }],
      });

      const result = await service.registerProvider({
        tenant_id: 'tenant1',
        name: 'aws-primary',
        type: 'aws',
        region: 'us-east-1',
        credentials_ref: 'secret',
      });

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant1');
      expect(result.region).toBe('us-east-1');
    });

    it('应该支持不同的提供商状态', async () => {
      const statuses = ['active', 'inactive', 'error'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'p1', status }],
        });

        const result = await service.listProviders('tenant1');
        if (result.length > 0) {
          expect(['active', 'inactive', 'error'].includes(result[0].status)).toBe(true);
        }
      }
    });
  });

  describe('MultiCloudDeployment', ()it('应该包含完整的部署信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1', status: 'active' }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'd1',
            tenant_id: 'tenant1',
            deployment_id: 'deployment1',
            providers: ['p1'],
            strategy: 'active-active',
            primary_provider: 'p1',
            status: 'deploying',
            created_at: new Date(),
          }],
        });

      const result = await service.deployMultiCloud({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.id).toBeDefined();
      expect(result.providers).toBeDefined();
      expect(result.strategy).toBeDefined();
    });

    it('应该支持不同的部署状态', async () => {
      const statuses = ['deploying', 'active', 'failed'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'd1', status }],
        });

        const result = await service.deployMultiCloud({
          tenant_id: 'tenant1',
          deployment_id: 'deployment1',
        });

        expect(['deploying', 'active', 'failed'].includes(result.status)).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('应该处理没有活跃提供商的情况', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'p1', status: 'inactive' },
            { id: 'p2', status: 'error' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'd1',
            providers: [],
            primary_provider: null,
          }],
        });

      const result = await service.deployMultiCloud({
        tenant_id: 'tenant1',
        deployment_id: 'deployment1',
      });

      expect(result.providers.length).toBe(0);
    });
  });
});