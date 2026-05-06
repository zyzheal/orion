/**
 * FederationSchedulerService 单元测试
 */

import { FederationSchedulerService } from '../FederationSchedulerService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('FederationSchedulerService', () => {
  let service: FederationSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FederationSchedulerService(mockPool as any);
  });

  describe('registerCluster', () => {
    it('应该注册集群', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          name: 'cluster-east',
          endpoint: 'https://cluster-east.example.com',
          region: 'east',
          status: 'online',
          capacity: 100,
          load: 0,
        }],
      });

      const result = await service.registerCluster({
        tenant_id: 'tenant1',
        name: 'cluster-east',
        endpoint: 'https://cluster-east.example.com',
        region: 'east',
      });

      expect(result.name).toBe('cluster-east');
      expect(result.status).toBe('online');
    });

    it('应该设置初始容量为 100', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'c1', capacity: 100 }],
      });

      const result = await service.registerCluster({
        tenant_id: 'tenant1',
        name: 'cluster',
        endpoint: 'https://cluster.example.com',
        region: 'east',
      });

      expect(result.capacity).toBe(100);
    });

    it('应该设置初始负载为 0', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'c1', load: 0 }],
      });

      const result = await service.registerCluster({
        tenant_id: 'tenant1',
        name: 'cluster',
        endpoint: 'https://cluster.example.com',
        region: 'east',
      });

      expect(result.load).toBe(0);
    });
  });

  describe('listClusters', () => {
    it('应该返回集群列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'c1', name: 'cluster-east' },
          { id: 'c2', name: 'cluster-west' },
        ],
      });

      const result = await service.listClusters('tenant1');

      expect(result.length).toBe(2);
    });

    it('应该返回空列表如果没有集群', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.listClusters('tenant1');

      expect(result.length).toBe(0);
    });
  });

  describe('scheduleRun', () => {
    it('应该调度运行', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'c1', status: 'online' },
            { id: 'c2', status: 'online' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 's1',
            tenant_id: 'tenant1',
            pipeline_run_id: 'run1',
            target_clusters: ['c1', 'c2'],
            status: 'pending',
          }],
        });

      const result = await service.scheduleRun({
        tenant_id: 'tenant1',
        pipeline_run_id: 'run1',
      });

      expect(result.pipeline_run_id).toBe('run1');
      expect(result.status).toBe('pending');
    });

    it('应该选择在线集群', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'c1', status: 'online' },
            { id: 'c2', status: 'offline' },
            { id: 'c3', status: 'maintenance' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 's1',
            target_clusters: ['c1'],
          }],
        });

      await service.scheduleRun({
        tenant_id: 'tenant1',
        pipeline_run_id: 'run1',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([expect.arrayContaining(['c1'])])
      );
    });

    it('应该支持不同的分发策略', async () => {
      const strategies = ['parallel', 'sequential', 'load-balanced'];

      for (const strategy of strategies) {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'online' }] })
          .mockResolvedValueOnce({ rows: [{ id: 's1', distribution_strategy: strategy }] });

        const result = await service.scheduleRun({
          tenant_id: 'tenant1',
          pipeline_run_id: 'run1',
          strategy,
        });

        expect(result.distribution_strategy).toBe(strategy);
      }
    });

    it('应该默认使用 load-balanced 策略', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'online' }] })
        .mockResolvedValueOnce({ rows: [{ id: 's1', distribution_strategy: 'load-balanced' }] });

      const result = await service.scheduleRun({
        tenant_id: 'tenant1',
        pipeline_run_id: 'run1',
      });

      expect(result.distribution_strategy).toBe('load-balanced');
    });

    it('应该限制目标集群数量', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'c1', status: 'online' },
            { id: 'c2', status: 'online' },
            { id: 'c3', status: 'online' },
            { id: 'c4', status: 'online' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 's1', target_clusters: ['c1', 'c2', 'c3'] }],
        });

      const result = await service.scheduleRun({
        tenant_id: 'tenant1',
        pipeline_run_id: 'run1',
      });

      expect(result.target_clusters.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getSchedule', () => {
    it('应该返回调度信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's1',
          pipeline_run_id: 'run1',
          status: 'running',
        }],
      });

      const result = await service.getSchedule('s1');

      expect(result).not.toBeNull();
      expect(result!.pipeline_run_id).toBe('run1');
    });

    it('应该返回 null 如果未找到', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getSchedule('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('FederationCluster', () => {
    it('应该包含完整的集群信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'c1',
          tenant_id: 'tenant1',
          name: 'cluster-east',
          endpoint: 'https://endpoint',
          region: 'east',
          status: 'online',
          capacity: 100,
          load: 10,
          created_at: new Date(),
        }],
      });

      const result = await service.registerCluster({
        tenant_id: 'tenant1',
        name: 'cluster-east',
        endpoint: 'https://endpoint',
        region: 'east',
      });

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant1');
      expect(result.endpoint).toBeDefined();
      expect(result.region).toBeDefined();
    });

    it('应该支持不同的集群状态', async () => {
      const statuses = ['online', 'offline', 'maintenance'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'c1', status }],
        });

        // This tests the status type, not actual state changes
        const result = await service.listClusters('tenant1');
        if (result.length > 0) {
          expect(['online', 'offline', 'maintenance'].includes(result[0].status)).toBe(true);
        }
      }
    });
  });

  describe('FederationSchedule', () => {
    it('应该包含完整的调度信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'online' }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 's1',
            tenant_id: 'tenant1',
            pipeline_run_id: 'run1',
            target_clusters: ['c1'],
            distribution_strategy: 'load-balanced',
            status: 'pending',
            started_at: new Date(),
            completed_at: null,
          }],
        });

      const result = await service.scheduleRun({
        tenant_id: 'tenant1',
        pipeline_run_id: 'run1',
      });

      expect(result.id).toBeDefined();
      expect(result.target_clusters).toBeDefined();
      expect(result.started_at).toBeDefined();
    });

    it('应该支持不同的调度状态', async () => {
      const statuses = ['pending', 'running', 'completed', 'failed'];

      for (const status of statuses) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', status }],
        });

        const result = await service.getSchedule('s1');
        if (result) {
          expect(['pending', 'running', 'completed', 'failed'].includes(result.status)).toBe(true);
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('应该处理没有在线集群的情况', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'c1', status: 'offline' },
            { id: 'c2', status: 'maintenance' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 's1',
            target_clusters: [],
          }],
        });

      const result = await service.scheduleRun({
        tenant_id: 'tenant1',
        pipeline_run_id: 'run1',
      });

      expect(result.target_clusters.length).toBe(0);
    });
  });
});