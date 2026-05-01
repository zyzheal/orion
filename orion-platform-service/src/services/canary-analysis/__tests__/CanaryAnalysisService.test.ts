/**
 * CanaryAnalysisService 单元测试
 *
 * Uses mock repositories to test business logic without a real database.
 */

import { CanaryAnalysisService } from '../CanaryAnalysisService';
import {
  CanaryAnalysisRepository,
  CanaryMetricResultRepository,
  CanaryMLResultRepository,
  CanaryAnalysisConfigRepository,
  CanaryDecisionRepository,
} from '../../../repositories/CanaryAnalysisRepository';

// ==================== Mock Repositories ====================

function createMockDb() {
  const stores: Record<string, any[]> = {
    canary_analysis_runs: [],
    canary_metric_results: [],
    canary_ml_results: [],
    canary_analysis_configs: [],
    canary_decisions: [],
  };

  const db = {
    query: async (text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> => {
      // Simple mock: just return empty rows
      return { rows: [], rowCount: 0 };
    },
  };
  return { db, stores };
}

function makeMockRepository<T extends { id?: string }>(tableName: string, store: any[]) {
  return {
    async findById(id: string): Promise<T | undefined> {
      return store.find((r: any) => r.id === id) as T | undefined;
    },
    async findAll(options: any = {}): Promise<{ entities: T[]; total: number }> {
      let entities = [...store] as T[];
      if (options.limit) entities = entities.slice(0, options.limit);
      return { entities, total: entities.length };
    },
    async create(data: any): Promise<T> {
      const entity = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, ...data };
      store.push(entity);
      return entity as T;
    },
    async delete(id: string): Promise<boolean> {
      const idx = store.findIndex((r: any) => r.id === id);
      if (idx === -1) return false;
      store.splice(idx, 1);
      return true;
    },
  };
}

function makeRunRepository(store: any[]) {
  const base = makeMockRepository('canary_analysis_runs', store);
  return {
    ...base,
    async findByDeployment(deploymentId: string) {
      return store.filter((r: any) => r.deployment_id === deploymentId);
    },
    async findByStatus(status: string) {
      return store.filter((r: any) => r.status === status);
    },
    async updateRunStatus(id: string, status: string, decision: string, confidence: number, completedAt: Date) {
      const run = store.find((r: any) => r.id === id);
      if (run) {
        run.status = status;
        run.decision = decision;
        run.confidence = confidence;
        run.completed_at = completedAt;
      }
      return run ?? null;
    },
  };
}

function makeMetricRepository(store: any[]) {
  const base = makeMockRepository('canary_metric_results', store);
  return {
    ...base,
    async findByRun(runId: string) {
      return store.filter((r: any) => r.run_id === runId);
    },
    async batchCreate(metrics: any[]) {
      const results = metrics.map(m => ({ id: `mock-metric-${Math.random().toString(36).slice(2, 9)}`, ...m }));
      store.push(...results);
      return results;
    },
  };
}

function makeMLRepository(store: any[]) {
  const base = makeMockRepository('canary_ml_results', store);
  return {
    ...base,
    async findByRun(runId: string) {
      return store.filter((r: any) => r.run_id === runId);
    },
    async batchCreate(items: any[]) {
      const results = items.map(m => ({ id: `mock-ml-${Math.random().toString(36).slice(2, 9)}`, ...m }));
      store.push(...results);
      return results;
    },
  };
}

function makeConfigRepository(store: any[]) {
  const base = makeMockRepository('canary_analysis_configs', store);
  return {
    ...base,
    async findByServiceEnv(serviceName: string, environment: string) {
      return store.find((r: any) => r.service_name === serviceName && r.environment === environment);
    },
    async updateConfig(id: string, updates: any) {
      const config = store.find((r: any) => r.id === id);
      if (config) {
        Object.assign(config, updates, { updated_at: new Date() });
      }
      return config ?? null;
    },
  };
}

function makeDecisionRepository(store: any[]) {
  const base = makeMockRepository('canary_decisions', store);
  return {
    ...base,
    async findByRun(runId: string) {
      return store.filter((r: any) => r.run_id === runId);
    },
    async create(data: any): Promise<any> {
      const entity = { id: `mock-decision-${Math.random().toString(36).slice(2, 9)}`, ...data };
      store.push(entity);
      return entity;
    },
  };
}

