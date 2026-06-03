/**
 * FederationAdvancedService 单元测试
 *
 * 测试调度策略管理、跨集群作业调度、资源池管理等功能
 */

import { FederationAdvancedService } from '../FederationAdvancedService';

describe('FederationAdvancedService', () => {
  let service: FederationAdvancedService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FederationAdvancedService();
  });

  // ==================== Scheduling Policy Management ====================

  describe('createSchedulingPolicy', () => {
    it('应该成功创建调度策略', async () => {
      const result = await service.createSchedulingPolicy('tenant-1', {
        name: 'cost-optimized-policy',
        description: 'Optimize for cost',
        strategy: 'cost-optimized',
        rules: { maxCostPerMonth: 5000 },
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('cost-optimized-policy');
      expect(result.description).toBe('Optimize for cost');
      expect(result.strategy).toBe('cost-optimized');
      expect(result.rules).toEqual({ maxCostPerMonth: 5000 });
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('应该使用默认值创建策略', async () => {
      const result = await service.createSchedulingPolicy('tenant-1', {
        name: 'minimal-policy',
      });

      expect(result.strategy).toBe('balanced');
      expect(result.description).toBe('');
      expect(result.rules).toEqual({});
      expect(result.status).toBe('active');
    });

    it('应该支持不同的策略类型', async () => {
      const strategies = ['cost-optimized', 'latency-optimized', 'balanced', 'custom'] as const;

      for (const strategy of strategies) {
        const result = await service.createSchedulingPolicy('tenant-1', {
          name: `${strategy}-policy`,
          strategy,
        });
        expect(result.strategy).toBe(strategy);
      }
    });
  });

  describe('listSchedulingPolicies', () => {
    it('没有策略时应返回空数组', async () => {
      const result = await service.listSchedulingPolicies('tenant-1');
      expect(result).toEqual([]);
    });

    it('应该只返回指定租户的策略', async () => {
      await service.createSchedulingPolicy('tenant-1', { name: 'policy-1' });
      await service.createSchedulingPolicy('tenant-1', { name: 'policy-2' });
      await service.createSchedulingPolicy('tenant-2', { name: 'policy-3' });

      const t1Policies = await service.listSchedulingPolicies('tenant-1');
      const t2Policies = await service.listSchedulingPolicies('tenant-2');

      expect(t1Policies.length).toBe(2);
      expect(t2Policies.length).toBe(1);
      expect(t2Policies[0].name).toBe('policy-3');
    });
  });

  // ==================== Cross-Cluster Job Scheduling ====================

  describe('scheduleCrossClusterJob', () => {
    it('应该成功调度跨集群作业', async () => {
      const result = await service.scheduleCrossClusterJob('tenant-1', {
        name: 'deploy-app',
        targetClusters: ['cluster-east', 'cluster-west'],
        resourceRequirements: { cpu: 4, memory: 8192 },
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('deploy-app');
      expect(result.targetClusters).toEqual(['cluster-east', 'cluster-west']);
      expect(result.status).toBe('pending');
      expect(result.scheduledAt).toBeDefined();
      expect(result.completedAt).toBeNull();
      expect(result.spec).toBeDefined();
    });

    it('应该支持单集群调度', async () => {
      const result = await service.scheduleCrossClusterJob('tenant-1', {
        name: 'single-cluster-job',
        targetClusters: ['cluster-east'],
      });

      expect(result.targetClusters).toEqual(['cluster-east']);
      expect(result.status).toBe('pending');
    });
  });

  // ==================== Resource Pool Management ====================

  describe('createResourcePool', () => {
    it('应该成功创建资源池', async () => {
      const result = await service.createResourcePool('tenant-1', {
        name: 'compute-pool',
        description: 'General compute pool',
        clusterId: 'cluster-east',
        cpu: 64,
        memory: 131072,
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('compute-pool');
      expect(result.description).toBe('General compute pool');
      expect(result.clusterId).toBe('cluster-east');
      expect(result.cpu).toBe(64);
      expect(result.memory).toBe(131072);
      expect(result.usedCpu).toBe(0);
      expect(result.usedMemory).toBe(0);
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
    });

    it('应该使用默认描述', async () => {
      const result = await service.createResourcePool('tenant-1', {
        name: 'pool-no-desc',
        clusterId: 'cluster-1',
        cpu: 16,
        memory: 32768,
      });

      expect(result.description).toBe('');
    });
  });

  describe('getResourcePoolStatus', () => {
    it('资源池不存在时应返回 null', async () => {
      const result = await service.getResourcePoolStatus('nonexistent');
      expect(result).toBeNull();
    });

    it('应该返回资源池状态', async () => {
      const pool = await service.createResourcePool('tenant-1', {
        name: 'compute-pool',
        clusterId: 'cluster-east',
        cpu: 32,
        memory: 65536,
      });

      const result = await service.getResourcePoolStatus(pool.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(pool.id);
      expect(result!.name).toBe('compute-pool');
      expect(result!.cpu).toBe(32);
      expect(result!.memory).toBe(65536);
      expect(result!.usedCpu).toBe(0);
      expect(result!.usedMemory).toBe(0);
      expect(result!.status).toBe('active');
    });
  });
});
