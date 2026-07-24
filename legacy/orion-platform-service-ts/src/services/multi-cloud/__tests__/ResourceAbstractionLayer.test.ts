/**
 * ResourceAbstractionLayer 单元测试
 *
 * 测试资源映射、统一视图、多云部署、资源注册等功能
 */

// Mock the repository module
const mockResourceRepo = {
  findByTenant: jest.fn(),
  createResource: jest.fn(),
  deleteResource: jest.fn(),
};

const mockDeploymentRepo = {
  findByTenant: jest.fn(),
  findById: jest.fn(),
  createDeployment: jest.fn(),
  updateStatus: jest.fn(),
};

jest.mock('../../../repositories/ResourceAbstractionRepository', () => ({
  UnifiedResourceRepository: jest.fn().mockImplementation(() => mockResourceRepo),
  DeploymentResultRepository: jest.fn().mockImplementation(() => mockDeploymentRepo),
}));

import { ResourceAbstractionLayer } from '../ResourceAbstractionLayer';

describe('ResourceAbstractionLayer', () => {
  let layer: ResourceAbstractionLayer;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    layer = new ResourceAbstractionLayer(mockDb as any);
  });

  // ==================== mapResource ====================

  describe('mapResource', () => {
    it('应该将 AWS EC2 映射为 compute 类型', () => {
      const result = layer.mapResource('aws', 'ec2', {
        id: 'i-12345',
        tenantId: 'tenant-1',
        name: 'web-server',
        region: 'us-east-1',
        status: 'running',
        cpu: 4,
        memoryMb: 8192,
        tags: { env: 'prod' },
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('compute');
      expect(result!.provider).toBe('aws');
      expect(result!.name).toBe('web-server');
      expect(result!.region).toBe('us-east-1');
      expect(result!.status).toBe('running');
      expect(result!.spec.cpu).toBe(4);
      expect(result!.spec.memoryMb).toBe(8192);
      expect(result!.tags).toEqual({ env: 'prod' });
    });

    it('应该将 AWS S3 映射为 storage 类型', () => {
      const result = layer.mapResource('aws', 's3', {
        id: 'bucket-1',
        name: 'my-bucket',
        region: 'us-west-2',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('storage');
    });

    it('应该将 GCP compute_engine 映射为 compute 类型', () => {
      const result = layer.mapResource('gcp', 'compute_engine', {
        id: 'gce-1',
        name: 'gce-instance',
        region: 'us-central1',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('compute');
      expect(result!.provider).toBe('gcp');
    });

    it('应该将 Azure virtual_machine 映射为 compute 类型', () => {
      const result = layer.mapResource('azure', 'virtual_machine', {
        id: 'vm-1',
        name: 'azure-vm',
        region: 'eastus',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('compute');
    });

    it('应该将 alicloud ECS 映射为 compute 类型', () => {
      const result = layer.mapResource('alicloud', 'ecs', {
        id: 'ecs-1',
        name: 'ali-ecs',
        region: 'cn-hangzhou',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('compute');
    });

    it('未知 provider 的已知类型应使用默认映射', () => {
      const result = layer.mapResource('unknown-provider', 'vm', {
        id: 'vm-1',
        name: 'generic-vm',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('compute');
    });

    it('完全未知类型应映射为 other', () => {
      const result = layer.mapResource('unknown-provider', 'exotic-resource', {
        id: 'r-1',
        name: 'exotic',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('other');
    });

    it('已知 provider 的未知类型应返回 null', () => {
      const result = layer.mapResource('aws', 'unknown_type', {
        id: 'x-1',
        name: 'unknown',
      });

      expect(result).toBeNull();
    });

    it('应该映射各种状态', () => {
      const statusMap: Record<string, string> = {
        running: 'running',
        active: 'running',
        available: 'running',
        stopped: 'stopped',
        terminated: 'stopped',
        pending: 'pending',
        creating: 'pending',
        error: 'error',
        failed: 'error',
      };

      for (const [input, expected] of Object.entries(statusMap)) {
        const result = layer.mapResource('aws', 'ec2', {
          id: 'test',
          name: 'test',
          status: input,
        });
        expect(result!.status).toBe(expected);
      }
    });

    it('应该映射不同的资源规格字段', () => {
      const result = layer.mapResource('aws', 'ec2', {
        id: 'test',
        name: 'test',
        vcpu: 8,
        ram: 16384,
        diskSize: 500,
        bandwidth: 1000,
      });

      expect(result!.spec.cpu).toBe(8);
      expect(result!.spec.memoryMb).toBe(16384);
      expect(result!.spec.storageGb).toBe(500);
      expect(result!.spec.networkBandwidthMbps).toBe(1000);
    });
  });

  // ==================== getUnifiedResourceView ====================

  describe('getUnifiedResourceView', () => {
    it('应该返回租户的统一资源视图', async () => {
      const now = new Date();
      mockResourceRepo.findByTenant.mockResolvedValue([
        {
          id: 'r-1',
          tenant_id: 'tenant-1',
          resource_type: 'compute',
          name: 'web-server',
          provider: 'aws',
          region: 'us-east-1',
          status: 'running',
          spec: { cpu: 4, memoryMb: 8192 },
          tags: { env: 'prod' },
          metadata: {},
          created_at: now,
          updated_at: now,
        },
        {
          id: 'r-2',
          tenant_id: 'tenant-1',
          resource_type: 'storage',
          name: 'data-bucket',
          provider: 'aws',
          region: 'us-east-1',
          status: 'running',
          spec: { storageGb: 500 },
          tags: {},
          metadata: {},
          created_at: now,
          updated_at: now,
        },
      ]);

      const result = await layer.getUnifiedResourceView('tenant-1');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('r-1');
      expect(result[0].type).toBe('compute');
      expect(result[0].tenantId).toBe('tenant-1');
      expect(result[1].id).toBe('r-2');
      expect(result[1].type).toBe('storage');
    });

    it('没有资源时应返回空数组', async () => {
      mockResourceRepo.findByTenant.mockResolvedValue([]);

      const result = await layer.getUnifiedResourceView('tenant-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== registerResource ====================

  describe('registerResource', () => {
    it('应该注册统一资源', async () => {
      const now = new Date();
      mockResourceRepo.createResource.mockResolvedValue({
        id: 'new-r-1',
        tenant_id: 'tenant-1',
        resource_type: 'compute',
        name: 'new-server',
        provider: 'aws',
        region: 'us-east-1',
        status: 'running',
        spec: { cpu: 8, memoryMb: 16384 },
        tags: { env: 'staging' },
        metadata: { source: 'manual' },
        created_at: now,
        updated_at: now,
      });

      const result = await layer.registerResource('tenant-1', {
        type: 'compute',
        name: 'new-server',
        provider: 'aws',
        region: 'us-east-1',
        status: 'running',
        spec: { cpu: 8, memoryMb: 16384 },
        tags: { env: 'staging' },
        metadata: { source: 'manual' },
      });

      expect(result.id).toBe('new-r-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.type).toBe('compute');
      expect(result.name).toBe('new-server');
      expect(result.spec.cpu).toBe(8);
      expect(mockResourceRepo.createResource).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== deployToProvider ====================

  describe('deployToProvider', () => {
    it('应该发起部署并返回 deploying 状态', async () => {
      const now = new Date();
      mockDeploymentRepo.createDeployment.mockResolvedValue({
        id: 'deploy-1',
        tenant_id: 'tenant-1',
        provider: 'aws',
        service_name: 'my-app',
        status: 'deploying',
        resources: [],
        error_message: null,
        created_at: now,
        updated_at: now,
      });

      // Mock resource creation for async deployment
      mockResourceRepo.createResource.mockResolvedValue({
        id: 'res-1',
        tenant_id: 'tenant-1',
        resource_type: 'container',
        name: 'my-app',
        provider: 'aws',
        region: 'auto',
        status: 'running',
        spec: { cpu: 2, memoryMb: 4096 },
        tags: {},
        metadata: {},
        created_at: now,
        updated_at: now,
      });
      mockDeploymentRepo.updateStatus.mockResolvedValue({
        id: 'deploy-1',
        status: 'active',
      });

      const result = await layer.deployToProvider('aws', 'tenant-1', {
        serviceName: 'my-app',
        image: 'my-app:latest',
        replicas: 3,
        resourceSpec: { cpu: 2, memoryMb: 4096 },
      });

      expect(result.id).toBe('deploy-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.provider).toBe('aws');
      expect(result.serviceName).toBe('my-app');
      expect(result.status).toBe('deploying');
      expect(mockDeploymentRepo.createDeployment).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== getDeployment ====================

  describe('getDeployment', () => {
    it('部署不存在时应返回 null', async () => {
      mockDeploymentRepo.findById.mockResolvedValue(undefined);

      const result = await layer.getDeployment('nonexistent', 'tenant-1');
      expect(result).toBeNull();
    });

    it('租户不匹配时应返回 null', async () => {
      const now = new Date();
      mockDeploymentRepo.findById.mockResolvedValue({
        id: 'deploy-1',
        tenant_id: 'other-tenant',
        provider: 'aws',
        service_name: 'app',
        status: 'active',
        resources: [],
        error_message: null,
        created_at: now,
        updated_at: now,
      });

      const result = await layer.getDeployment('deploy-1', 'tenant-1');
      expect(result).toBeNull();
    });

    it('应该返回匹配的部署', async () => {
      const now = new Date();
      mockDeploymentRepo.findById.mockResolvedValue({
        id: 'deploy-1',
        tenant_id: 'tenant-1',
        provider: 'aws',
        service_name: 'my-app',
        status: 'active',
        resources: ['res-1'],
        error_message: null,
        created_at: now,
        updated_at: now,
      });

      const result = await layer.getDeployment('deploy-1', 'tenant-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('deploy-1');
      expect(result!.serviceName).toBe('my-app');
      expect(result!.status).toBe('active');
      expect(result!.resources).toEqual(['res-1']);
    });
  });

  // ==================== listDeployments ====================

  describe('listDeployments', () => {
    it('应该返回租户的部署列表', async () => {
      const now = new Date();
      mockDeploymentRepo.findByTenant.mockResolvedValue([
        {
          id: 'd-1',
          tenant_id: 'tenant-1',
          provider: 'aws',
          service_name: 'app-1',
          status: 'active',
          resources: [],
          error_message: null,
          created_at: now,
          updated_at: now,
        },
      ]);

      const result = await layer.listDeployments('tenant-1');
      expect(result.length).toBe(1);
      expect(result[0].serviceName).toBe('app-1');
    });

    it('没有部署时应返回空数组', async () => {
      mockDeploymentRepo.findByTenant.mockResolvedValue([]);

      const result = await layer.listDeployments('tenant-1');
      expect(result).toEqual([]);
    });
  });

  // ==================== deleteResource ====================

  describe('deleteResource', () => {
    it('应该删除资源', async () => {
      mockResourceRepo.deleteResource.mockResolvedValue(true);

      const result = await layer.deleteResource('r-1', 'tenant-1');

      expect(result).toBe(true);
      expect(mockResourceRepo.deleteResource).toHaveBeenCalledWith('r-1', 'tenant-1');
    });

    it('资源不存在时应返回 false', async () => {
      mockResourceRepo.deleteResource.mockResolvedValue(false);

      const result = await layer.deleteResource('nonexistent', 'tenant-1');
      expect(result).toBe(false);
    });
  });
});