function createMockService() {
  const runStore: any[] = [];
  const metricStore: any[] = [];
  const mlStore: any[] = [];
  const configStore: any[] = [];
  const decisionStore: any[] = [];

  const service = new CanaryAnalysisService({
    runRepository: makeRunRepository(runStore) as unknown as CanaryAnalysisRepository,
    metricRepository: makeMetricRepository(metricStore) as unknown as CanaryMetricResultRepository,
    mlRepository: makeMLRepository(mlStore) as unknown as CanaryMLResultRepository,
    configRepository: makeConfigRepository(configStore) as unknown as CanaryAnalysisConfigRepository,
    decisionRepository: makeDecisionRepository(decisionStore) as unknown as CanaryDecisionRepository,
  });
  return { service, runStore, metricStore, mlStore, configStore, decisionStore };
}

// ==================== Tests ====================

describe('CanaryAnalysisService', () => {
  describe('simulateAnalysisRun', () => {
    it('should create a run with promote status', async () => {
      const { service } = createMockService();
      const result = await service.simulateAnalysisRun({
        deploymentId: 'deploy-1',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      expect(result.run.id).toBeDefined();
      expect(result.run.status).toBe('promote');
      expect(result.metrics).toHaveLength(4);
      expect(result.mlResults).toHaveLength(2);
    });

    it('should fallback to mock metrics when Prometheus unavailable', async () => {
      const { service } = createMockService();
      const result = await service.simulateAnalysisRun({
        deploymentId: 'deploy-1',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      const latency = result.metrics.find(m => m.metricName === 'http_request_duration_seconds');
      expect(latency).toBeDefined();
      expect(latency?.baselineValue).toBe(0.125);
      expect(latency?.canaryValue).toBe(0.132);
    });
  });

  describe('createRun and listRuns', () => {
    it('should create and list runs', async () => {
      const { service } = createMockService();
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
      const { service } = createMockService();
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

    it('should list all configs', async () => {
      const { service } = createMockService();
      await service.createConfig({
        serviceName: 'svc-a',
        environment: 'prod',
      });
      await service.createConfig({
        serviceName: 'svc-b',
        environment: 'staging',
      });
      const configs = await service.listConfigs();
      expect(configs.length).toBeGreaterThanOrEqual(2);
    });

    it('should update a config', async () => {
      const { service } = createMockService();
      const config = await service.createConfig({
        serviceName: 'update-test',
        environment: 'dev',
        maxRounds: 5,
      });
      const updated = await service.updateConfig(config.id, { maxRounds: 10 });
      expect(updated).toBeDefined();
      expect(updated?.maxRounds).toBe(10);
    });

    it('should delete a config', async () => {
      const { service } = createMockService();
      const config = await service.createConfig({
        serviceName: 'delete-test',
        environment: 'dev',
      });
      const deleted = await service.deleteConfig(config.id);
      expect(deleted).toBe(true);
    });
  });

  describe('force promote/rollback', () => {
    it('should force promote a run', async () => {
      const { service } = createMockService();
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
      const { service } = createMockService();
      const run = await service.createRun({
        deploymentId: 'deploy-5',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      const rolledback = await service.forceRollback(run.id, 'high error rate');
      expect(rolledback.status).toBe('rollback');
      expect(rolledback.decision).toBe('rollback');
    });

    it('should throw if run not found', async () => {
      const { service } = createMockService();
      await expect(service.forcePromote('nonexistent', 'reason')).rejects.toThrow('not found');
    });
  });

  describe('getRunById', () => {
    it('should return undefined for non-existent run', async () => {
      const { service } = createMockService();
      const run = await service.getRunById('nonexistent');
      expect(run).toBeUndefined();
    });
  });

  describe('getMetrics and getMLResults', () => {
    it('should return empty arrays for run with no results', async () => {
      const { service } = createMockService();
      const run = await service.createRun({
        deploymentId: 'deploy-empty',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });
      const metrics = await service.getMetrics(run.id);
      const mlResults = await service.getMLResults(run.id);
      expect(metrics).toEqual([]);
      expect(mlResults).toEqual([]);
    });
  });

  describe('metric discovery & model retraining', () => {
    it('should discover metrics', async () => {
      const { service } = createMockService();
      const result = await service.discoverMetrics();
      expect(result.metrics).toBeDefined();
      expect(Array.isArray(result.metrics)).toBe(true);
      expect(result.metrics.length).toBeGreaterThan(0);
    });

    it('should trigger model retraining', async () => {
      const { service } = createMockService();
      const result = await service.retrainModel('canary-v2');
      expect(result.jobId).toBeDefined();
      expect(result.modelName).toBe('canary-v2');
      expect(result.status).toBe('queued');
    });
  });
});
