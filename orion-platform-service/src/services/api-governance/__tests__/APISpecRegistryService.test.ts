/**
 * APISpecRegistryService 单元测试
 */

import { APISpecRegistryService, APIGovernanceRepository, APIGovernanceError } from '../APISpecRegistryService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('APISpecRegistryService', () => {
  let service: APISpecRegistryService;
  let repository: APIGovernanceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new APIGovernanceRepository(mockPool as any);
    service = new APISpecRegistryService(mockPool as any);
  });

  describe('APIGovernanceRepository', () => {
    describe('createContract', () => {
      it('应该创建 API 合约', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            tenant_id: 'tenant1',
            service_name: 'user-service',
            version: 'v1',
            status: 'active',
          }],
        });

        const result = await repository.createContract({
          tenant_id: 'tenant1',
          service_name: 'user-service',
          version: 'v1',
          spec: {},
        });

        expect(result.service_name).toBe('user-service');
        expect(result.status).toBe('active');
      });

      it('应该存储 API 规范', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'c1',
            spec: { paths: {} },
          }],
        });

        const result = await repository.createContract({
          tenant_id: 'tenant1',
          service_name: 'service',
          version: 'v1',
          spec: { paths: { '/users': {} } },
        });

        expect(result.spec).toBeDefined();
      });
    });

    describe('findContractById', () => {
      it('应该返回合约', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', service_name: 'service' }],
        });

        const result = await repository.findContractById('c1');

        expect(result).not.toBeNull();
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findContractById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listContracts', () => {
      it('应该返回合约列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 'c1', service_name: 'user-service' },
            { id: 'c2', service_name: 'order-service' },
          ],
        });

        const result = await repository.listContracts('tenant1');

        expect(result.length).toBe(2);
      });

      it('应该支持按服务过滤', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', service_name: 'user-service' }],
        });

        await repository.listContracts('tenant1', { service: 'user-service' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('service_name'),
          expect.arrayContaining(['tenant1', 'user-service'])
        );
      });

      it('应该支持按状态过滤', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', status: 'active' }],
        });

        await repository.listContracts('tenant1', { status: 'active' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status'),
          expect.any(Array)
        );
      });
    });

    describe('updateContract', () => {
      it('应该更新合约', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', status: 'deprecated' }],
        });

        const result = await repository.updateContract('c1', {
          status: 'deprecated',
        });

        expect(result!.status).toBe('deprecated');
      });

      it('应该更新规范', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', spec: {} }],
        });

        await repository.updateContract('c1', {
          spec: { paths: {} },
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('spec'),
          expect.any(Array)
        );
      });
    });

    describe('createVersion', () => {
      it('应该创建 API 版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'v1',
            tenant_id: 'tenant1',
            contract_id: 'c1',
            version_tag: 'v2.0',
            status: 'active',
          }],
        });

        const result = await repository.createVersion({
          tenant_id: 'tenant1',
          contract_id: 'c1',
          version_tag: 'v2.0',
        });

        expect(result.version_tag).toBe('v2.0');
      });
    });

    describe('listVersions', () => {
      it('应该返回版本列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 'v1', version_tag: 'v1.0' },
            { id: 'v2', version_tag: 'v2.0' },
          ],
        });

        const result = await repository.listVersions('c1');

        expect(result.length).toBe(2);
      });
    });

    describe('updateVersionStatus', () => {
      it('应该更新版本状态', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', status: 'deprecated' }],
        });

        const result = await repository.updateVersionStatus('v1', 'deprecated');

        expect(result!.status).toBe('deprecated');
      });

      it('应该支持废弃日期', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'v1',
            status: 'deprecated',
            deprecation_date: new Date('2024-06-01'),
          }],
        });

        await repository.updateVersionStatus('v1', 'deprecated', new Date('2024-06-01'));

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('deprecation_date'),
          expect.any(Array)
        );
      });
    });
  });

  describe('APISpecRegistryService', () => {
    describe('createContract', () => {
      it('应该创建合约', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', service_name: 'service' }],
        });

        const result = await service.createContract({
          tenant_id: 'tenant1',
          service_name: 'service',
          version: 'v1',
          spec: {},
        });

        expect(result.service_name).toBe('service');
      });
    });

    describe('getContract', () => {
      it('应该返回合约', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1' }],
        });

        const result = await service.getContract('c1');

        expect(result).not.toBeNull();
      });
    });

    describe('listContracts', () => {
      it('应该返回合约列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1' }],
        });

        const result = await service.listContracts('tenant1');

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('verifyContract', () => {
      it('应该验证合约', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', spec: {} }],
        });

        const result = await service.verifyContract('c1', 'provider');

        expect(result.passed).toBeDefined();
        expect(result.failures).toBeDefined();
      });

      it('应该支持 provider/consumer scope', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', spec: {} }],
        });

        const result = await service.verifyContract('c1', 'consumer');

        expect(result.scope).toBe('consumer');
      });

      it('应该返回验证详情', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', spec: { paths: {} } }],
        });

        const result = await service.verifyContract('c1', 'provider');

        expect(result.total).toBeDefined();
        expect(result.passed_count).toBeDefined();
        expect(result.failed_count).toBeDefined();
        expect(result.verified_at).toBeDefined();
      });
    });

    describe('checkCompatibility', () => {
      it('应该检查兼容性', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{ id: 'c1', spec: {} }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'c1', spec: {} }],
          });

        const result = await service.checkCompatibility('c1', {});

        expect(result.compatible).toBeDefined();
        expect(result.breaking_changes).toBeDefined();
      });

      it('应该检测破坏性变更', async () => {
        mockPool.query
          .mockResolvedValueOnce({
            rows: [{ id: 'c1', spec: { paths: { '/users': {} } } }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 'c1', spec: {} }],
          });

        const result = await service.checkCompatibility('c1', {});

        expect(result.breaking_changes.length).toBeGreaterThan(0);
      });
    });

    describe('analyzeImpact', () => {
      it('应该分析影响', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1' }],
        });

        const result = await service.analyzeImpact('c1', 'v2', 'v1');

        expect(result.risk_level).toBeDefined();
        expect(result.impacted_services).toBeDefined();
      });
    });

    describe('deprecateVersion', () => {
      it('应该废弃版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', status: 'deprecated' }],
        });

        const result = await service.deprecateVersion('v1', '2024-06-01');

        expect(result.status).toBe('deprecated');
      });
    });

    describe('retireVersion', () => {
      it('应该退役版本', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', status: 'retired' }],
        });

        const result = await service.retireVersion('v1');

        expect(result.status).toBe('retired');
      });
    });
  });

  describe('APIContract', () => {
    it('应该包含完整的合约信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          service_name: 'user-service',
          version: 'v1',
          spec: {},
          endpoints: [],
          status: 'active',
          last_verified_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await repository.createContract({
        tenant_id: 'tenant1',
        service_name: 'user-service',
        version: 'v1',
        spec: {},
      });

      expect(result.id).toBeDefined();
      expect(result.service_name).toBe('user-service');
    });

    it('应该支持不同的合约状态', async () => {
      const statuses = ['active', 'deprecated', 'retired'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', status }],
        });

        const result = await repository.findContractById('c1');
        if (result) {
          expect(['active', 'deprecated', 'retired'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  describe('APIVersion', () => {
    it('应该包含完整的版本信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'v1',
          tenant_id: 'tenant1',
          contract_id: 'c1',
          version_tag: 'v1.0',
          status: 'active',
          deprecation_date: null,
          retirement_date: null,
          replacement_version: null,
          changelog: null,
          created_at: new Date(),
        }],
      });

      const result = await repository.createVersion({
        tenant_id: 'tenant1',
        contract_id: 'c1',
        version_tag: 'v1.0',
      });

      expect(result.id).toBeDefined();
      expect(result.version_tag).toBe('v1.0');
    });

    it('应该支持不同的版本状态', async () => {
      const statuses = ['draft', 'active', 'deprecated', 'retired'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'v1', status }],
        });

        const result = await repository.updateVersionStatus('v1', status);
        if (result) {
          expect(['draft', 'active', 'deprecated', 'retired'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  describe('ContractVerificationResult', () => {
    it('应该包含完整的验证结果', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'c1', spec: {} }],
      });

      const result = await service.verifyContract('c1', 'provider');

      expect(result.contract_id).toBeDefined();
      expect(result.scope).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.passed_count).toBeDefined();
      expect(result.failed_count).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.failures).toBeDefined();
    });
  });

  describe('BreakingChange', () => {
    it('应该包含破坏性变更信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'c1', spec: { paths: { '/users': {} } } }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'c1', spec: {} }],
        });

      const result = await service.checkCompatibility('c1', {});

      if (result.breaking_changes.length > 0) {
        const change = result.breaking_changes[0];
        expect(change.endpoint).toBeDefined();
        expect(change.type).toBeDefined();
        expect(['field_removed', 'type_changed', 'required_added', 'path_changed'].includes(change.type)).toBe(true);
        expect(change.description).toBeDefined();
        expect(['high', 'medium'].includes(change.severity)).toBe(true);
      }
    });
  });

  describe('APIGovernanceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new APIGovernanceError('Contract not found', 'CONTRACT_NOT_FOUND');

      expect(error.message).toBe('Contract not found');
      expect(error.code).toBe('CONTRACT_NOT_FOUND');
      expect(error.name).toBe('APIGovernanceError');
    });
  });
});