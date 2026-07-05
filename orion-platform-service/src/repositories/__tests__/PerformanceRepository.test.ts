import {
  PerformanceBaselineRepository,
  PerformanceEvaluationRepository,
  PerformanceTestResultRepository,
  PerformanceProfileRepository,
} from '../PerformanceRepository';

describe('PerformanceBaselineRepository', () => {
  let repo: PerformanceBaselineRepository;
  let mockDb: any;

  const mockBaselineRow = (overrides: any = {}) => ({
    id: 'pb1',
    tenant_id: 't1',
    service: 'api-gateway',
    environment: 'production',
    metrics: { p95_latency: 200, error_rate: 0.01 },
    thresholds: { p95_latency: { min: 100, max: 500 } },
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PerformanceBaselineRepository(mockDb);
  });

  test('should create performance baseline', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockBaselineRow()], rowCount: 1 });
    const result = await repo.create({
      tenant_id: 't1',
      service: 'api-gateway',
      environment: 'production',
      metrics: { p95_latency: 200, error_rate: 0.01 },
      thresholds: { p95_latency: { min: 100, max: 500 } },
      version: 1,
    } as any);
    expect(result.id).toBe('pb1');
    expect(result.tenant_id).toBe('t1');
    expect(result.service).toBe('api-gateway');
    expect(result.metrics).toEqual({ p95_latency: 200, error_rate: 0.01 });
  });

  test('should find baseline by tenant and service', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockBaselineRow()] });
    const result = await repo.findByTenantAndService('t1', 'api-gateway');
    expect(result).toBeDefined();
    expect(result!.service).toBe('api-gateway');
    expect(result!.version).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1 AND service = $2'),
      ['t1', 'api-gateway'],
    );
  });

  test('should return undefined when baseline not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.findByTenantAndService('t1', 'nonexistent');
    expect(result).toBeUndefined();
  });

  test('should find baselines by tenant', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockBaselineRow(),
        mockBaselineRow({ id: 'pb2', service: 'payment-svc', version: 2 }),
      ],
    });
    const result = await repo.findByTenant('t1');
    expect(result.length).toBe(2);
    expect(result[0].tenant_id).toBe('t1');
    expect(result[1].service).toBe('payment-svc');
  });

  test('should delete baseline by tenant and service', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
    const deleted = await repo.deleteByTenantAndService('t1', 'api-gateway');
    expect(deleted).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM performance_baselines'),
      ['t1', 'api-gateway'],
    );
  });

  test('should return false when delete affects no rows', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const deleted = await repo.deleteByTenantAndService('t1', 'nonexistent');
    expect(deleted).toBe(false);
  });
});

describe('PerformanceEvaluationRepository', () => {
  let repo: PerformanceEvaluationRepository;
  let mockDb: any;

  const mockEvalRow = (overrides: any = {}) => ({
    id: 'pe1',
    baseline_id: 'pb1',
    tenant_id: 't1',
    service: 'api-gateway',
    overall: 'healthy',
    details: [{ metric: 'p95_latency', status: 'ok' }],
    evaluated_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PerformanceEvaluationRepository(mockDb);
  });

  test('should create performance evaluation', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockEvalRow()], rowCount: 1 });
    const result = await repo.create({
      baseline_id: 'pb1',
      tenant_id: 't1',
      service: 'api-gateway',
      overall: 'healthy',
      details: [{ metric: 'p95_latency', status: 'ok' }],
    } as any);
    expect(result.id).toBe('pe1');
    expect(result.overall).toBe('healthy');
    expect(result.details).toEqual([{ metric: 'p95_latency', status: 'ok' }]);
  });

  test('should find evaluations by baseline id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockEvalRow(), mockEvalRow({ id: 'pe2', overall: 'degraded' })],
    });
    const result = await repo.findByBaselineId('pb1', 10);
    expect(result.length).toBe(2);
    expect(result[0].baseline_id).toBe('pb1');
    expect(result[1].overall).toBe('degraded');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE baseline_id = $1'),
      ['pb1', 10],
    );
  });

  test('should find evaluations by tenant with default limit', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockEvalRow()],
    });
    const result = await repo.findByTenant('t1');
    expect(result.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1'),
      ['t1', 50],
    );
  });
});

