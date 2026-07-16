import {
  CanaryAnalysisRepository,
  CanaryMetricResultRepository,
  CanaryMLResultRepository,
  CanaryAnalysisConfigRepository,
  CanaryDecisionRepository,
} from '../CanaryAnalysisRepository';

describe('CanaryAnalysisRepository', () => {
  let repo: CanaryAnalysisRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new CanaryAnalysisRepository(mockDb);
  });

  test('should create canary run', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'run-1', deployment_id: 'dep-1', run_number: 1, traffic_split: { canary: 10 }, status: 'running', confidence: null, decision: null, started_at: new Date(), completed_at: null, duration_ms: null }],
    });
    const result = await repo.create({ deploymentId: 'dep-1', runNumber: 1, trafficSplit: { canary: 10 }, status: 'running', startedAt: new Date() });
    expect(result.id).toBe('run-1');
    expect(result.status).toBe('running');
  });

  test('should find by deployment', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'run-1', deployment_id: 'dep-1', run_number: 1, traffic_split: {}, status: 'promote', confidence: 0.92, decision: 'promote', started_at: new Date(), completed_at: new Date(), duration_ms: 5000 }],
    });
    const result = await repo.findByDeployment('dep-1');
    expect(result.length).toBe(1);
    expect(result[0].deploymentId).toBe('dep-1');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'run-1', deployment_id: 'dep-1', run_number: 1, traffic_split: {}, status: 'running', confidence: null, decision: null, started_at: new Date(), completed_at: null, duration_ms: null }],
    });
    const result = await repo.findByStatus('running');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('running');
  });

  test('should update run status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'run-1', deployment_id: 'dep-1', run_number: 1, traffic_split: {}, status: 'promote', confidence: 0.92, decision: 'promote', started_at: new Date(), completed_at: new Date(), duration_ms: 5000 }],
    });
    const result = await repo.updateRunStatus('run-1', 'promote', 'promote', 0.92, new Date());
    expect(result?.status).toBe('promote');
    expect(result?.confidence).toBe(0.92);
  });
});

describe('CanaryMetricResultRepository', () => {
  let repo: CanaryMetricResultRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new CanaryMetricResultRepository(mockDb);
  });

  test('should find metrics by run', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'metric-1', run_id: 'run-1', metric_name: 'latency', baseline_value: 0.1, canary_value: 0.12, mann_whitney_p: 0.4, ks_statistic: 0.05, cliff_delta: 0.02, verdict: 'pass', category: 'latency' },
      ],
    });
    const result = await repo.findByRun('run-1');
    expect(result.length).toBe(1);
    expect(result[0].metricName).toBe('latency');
    expect(result[0].verdict).toBe('pass');
  });
});

describe('CanaryMLResultRepository', () => {
  let repo: CanaryMLResultRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new CanaryMLResultRepository(mockDb);
  });

  test('should find ML results by run', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'ml-1', run_id: 'run-1', model_name: 'xgboost', prediction: 'healthy', confidence: 0.92, shap_explanation: { latency: 0.1 }, cluster_id: null },
      ],
    });
    const result = await repo.findByRun('run-1');
    expect(result.length).toBe(1);
    expect(result[0].modelName).toBe('xgboost');
    expect(result[0].confidence).toBe(0.92);
  });
});

describe('CanaryAnalysisConfigRepository', () => {
  let repo: CanaryAnalysisConfigRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new CanaryAnalysisConfigRepository(mockDb);
  });

  test('should find config by service and environment', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'config-1', service_name: 'api-service', environment: 'staging', analysis_interval_sec: 300, max_rounds: 5, warmup_period_sec: 600, promote_threshold: 0.75, rollback_threshold: 0.60, traffic_step: 20, metric_weights: null, excluded_metrics: [], slo_metrics: [], created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findByServiceEnv('api-service', 'staging');
    expect(result?.serviceName).toBe('api-service');
    expect(result?.environment).toBe('staging');
  });

  test('should find all configs', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'config-1', service_name: 'api', environment: 'staging', analysis_interval_sec: 300, max_rounds: 5, warmup_period_sec: 600, promote_threshold: 0.75, rollback_threshold: 0.60, traffic_step: 20, metric_weights: null, excluded_metrics: [], slo_metrics: [], created_at: new Date(), updated_at: new Date() },
        { id: 'config-2', service_name: 'worker', environment: 'staging', analysis_interval_sec: 300, max_rounds: 5, warmup_period_sec: 600, promote_threshold: 0.75, rollback_threshold: 0.60, traffic_step: 20, metric_weights: null, excluded_metrics: [], slo_metrics: [], created_at: new Date(), updated_at: new Date() },
      ],
    });
    const result = await repo.findAll();
    expect(result.entities.length).toBe(2);
    expect(result.total).toBe(2);
  });

  test('should update config', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'config-1', service_name: 'api', environment: 'staging', analysis_interval_sec: 600, max_rounds: 5, warmup_period_sec: 600, promote_threshold: 0.80, rollback_threshold: 0.60, traffic_step: 20, metric_weights: null, excluded_metrics: [], slo_metrics: [], created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.updateConfig('config-1', { analysisIntervalSec: 600, promoteThreshold: 0.80 });
    expect(result?.analysisIntervalSec).toBe(600);
    expect(result?.promoteThreshold).toBe(0.80);
  });
});

describe('CanaryDecisionRepository', () => {
  let repo: CanaryDecisionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new CanaryDecisionRepository(mockDb);
  });

  test('should find decisions by run', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'dec-1', run_id: 'run-1', decision: 'promote', reason: 'All metrics passed', overridden_by: null, override_reason: null, decided_at: new Date() },
      ],
    });
    const result = await repo.findByRun('run-1');
    expect(result.length).toBe(1);
    expect(result[0].decision).toBe('promote');
    expect(result[0].reason).toBe('All metrics passed');
  });

  test('should create decision', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'dec-1', run_id: 'run-1', decision: 'rollback', reason: 'Force rollback', overridden_by: 'admin', override_reason: 'Manual override', decided_at: new Date() }],
    });
    const result = await repo.create({ runId: 'run-1', decision: 'rollback', reason: 'Force rollback', overriddenBy: 'admin', overrideReason: 'Manual override', decidedAt: new Date() });
    expect(result.decision).toBe('rollback');
    expect(result.overriddenBy).toBe('admin');
  });
});