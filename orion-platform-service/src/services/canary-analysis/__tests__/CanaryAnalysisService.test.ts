import {
  CanaryAnalysisRepository,
  CanaryMetricResultRepository,
  CanaryMLResultRepository,
  CanaryAnalysisConfigRepository,
  CanaryDecisionRepository,
  CanaryRetrainJobRepository,
} from '../repositories/CanaryAnalysisRepository';
import { CanaryAnalysisService } from '../CanaryAnalysisService';

describe('CanaryAnalysisService', () => {
  let service: CanaryAnalysisService;
  let mockRunRepo: jest.Mocked<CanaryAnalysisRepository>;
  let mockMetricRepo: jest.Mocked<CanaryMetricResultRepository>;
  let mockMlRepo: jest.Mocked<CanaryMLResultRepository>;
  let mockConfigRepo: jest.Mocked<CanaryAnalysisConfigRepository>;
  let mockDecisionRepo: jest.Mocked<CanaryDecisionRepository>;
  let mockRetrainRepo: jest.Mocked<CanaryRetrainJobRepository>;

  beforeEach(() => {
    mockRunRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByDeployment: jest.fn(),
      findByStatus: jest.fn(),
      updateRunStatus: jest.fn(),
    } as any;

    mockMetricRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByRun: jest.fn(),
      batchCreate: jest.fn(),
    } as any;

    mockMlRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByRun: jest.fn(),
      batchCreate: jest.fn(),
    } as any;

    mockConfigRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByServiceEnv: jest.fn(),
      updateConfig: jest.fn(),
    } as any;

    mockDecisionRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByRun: jest.fn(),
    } as any;

    mockRetrainRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createJob: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    service = new CanaryAnalysisService(
      mockRunRepo,
      mockMetricRepo,
      mockMlRepo,
      mockConfigRepo,
      mockDecisionRepo,
      mockRetrainRepo
    );
  });

  describe('listRuns', () => {
    it('should list runs by deployment', async () => {
      const mockRuns = [
        { id: 'run-1', deploymentId: 'dep-1', runNumber: 1, trafficSplit: { canary: 10 }, status: 'running', confidence: null, decision: null, startedAt: new Date(), completedAt: null, durationMs: null },
      ];
      mockRunRepo.findByDeployment.mockResolvedValue(mockRuns);

      const result = await service.listRuns({ deploymentId: 'dep-1' });

      expect(mockRunRepo.findByDeployment).toHaveBeenCalledWith('dep-1');
      expect(result).toEqual(mockRuns);
    });

    it('should list runs by status', async () => {
      const mockRuns = [
        { id: 'run-1', deploymentId: 'dep-1', runNumber: 1, trafficSplit: {}, status: 'running', confidence: null, decision: null, startedAt: new Date(), completedAt: null, durationMs: null },
      ];
      mockRunRepo.findByStatus.mockResolvedValue(mockRuns);

      const result = await service.listRuns({ status: 'running' });

      expect(mockRunRepo.findByStatus).toHaveBeenCalledWith('running');
      expect(result).toEqual(mockRuns);
    });

    it('should return all runs when no filter', async () => {
      mockRunRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      await service.listRuns();

      expect(mockRunRepo.findAll).toHaveBeenCalled();
    });
  });

  describe('getRunById', () => {
    it('should return run by id', async () => {
      const mockRun = { id: 'run-1', deploymentId: 'dep-1', runNumber: 1, trafficSplit: {}, status: 'promote', confidence: 0.9, decision: 'promote', startedAt: new Date(), completedAt: new Date(), durationMs: 5000 };
      mockRunRepo.findById.mockResolvedValue(mockRun);

      const result = await service.getRunById('run-1');

      expect(result).toEqual(mockRun);
    });

    it('should return null when not found', async () => {
      mockRunRepo.findById.mockResolvedValue(undefined);

      const result = await service.getRunById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('simulateAnalysisRun', () => {
    it('should create run with simulated metrics and ML results', async () => {
      const mockRun = {
        id: 'run-1',
        deploymentId: 'dep-1',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
        status: 'running',
        confidence: null,
        decision: null,
        startedAt: new Date(),
        completedAt: null,
        durationMs: null,
      };
      mockRunRepo.create.mockResolvedValue(mockRun);
      mockRunRepo.updateRunStatus.mockResolvedValue({ ...mockRun, status: 'promote', decision: 'promote', confidence: 0.75, completedAt: new Date() });
      mockMetricRepo.create.mockResolvedValue({} as any);
      mockMlRepo.create.mockResolvedValue({} as any);
      mockDecisionRepo.create.mockResolvedValue({} as any);

      const result = await service.simulateAnalysisRun({
        deploymentId: 'dep-1',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });

      expect(mockRunRepo.create).toHaveBeenCalled();
      expect(mockRunRepo.updateRunStatus).toHaveBeenCalled();
      expect(mockMetricRepo.create).toHaveBeenCalled();
      expect(mockMlRepo.create).toHaveBeenCalled();
      expect(result.run).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.mlResults).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for run', async () => {
      const mockMetrics = [
        { id: 'm-1', runId: 'run-1', metricName: 'latency', baselineValue: 100, canaryValue: 110, verdict: 'pass', category: 'latency' },
      ];
      mockMetricRepo.findByRun.mockResolvedValue(mockMetrics);

      const result = await service.getMetrics('run-1');

      expect(mockMetricRepo.findByRun).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('getMLResults', () => {
    it('should return ML results for run', async () => {
      const mockResults = [
        { id: 'ml-1', runId: 'run-1', modelName: 'xgboost', prediction: 'healthy', confidence: 0.9 },
      ];
      mockMlRepo.findByRun.mockResolvedValue(mockResults);

      const result = await service.getMLResults('run-1');

      expect(mockMlRepo.findByRun).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(mockResults);
    });
  });

  describe('listConfigs', () => {
    it('should return all configs', async () => {
      const mockConfigs = [
        { id: 'c-1', serviceName: 'api', environment: 'staging', analysisIntervalSec: 300, maxRounds: 5, warmupPeriodSec: 600, promoteThreshold: 0.75, rollbackThreshold: 0.60, trafficStep: 20, metricWeights: null, excludedMetrics: [], sloMetrics: [], createdAt: new Date(), updatedAt: new Date() },
      ];
      mockConfigRepo.findAll.mockResolvedValue({ entities: mockConfigs, total: 1 });

      const result = await service.listConfigs();

      expect(mockConfigRepo.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('createConfig', () => {
    it('should create config', async () => {
      const input = { serviceName: 'api', environment: 'staging' };
      const created = { id: 'c-1', ...input, analysisIntervalSec: 300, maxRounds: 5, warmupPeriodSec: 600, promoteThreshold: 0.75, rollbackThreshold: 0.60, trafficStep: 20, metricWeights: null, excludedMetrics: [], sloMetrics: [], createdAt: new Date(), updatedAt: new Date() };
      mockConfigRepo.create.mockResolvedValue(created as any);

      const result = await service.createConfig(input);

      expect(mockConfigRepo.create).toHaveBeenCalled();
      expect(result.serviceName).toBe('api');
    });
  });

  describe('getConfigByServiceEnv', () => {
    it('should return config by service and environment', async () => {
      const mockConfig = { id: 'c-1', serviceName: 'api', environment: 'staging' };
      mockConfigRepo.findByServiceEnv.mockResolvedValue(mockConfig as any);

      const result = await service.getConfigByServiceEnv('api', 'staging');

      expect(mockConfigRepo.findByServiceEnv).toHaveBeenCalledWith('api', 'staging');
      expect(result).toEqual(mockConfig);
    });

    it('should return null when not found', async () => {
      mockConfigRepo.findByServiceEnv.mockResolvedValue(undefined);

      const result = await service.getConfigByServiceEnv('nonexistent', 'prod');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update config', async () => {
      const existing = { id: 'c-1', serviceName: 'api', environment: 'staging', analysisIntervalSec: 300 };
      const updated = { ...existing, analysisIntervalSec: 600 };
      mockConfigRepo.findById.mockResolvedValue(existing as any);
      mockConfigRepo.updateConfig.mockResolvedValue(updated as any);

      const result = await service.updateConfig('c-1', { analysisIntervalSec: 600 });

      expect(result?.analysisIntervalSec).toBe(600);
    });

    it('should return null when config not found', async () => {
      mockConfigRepo.findById.mockResolvedValue(undefined);

      const result = await service.updateConfig('nonexistent', { analysisIntervalSec: 600 });

      expect(result).toBeNull();
    });
  });

  describe('deleteConfig', () => {
    it('should delete config', async () => {
      mockConfigRepo.delete.mockResolvedValue(true);

      const result = await service.deleteConfig('c-1');

      expect(mockConfigRepo.delete).toHaveBeenCalledWith('c-1');
      expect(result).toBe(true);
    });
  });

  describe('forcePromote', () => {
    it('should force promote run', async () => {
      const existing = { id: 'run-1', deploymentId: 'dep-1', status: 'running', confidence: 0.5, decision: null, startedAt: new Date(), completedAt: null };
      mockRunRepo.findById.mockResolvedValue(existing as any);
      mockRunRepo.updateRunStatus.mockResolvedValue({ ...existing, status: 'promote', decision: 'promote', confidence: 1.0 } as any);
      mockDecisionRepo.create.mockResolvedValue({} as any);

      const result = await service.forcePromote('run-1', 'Manual approval');

      expect(result.status).toBe('promote');
      expect(result.decision).toBe('promote');
      expect(result.confidence).toBe(1.0);
    });

    it('should throw when run not found', async () => {
      mockRunRepo.findById.mockResolvedValue(undefined);

      await expect(service.forcePromote('nonexistent', 'reason')).rejects.toThrow('Run not found');
    });
  });

  describe('forceRollback', () => {
    it('should force rollback run', async () => {
      const existing = { id: 'run-1', deploymentId: 'dep-1', status: 'running', confidence: 0.5, decision: null, startedAt: new Date(), completedAt: null };
      mockRunRepo.findById.mockResolvedValue(existing as any);
      mockRunRepo.updateRunStatus.mockResolvedValue({ ...existing, status: 'rollback', decision: 'rollback', confidence: 0.0 } as any);
      mockDecisionRepo.create.mockResolvedValue({} as any);

      const result = await service.forceRollback('run-1', 'Issues detected');

      expect(result.status).toBe('rollback');
      expect(result.decision).toBe('rollback');
      expect(result.confidence).toBe(0.0);
    });

    it('should throw when run not found', async () => {
      mockRunRepo.findById.mockResolvedValue(undefined);

      await expect(service.forceRollback('nonexistent', 'reason')).rejects.toThrow('Run not found');
    });
  });

  describe('getMetricsSummary', () => {
    it('should return metrics summary', async () => {
      const mockRuns = [
        { status: 'promote', confidence: 0.9 },
        { status: 'promote', confidence: 0.8 },
        { status: 'rollback', confidence: 0.3 },
      ];
      mockRunRepo.findAll.mockResolvedValue({ entities: mockRuns as any, total: 3 });

      const result = await service.getMetricsSummary();

      expect(result.totalRuns).toBe(3);
      expect(result.promotedRuns).toBe(2);
      expect(result.rolledBackRuns).toBe(1);
      expect(result.averageConfidence).toBeCloseTo(0.667, 2);
    });

    it('should return default when no runs', async () => {
      mockRunRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      const result = await service.getMetricsSummary();

      expect(result.totalRuns).toBe(0);
      expect(result.passRate).toBe(0);
    });
  });

  describe('discoverMetrics', () => {
    it('should return available metrics', async () => {
      const result = await service.discoverMetrics();

      expect(result.metrics).toBeDefined();
      expect(Array.isArray(result.metrics)).toBe(true);
      expect(result.metrics.length).toBeGreaterThan(0);
    });
  });

  describe('triggerModelRetraining', () => {
    it('should trigger retraining job', async () => {
      mockRetrainRepo.createJob.mockResolvedValue({ id: 'job-1', model_name: 'xgboost', status: 'queued', submitted_at: new Date(), completed_at: null, error_message: null, created_at: new Date() });

      const result = await service.triggerModelRetraining('xgboost');

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe('queued');
      expect(mockRetrainRepo.createJob).toHaveBeenCalled();
    });
  });
});