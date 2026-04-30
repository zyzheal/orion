/**
 * CanaryAnalysisService 单元测试
 */

import { CanaryAnalysisService } from '../CanaryAnalysisService';

describe('CanaryAnalysisService', () => {
  let service: CanaryAnalysisService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    service = new CanaryAnalysisService();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => jest.restoreAllMocks());

  describe('simulateAnalysisRun', () => {
    it('should fallback to mock metrics when Prometheus unavailable', async () => {
      // No PROMETHEUS_URL set, should use mock fallback values
      const result = await service.simulateAnalysisRun({
        deploymentId: 'deploy-1',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      expect(result.run.status).toBe('promote');
      expect(result.metrics).toHaveLength(4);
      // Check fallback values
      const latency = result.metrics.find(m => m.metricName === 'http_request_duration_seconds');
      expect(latency).toBeDefined();
      expect(latency?.baselineValue).toBe(0.125);
      expect(latency?.canaryValue).toBe(0.132);
    });

    it('should use Prometheus metrics when available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          status: 'success',
          data: { result: [{ values: [[1000, '0.2'], [1060, '0.25']] }] },
        })),
      });

      // Temporarily set env var
      const oldUrl = process.env.PROMETHEUS_URL;
      process.env.PROMETHEUS_URL = 'http://prometheus:9090';

      // Create new service with env var set
      service = new CanaryAnalysisService();

      const result = await service.simulateAnalysisRun({
        deploymentId: 'deploy-2',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      expect(result.run.status).toBe('promote');
      expect(result.metrics).toHaveLength(4);

      // Restore env
      process.env.PROMETHEUS_URL = oldUrl;
    });
  });

  describe('createRun and listRuns', () => {
    it('should create and list runs', async () => {
      const run = await service.createRun({
        deploymentId: 'deploy-3',
        runNumber: 1,
        trafficSplit: { canary: 20, baseline: 80 },
      });
      expect(run.id).toBeDefined();
      expect(run.status).toBe('running');

      const runs = await service.listRuns({ deploymentId: 'deploy-3' });
      expect(runs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('config CRUD', () => {
    it('should create and retrieve config', async () => {
      const config = await service.createConfig({
        serviceName: 'test-service',
        environment: 'staging',
        analysisIntervalSec: 300,
        maxRounds: 5,
        warmupPeriodSec: 600,
        promoteThreshold: 0.75,
        rollbackThreshold: 0.60,
        trafficStep: 20,
      });
      expect(config.id).toBeDefined();
      expect(config.serviceName).toBe('test-service');

      const retrieved = await service.getConfigByServiceEnv('test-service', 'staging');
      expect(retrieved).toBeDefined();
      expect(retrieved?.serviceName).toBe('test-service');
    });
  });

  describe('force promote/rollback', () => {
    it('should force promote a run', async () => {
      const run = await service.createRun({
        deploymentId: 'deploy-4',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      const promoted = await service.forcePromote(run.id, 'urgent release');
      expect(promoted.status).toBe('promote');
      expect(promoted.decision).toBe('promote');
    });

    it('should force rollback a run', async () => {
      const run = await service.createRun({
        deploymentId: 'deploy-5',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      const rolledback = await service.forceRollback(run.id, 'high error rate');
      expect(rolledback.status).toBe('rollback');
      expect(rolledback.decision).toBe('rollback');
    });
  });
});
