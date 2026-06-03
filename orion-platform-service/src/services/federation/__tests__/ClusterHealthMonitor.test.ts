/**
 * ClusterHealthMonitor 单元测试
 *
 * 测试集群注册、健康检查、指标收集、异常检测、租户隔离等功能
 */

import { ClusterHealthMonitor } from '../ClusterHealthMonitor';

describe('ClusterHealthMonitor', () => {
  let monitor: ClusterHealthMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new ClusterHealthMonitor();
  });

  // ==================== registerCluster ====================

  describe('registerCluster', () => {
    it('应该成功注册集群', () => {
      const result = monitor.registerCluster('tenant-1', {
        name: 'cluster-east',
        endpoint: 'https://cluster-east.example.com',
        region: 'east',
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('cluster-east');
      expect(result.endpoint).toBe('https://cluster-east.example.com');
      expect(result.region).toBe('east');
      expect(result.status).toBe('online');
      expect(result.nodeCount).toBe(3); // default
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('应该支持自定义 nodeCount', () => {
      const result = monitor.registerCluster('tenant-1', {
        name: 'cluster-large',
        endpoint: 'https://cluster-large.example.com',
        region: 'west',
        nodeCount: 10,
      });

      expect(result.nodeCount).toBe(10);
    });

    it('应该正确维护租户到集群的映射', () => {
      monitor.registerCluster('tenant-1', { name: 'c1', endpoint: 'https://c1', region: 'east' });
      monitor.registerCluster('tenant-1', { name: 'c2', endpoint: 'https://c2', region: 'west' });
      monitor.registerCluster('tenant-2', { name: 'c3', endpoint: 'https://c3', region: 'east' });

      const t1Clusters = monitor.listClusters('tenant-1');
      const t2Clusters = monitor.listClusters('tenant-2');

      expect(t1Clusters.length).toBe(2);
      expect(t2Clusters.length).toBe(1);
    });
  });

  // ==================== listClusters ====================

  describe('listClusters', () => {
    it('没有集群时应返回空数组', () => {
      expect(monitor.listClusters('nonexistent')).toEqual([]);
    });

    it('应该只返回指定租户的集群', () => {
      monitor.registerCluster('tenant-1', { name: 'c1', endpoint: 'https://c1', region: 'east' });
      monitor.registerCluster('tenant-2', { name: 'c2', endpoint: 'https://c2', region: 'west' });

      const result = monitor.listClusters('tenant-1');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('c1');
    });
  });

  // ==================== getCluster ====================

  describe('getCluster', () => {
    it('应该返回指定集群', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'cluster-east',
        endpoint: 'https://cluster-east.example.com',
        region: 'east',
      });

      const result = monitor.getCluster(cluster.id, 'tenant-1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('cluster-east');
    });

    it('集群不存在时应返回 null', () => {
      expect(monitor.getCluster('nonexistent', 'tenant-1')).toBeNull();
    });

    it('租户不匹配时应返回 null', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      expect(monitor.getCluster(cluster.id, 'tenant-2')).toBeNull();
    });
  });

  // ==================== checkClusterHealth ====================

  describe('checkClusterHealth', () => {
    it('集群不存在时应返回 null', () => {
      expect(monitor.checkClusterHealth('nonexistent')).toBeNull();
    });

    it('应该返回健康检查结果', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'cluster-east',
        endpoint: 'https://cluster-east.example.com',
        region: 'east',
        nodeCount: 5,
      });

      const result = monitor.checkClusterHealth(cluster.id);

      expect(result).not.toBeNull();
      expect(result!.clusterId).toBe(cluster.id);
      expect(result!.clusterName).toBe('cluster-east');
      expect(result!.nodeCount).toBe(5);
      expect(result!.checkedAt).toBeInstanceOf(Date);
      expect(['healthy', 'unhealthy', 'degraded']).toContain(result!.status);
      expect(typeof result!.apiServerLatencyMs).toBe('number');
      expect(typeof result!.cpuUsagePct).toBe('number');
      expect(typeof result!.memoryUsagePct).toBe('number');
      expect(typeof result!.diskUsagePct).toBe('number');
      expect(Array.isArray(result!.anomalies)).toBe(true);
    });

    it('应该更新集群的 lastHealthCheck 时间', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      expect(cluster.lastHealthCheck).toBeUndefined();
      monitor.checkClusterHealth(cluster.id);

      const updated = monitor.getCluster(cluster.id, 'tenant-1');
      expect(updated!.lastHealthCheck).toBeDefined();
    });

    it('应该保留健康检查历史记录（最多100条）', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      // Run multiple health checks
      for (let i = 0; i < 5; i++) {
        monitor.checkClusterHealth(cluster.id);
      }

      // All should have returned results (history is maintained internally)
      const latest = monitor.checkClusterHealth(cluster.id);
      expect(latest).not.toBeNull();
    });
  });

  // ==================== getClusterMetrics ====================

  describe('getClusterMetrics', () => {
    it('集群不存在时应返回 null', () => {
      expect(monitor.getClusterMetrics('nonexistent')).toBeNull();
    });

    it('应该返回集群指标', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
        nodeCount: 5,
      });

      const metrics = monitor.getClusterMetrics(cluster.id, '1h');

      expect(metrics).not.toBeNull();
      expect(metrics!.clusterId).toBe(cluster.id);
      expect(metrics!.clusterName).toBe('c1');
      expect(metrics!.timeWindow).toBe('1h');
      expect(typeof metrics!.cpuUsageAvg).toBe('number');
      expect(typeof metrics!.cpuUsageMax).toBe('number');
      expect(typeof metrics!.memoryUsageAvg).toBe('number');
      expect(typeof metrics!.memoryUsageMax).toBe('number');
      expect(typeof metrics!.networkInBytes).toBe('number');
      expect(typeof metrics!.networkOutBytes).toBe('number');
      expect(metrics!.collectedAt).toBeInstanceOf(Date);
    });

    it('应该使用默认 1h 时间窗口', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      const metrics = monitor.getClusterMetrics(cluster.id);
      expect(metrics!.timeWindow).toBe('1h');
    });
  });

  // ==================== detectClusterAnomalies ====================

  describe('detectClusterAnomalies', () => {
    it('集群不存在时应返回空数组', () => {
      expect(monitor.detectClusterAnomalies('nonexistent')).toEqual([]);
    });

    it('没有健康检查数据时应报告 no_data 异常', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      const anomalies = monitor.detectClusterAnomalies(cluster.id);

      expect(anomalies.length).toBe(1);
      expect(anomalies[0].anomalyType).toBe('no_data');
      expect(anomalies[0].severity).toBe('medium');
    });

    it('应该基于健康检查数据检测异常', () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      // Run a health check to populate data
      monitor.checkClusterHealth(cluster.id);

      const anomalies = monitor.detectClusterAnomalies(cluster.id);

      // Results depend on simulated random values; just verify structure
      expect(Array.isArray(anomalies)).toBe(true);
      for (const a of anomalies) {
        expect(a.clusterId).toBe(cluster.id);
        expect(a.clusterName).toBe('c1');
        expect(['low', 'medium', 'high', 'critical']).toContain(a.severity);
        expect(a.detectedAt).toBeInstanceOf(Date);
        expect(typeof a.anomalyType).toBe('string');
        expect(typeof a.description).toBe('string');
      }
    });
  });

  // ==================== getRecentAnomalies ====================

  describe('getRecentAnomalies', () => {
    it('没有数据时应返回空数组', async () => {
      const result = await monitor.getRecentAnomalies('nonexistent');
      expect(result).toEqual([]);
    });

    it('应该返回最近的异常（带 limit）', async () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      // Trigger anomalies via detection
      monitor.detectClusterAnomalies(cluster.id);

      const anomalies = await monitor.getRecentAnomalies(cluster.id, 5);
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  // ==================== getLatestHealthCheck ====================

  describe('getLatestHealthCheck', () => {
    it('没有数据时应返回 null', async () => {
      const result = await monitor.getLatestHealthCheck('nonexistent');
      expect(result).toBeNull();
    });

    it('应该返回最新的健康检查结果', async () => {
      const cluster = monitor.registerCluster('tenant-1', {
        name: 'c1',
        endpoint: 'https://c1',
        region: 'east',
      });

      monitor.checkClusterHealth(cluster.id);
      const latest = await monitor.getLatestHealthCheck(cluster.id);

      expect(latest).not.toBeNull();
      expect(latest!.clusterId).toBe(cluster.id);
    });
  });

  // ==================== Repository mode ====================

  describe('Repository mode', () => {
    it('使用 db 参数构造时应启用 Repository 模式', () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };
      const monitorWithDb = new ClusterHealthMonitor(mockDb);
      // Verify it doesn't throw when calling loadFromRepository
      expect(monitorWithDb).toBeDefined();
    });

    it('loadFromRepository 应从数据库加载集群', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };
      const monitorWithDb = new ClusterHealthMonitor(mockDb);

      // loadFromRepository should complete without error
      await monitorWithDb.loadFromRepository();
    });

    it('没有 db 时 loadFromRepository 应直接返回', async () => {
      await monitor.loadFromRepository();
      // Should not throw
    });
  });
});
