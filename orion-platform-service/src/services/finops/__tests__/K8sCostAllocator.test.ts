/**
 * K8sCostAllocator 单元测试
 */

import { K8sCostAllocator } from '../K8sCostAllocator';

describe('K8sCostAllocator', () => {
  let allocator: K8sCostAllocator;

  beforeEach(() => {
    allocator = new K8sCostAllocator();
  });

  // ==================== Cluster Cost Allocation ====================

  describe('allocateClusterCosts', () => {
    it('should allocate costs to pods based on resource usage', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const podUsage = [
        {
          podName: 'pod-1',
          namespace: 'default',
          deployment: 'api-server',
          cpuRequest: 2,
          cpuUsed: 1.5,
          memoryRequest: 4,
          memoryUsed: 3,
          storageUsed: 10,
          nodeName: 'node-1',
        },
        {
          podName: 'pod-2',
          namespace: 'default',
          deployment: 'web-server',
          cpuRequest: 1,
          cpuUsed: 0.5,
          memoryRequest: 2,
          memoryUsed: 1.5,
          storageUsed: 5,
          nodeName: 'node-1',
        },
      ];

      const records = allocator.allocateClusterCosts(clusterUsage, podUsage);

      expect(records.length).toBe(2);
      expect(records[0].namespace).toBe('default');
      expect(records[0].deployment).toBe('api-server');
      expect(records[0].podName).toBe('pod-1');
      expect(records[0].totalCost).toBeGreaterThan(0);
    });

    it('should include tenant ID in cost records', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const podUsage = [
        {
          podName: 'pod-1',
          namespace: 'default',
          deployment: 'api-server',
          cpuRequest: 2,
          cpuUsed: 1,
          memoryRequest: 4,
          memoryUsed: 2,
          storageUsed: 10,
          tenantId: 'tenant-001',
        },
      ];

      const records = allocator.allocateClusterCosts(clusterUsage, podUsage);

      expect(records[0].tenantId).toBe('tenant-001');
    });

    it('should handle empty pod list', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const records = allocator.allocateClusterCosts(clusterUsage, []);

      expect(records.length).toBe(0);
    });

    it('should handle zero total resources without division by zero', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 0,
        usedCpuCores: 0,
        totalMemoryGB: 0,
        usedMemoryGB: 0,
        totalStorageGB: 0,
        usedStorageGB: 0,
        networkCost: 50,
      };

      const podUsage = [
        {
          podName: 'pod-1',
          namespace: 'default',
          deployment: 'api',
          cpuRequest: 1,
          cpuUsed: 0.5,
          memoryRequest: 2,
          memoryUsed: 1,
          storageUsed: 5,
        },
      ];

      // Should not throw
      const records = allocator.allocateClusterCosts(clusterUsage, podUsage);
      expect(records.length).toBe(1);
    });
  });

  // ==================== Namespace Costs ====================

  describe('getNamespaceCosts', () => {
    beforeEach(() => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'production', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10 },
        { podName: 'p2', namespace: 'production', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10 },
        { podName: 'p3', namespace: 'staging', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
    });

    it('should return costs for all namespaces', () => {
      const costs = allocator.getNamespaceCosts();

      expect(costs.length).toBe(2);
      expect(costs[0].namespace).toBe('production'); // Highest cost first
      expect(costs[1].namespace).toBe('staging');
    });

    it('should filter by namespace', () => {
      const costs = allocator.getNamespaceCosts({ namespace: 'production' });

      expect(costs.length).toBe(1);
      expect(costs[0].namespace).toBe('production');
    });

    it('should return empty for non-existent namespace', () => {
      const costs = allocator.getNamespaceCosts({ namespace: 'nonexistent' });
      expect(costs.length).toBe(0);
    });

    it('should sort by total cost descending', () => {
      const costs = allocator.getNamespaceCosts();

      for (let i = 0; i < costs.length - 1; i++) {
        expect(costs[i].totalCost).toBeGreaterThanOrEqual(costs[i + 1].totalCost);
      }
    });

    it('should include pod count', () => {
      const costs = allocator.getNamespaceCosts({ namespace: 'production' });

      expect(costs[0].podCount).toBe(2);
    });
  });

  // ==================== Pod Costs ====================

  describe('getPodCosts', () => {
    beforeEach(() => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 500,
        totalCpuCores: 8,
        usedCpuCores: 4,
        totalMemoryGB: 32,
        usedMemoryGB: 16,
        totalStorageGB: 200,
        usedStorageGB: 100,
        networkCost: 25,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
        { podName: 'p2', namespace: 'ns-1', deployment: 'worker', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
    });

    it('should return all pod costs', () => {
      const costs = allocator.getPodCosts();

      expect(costs.length).toBe(2);
    });

    it('should filter by namespace', () => {
      const costs = allocator.getPodCosts({ namespace: 'ns-1' });

      expect(costs.length).toBe(2);
    });

    it('should filter by deployment', () => {
      const costs = allocator.getPodCosts({ deployment: 'api' });

      expect(costs.length).toBe(1);
      expect(costs[0].deployment).toBe('api');
    });

    it('should sort by total cost descending', () => {
      const costs = allocator.getPodCosts();

      for (let i = 0; i < costs.length - 1; i++) {
        expect(costs[i].totalCost).toBeGreaterThanOrEqual(costs[i + 1].totalCost);
      }
    });
  });

  // ==================== Tenant Costs ====================

  describe('getTenantCosts', () => {
    it('should group costs by tenant', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10, tenantId: 'tenant-001' },
        { podName: 'p2', namespace: 'ns-1', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10, tenantId: 'tenant-001' },
        { podName: 'p3', namespace: 'ns-2', deployment: 'worker', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5, tenantId: 'tenant-002' },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
      const tenantCosts = allocator.getTenantCosts();

      expect(Object.keys(tenantCosts).length).toBe(2);
      expect(tenantCosts['tenant-001']).toBeGreaterThan(0);
      expect(tenantCosts['tenant-002']).toBeGreaterThan(0);
    });

    it('should filter by tenant ID', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10, tenantId: 'tenant-001' },
        { podName: 'p2', namespace: 'ns-2', deployment: 'worker', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5, tenantId: 'tenant-002' },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
      const tenantCosts = allocator.getTenantCosts({ tenantId: 'tenant-001' });

      expect(Object.keys(tenantCosts).length).toBe(1);
      expect(tenantCosts['tenant-001']).toBeDefined();
    });

    it('should return unknown for pods without tenant', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 500,
        totalCpuCores: 8,
        usedCpuCores: 4,
        totalMemoryGB: 32,
        usedMemoryGB: 16,
        totalStorageGB: 200,
        usedStorageGB: 100,
        networkCost: 25,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
      const tenantCosts = allocator.getTenantCosts();

      expect(tenantCosts['unknown']).toBeGreaterThan(0);
    });
  });

  // ==================== Deployment Costs ====================

  describe('getDeploymentCosts', () => {
    it('should group costs by deployment', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 1000,
        totalCpuCores: 16,
        usedCpuCores: 8,
        totalMemoryGB: 64,
        usedMemoryGB: 32,
        totalStorageGB: 500,
        usedStorageGB: 200,
        networkCost: 50,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10 },
        { podName: 'p2', namespace: 'ns-1', deployment: 'api', cpuRequest: 2, cpuUsed: 1, memoryRequest: 4, memoryUsed: 2, storageUsed: 10 },
        { podName: 'p3', namespace: 'ns-1', deployment: 'worker', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
      const deploymentCosts = allocator.getDeploymentCosts();

      expect(Object.keys(deploymentCosts).length).toBe(2);
      expect(deploymentCosts['ns-1/api'].podCount).toBe(2);
      expect(deploymentCosts['ns-1/worker'].podCount).toBe(1);
    });
  });

  // ==================== Record Management ====================

  describe('getRecords', () => {
    it('should return all records', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 500,
        totalCpuCores: 8,
        usedCpuCores: 4,
        totalMemoryGB: 32,
        usedMemoryGB: 16,
        totalStorageGB: 200,
        usedStorageGB: 100,
        networkCost: 25,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
      const records = allocator.getRecords();

      expect(records.length).toBe(1);
    });

    it('should return a copy of records', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 500,
        totalCpuCores: 8,
        usedCpuCores: 4,
        totalMemoryGB: 32,
        usedMemoryGB: 16,
        totalStorageGB: 200,
        usedStorageGB: 100,
        networkCost: 25,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);

      const records1 = allocator.getRecords();
      const records2 = allocator.getRecords();

      expect(records1).not.toBe(records2);
    });
  });

  describe('clearRecords', () => {
    it('should clear all records', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 500,
        totalCpuCores: 8,
        usedCpuCores: 4,
        totalMemoryGB: 32,
        usedMemoryGB: 16,
        totalStorageGB: 200,
        usedStorageGB: 100,
        networkCost: 25,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);
      allocator.clearRecords();

      expect(allocator.getRecordCount()).toBe(0);
    });
  });

  describe('getRecordCount', () => {
    it('should return 0 initially', () => {
      expect(allocator.getRecordCount()).toBe(0);
    });

    it('should return correct count after allocation', () => {
      const clusterUsage = {
        nodeName: 'node-1',
        nodeCost: 500,
        totalCpuCores: 8,
        usedCpuCores: 4,
        totalMemoryGB: 32,
        usedMemoryGB: 16,
        totalStorageGB: 200,
        usedStorageGB: 100,
        networkCost: 25,
      };

      const podUsage = [
        { podName: 'p1', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
        { podName: 'p2', namespace: 'ns-1', deployment: 'api', cpuRequest: 1, cpuUsed: 0.5, memoryRequest: 2, memoryUsed: 1, storageUsed: 5 },
      ];

      allocator.allocateClusterCosts(clusterUsage, podUsage);

      expect(allocator.getRecordCount()).toBe(2);
    });
  });
});
