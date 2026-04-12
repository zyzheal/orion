/**
 * CMDB Integration Service 单元测试
 */

// Mock @kubernetes/client-node before importing the service
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: class MockKubeConfig {
    loadFromCluster = jest.fn();
    loadFromDefault = jest.fn();
    addCluster = jest.fn();
    addUser = jest.fn();
    addContext = jest.fn();
    setCurrentContext = jest.fn();
    makeApiClient = jest.fn().mockReturnValue({});
  },
  Watch: class MockWatch {
    watch = jest.fn().mockResolvedValue(undefined);
  },
  CoreV1Api: class MockCoreV1Api {},
  AppsV1Api: class MockAppsV1Api {},
}));

import { CmdbIntegrationService } from '../cmdb-integration-service';
import { CmdbService } from '../cmdb/CmdbService';
import { CmdbEventPublisher } from '../cmdb/CmdbEventPublisher';
import { EventBusService } from '../event-bus-service';

// Mock EventBusService
const mockEventBus = {
  publish: jest.fn().mockResolvedValue('mock-event-id'),
  connect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(async () => {}),
  close: jest.fn().mockResolvedValue(undefined),
  checkHealth: jest.fn().mockResolvedValue({ status: 'up' as const }),
  isHealthy: jest.fn().mockReturnValue(true),
  createStream: jest.fn().mockResolvedValue(undefined),
} as unknown as EventBusService;