describe('PerformanceTestResultRepository', () => {
  let repo: PerformanceTestResultRepository;
  let mockDb: any;

  const mockTestRow = (overrides: any = {}) => ({
    id: 'ptr1',
    tenant_id: 't1',
    service: 'api-gateway',
    baseline_id: 'pb1',
    test_name: 'load-test-v1',
    metrics: { rps: 1000, p99: 350 },
    status: 'pass',
    failures: null,
    duration: 120,
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PerformanceTestResultRepository(mockDb);
  });

  test('should create test result', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockTestRow()], rowCount: 1 });
    const result = await repo.create({
      tenant_id: 't1',
      service: 'api-gateway',
      baseline_id: 'pb1',
      test_name: 'load-test-v1',
      metrics: { rps: 1000, p99: 350 },
      status: 'pass',
      duration: 120,
    } as any);
    expect(result.id).toBe('ptr1');
    expect(result.test_name).toBe('load-test-v1');
    expect(result.status).toBe('pass');
    expect(result.duration).toBe(120);
  });

  test('should find test results by service', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockTestRow(), mockTestRow({ id: 'ptr2', status: 'fail' })],
    });
    const result = await repo.findByService('api-gateway', 20);
    expect(result.length).toBe(2);
    expect(result[0].service).toBe('api-gateway');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE service = $1'),
      ['api-gateway', 20],
    );
  });

  test('should find test results by tenant', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockTestRow()] });
    const result = await repo.findByTenant('t1');
    expect(result.length).toBe(1);
    expect(result[0].tenant_id).toBe('t1');
  });
});

describe('PerformanceProfileRepository', () => {
  let repo: PerformanceProfileRepository;
  let mockDb: any;

  const mockProfileRow = (overrides: any = {}) => ({
    id: 'pp1',
    tenant_id: 't1',
    service_name: 'api-gateway',
    config: { duration: '5m', concurrency: 50 },
    status: 'completed',
    results: { avg_latency: 150 },
    error_message: null,
    created_at: new Date(),
    completed_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PerformanceProfileRepository(mockDb);
  });

  test('should create performance profile', async () => {
    mockDb.query.mockResolvedValue({ rows: [mockProfileRow()], rowCount: 1 });
    const result = await repo.create({
      tenant_id: 't1',
      service_name: 'api-gateway',
      config: { duration: '5m', concurrency: 50 },
      status: 'pending',
    } as any);
    expect(result.id).toBe('pp1');
    expect(result.service_name).toBe('api-gateway');
    expect(result.status).toBe('completed');
    expect(result.results).toEqual({ avg_latency: 150 });
  });

  test('should find profiles by service', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockProfileRow(), mockProfileRow({ id: 'pp2', status: 'running' })],
    });
    const result = await repo.findByService('api-gateway');
    expect(result.length).toBe(2);
    expect(result[0].service_name).toBe('api-gateway');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE service_name = $1'),
      ['api-gateway', 50],
    );
  });

  test('should update profile results', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockProfileRow({ status: 'completed', results: { avg_latency: 120 } })],
    });
    const result = await repo.updateResults('pp1', { avg_latency: 120 }, 'completed');
    expect(result.status).toBe('completed');
    expect(result.results).toEqual({ avg_latency: 120 });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE performance_profiles'),
      expect.arrayContaining([expect.stringContaining('120'), 'completed', null, 'pp1']),
    );
  });

  test('should throw OrionError when updating non-existent profile', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await expect(repo.updateResults('nonexistent', {}, 'completed')).rejects.toThrow('not found');
  });
});