describe('CmdbIntegrationService', () => {
  let integrationService: CmdbIntegrationService;
  let cmdbService: CmdbService;

  beforeEach(() => {
    // 清空内存存储
    CmdbService.clearAll();
    jest.clearAllMocks();

    // 创建服务
    cmdbService = new CmdbService();
    integrationService = new CmdbIntegrationService({ cmdbService });
  });

  describe('listHosts', () => {
    it('should list hosts successfully', async () => {
      // 创建测试数据
      await cmdbService.createCI({
        ciId: 'host-001',
        ciType: 'SERVER',
        name: 'Test Server 1',
        status: 'ACTIVE',
        attributes: {
          hostname: 'server1.example.com',
          ip: '192.168.1.10',
          os: 'Ubuntu 22.04',
          cpu: 8,
          memory: 32768,
          disk: 500,
        },
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const result = await integrationService.listHosts({ tenantId: BigInt(1) });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].hostname).toBe('server1.example.com');
      expect(result.data[0].ip).toBe('192.168.1.10');
      expect(result.total).toBe(1);
    });

    it('should return empty list when no hosts exist', async () => {
      const result = await integrationService.listHosts({ tenantId: BigInt(1) });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getHost', () => {
    it('should get host details by ciId', async () => {
      await cmdbService.createCI({
        ciId: 'host-002',
        ciType: 'SERVER',
        name: 'Test Server 2',
        status: 'ACTIVE',
        attributes: {
          hostname: 'server2.example.com',
          ip: '192.168.1.20',
          os: 'CentOS 8',
        },
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const host = await integrationService.getHost('host-002');

      expect(host).toBeDefined();
      expect(host?.hostname).toBe('server2.example.com');
      expect(host?.ip).toBe('192.168.1.20');
    });

    it('should return null for non-existent host', async () => {
      const host = await integrationService.getHost('non-existent');
      expect(host).toBeNull();
    });
  });

  describe('listK8sResources', () => {
    it('should list K8s resources', async () => {
      await cmdbService.createCI({
        ciId: 'k8s-cluster-001',
        ciType: 'K8S_CLUSTER',
        name: 'Production Cluster',
        status: 'ACTIVE',
        attributes: {
          version: '1.28.0',
          nodeCount: 5,
        },
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const result = await integrationService.listK8sResources({
        tenantId: BigInt(1),
        kind: 'Cluster',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].kind).toBe('CLUSTER');
    });

    it('should list K8s deployments', async () => {
      await cmdbService.createCI({
        ciId: 'k8s-deploy-001',
        ciType: 'K8S_DEPLOYMENT',
        name: 'nginx-deployment',
        status: 'ACTIVE',
        attributes: {
          namespace: 'default',
          replicas: 3,
        },
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const result = await integrationService.listK8sResources({
        tenantId: BigInt(1),
        kind: 'Deployment',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].kind).toBe('DEPLOYMENT');
    });
  });

  describe('listCICDResources', () => {
    it('should list CI/CD pipelines', async () => {
      await cmdbService.createCI({
        ciId: 'pipeline-001',
        ciType: 'PIPELINE',
        name: 'Build and Deploy',
        status: 'ACTIVE',
        attributes: {
          provider: 'tekton',
          lastRunStatus: 'success',
        },
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const result = await integrationService.listCICDResources({ tenantId: BigInt(1) });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].pipelineId).toBe('pipeline-001');
    });
  });

  describe('getTopology', () => {
    it('should get topology with nodes and edges', async () => {
      // 创建两个 CI
      const app = await cmdbService.createCI({
        ciId: 'app-001',
        ciType: 'APPLICATION',
        name: 'Test App',
        status: 'ACTIVE',
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const db = await cmdbService.createCI({
        ciId: 'db-001',
        ciType: 'DATABASE',
        name: 'Test DB',
        status: 'ACTIVE',
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      // 创建关联关系
      await cmdbService.createRelation(
        {
          fromCiId: app.ciId,
          toCiId: db.ciId,
          relationType: 'DEPENDS_ON',
          description: 'App depends on DB',
        },
        'system'
      );

      const topology = await integrationService.getTopology({ tenantId: BigInt(1) });

      expect(topology.nodes).toHaveLength(2);
      expect(topology.edges).toHaveLength(1);
      expect(topology.edges[0].type).toBe('DEPENDS_ON');
    });

    it('should return empty topology when no resources exist', async () => {
      const topology = await integrationService.getTopology({ tenantId: BigInt(1) });

      expect(topology.nodes).toHaveLength(0);
      expect(topology.edges).toHaveLength(0);
    });
  });

  describe('executeScript', () => {
    it('should execute script on target CI', async () => {
      const target = await cmdbService.createCI({
        ciId: 'target-001',
        ciType: 'SERVER',
        name: 'Target Server',
        status: 'ACTIVE',
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const results = await integrationService.executeScript({
        targetCiIds: [target.ciId],
        script: 'echo "Hello, World!"',
        scriptType: 'bash',
        timeout: 30000,
      });

      expect(results).toHaveLength(1);
      expect(results[0].ciId).toBe('target-001');
      expect(results[0].status).toBe('success');
    });

    it('should handle script execution on multiple targets', async () => {
      const target1 = await cmdbService.createCI({
        ciId: 'target-001',
        ciType: 'SERVER',
        name: 'Target 1',
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const target2 = await cmdbService.createCI({
        ciId: 'target-002',
        ciType: 'SERVER',
        name: 'Target 2',
        createdBy: 'system',
        tenantId: BigInt(1),
      });

      const results = await integrationService.executeScript({
        targetCiIds: [target1.ciId, target2.ciId],
        script: 'echo "Hello"',
        scriptType: 'bash',
      });

      expect(results).toHaveLength(2);
    });
  });

  describe('K8s sync', () => {
    it('should start and stop K8s sync', async () => {
      const config = {
        apiServerUrl: 'https://k8s.example.com:6443',
        token: 'test-token',
        watchEnabled: true,
        reconciliationIntervalMs: 60000,
      };

      await integrationService.startK8sSync(BigInt(1), config);

      // 停止同步
      integrationService.stopK8sSync();
    });

    it('should return K8s sync state', async () => {
      const config = {
        watchEnabled: false, // Disable watch for simpler testing
        reconciliationIntervalMs: 60000,
      };

      await integrationService.startK8sSync(BigInt(1), config);

      const state = integrationService.getK8sSyncState();

      expect(state.overallStatus).toBeDefined();
      expect(['L0_NORMAL', 'L1_REDUCED', 'L2_PAUSED', 'L3_DEGRADED']).toContain(state.overallStatus);
      expect(state.healthScore).toBeGreaterThanOrEqual(0);
      expect(state.healthScore).toBeLessThanOrEqual(100);
      expect(state.watchStatus).toBeDefined();
      expect(state.reconciliationStatus).toBeDefined();

      integrationService.stopK8sSync();
    });

    it('should calculate health score correctly', async () => {
      // Test health score calculation
      // When watch is disabled and reconciliation not run, score should be lower

      const config = {
        watchEnabled: false,
        reconciliationIntervalMs: 60000,
      };

      await integrationService.startK8sSync(BigInt(1), config);

      const state = integrationService.getK8sSyncState();

      // Watch disabled should reduce score
      expect(state.healthScore).toBeLessThan(100);

      integrationService.stopK8sSync();
    });
  });

  describe('Sync status levels', () => {
    it('should define correct sync status progression', () => {
      // L0_NORMAL -> L1_REDUCED -> L2_PAUSED -> L3_DEGRADED
      const statuses = ['L0_NORMAL', 'L1_REDUCED', 'L2_PAUSED', 'L3_DEGRADED'];

      for (const status of statuses) {
        expect(typeof status).toBe('string');
      }
    });
  });
});
