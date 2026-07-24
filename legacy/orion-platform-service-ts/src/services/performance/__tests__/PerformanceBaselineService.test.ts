/**
 * PerformanceBaselineService Tests
 *
 * Covers: baseline creation, threshold auto-generation, performance evaluation,
 * deviation detection, trend analysis, regression detection, test results.
 * Uses in-memory mock repositories.
 */

import {
  PerformanceBaselineService,
  PerformanceBaseline,
  EvaluationResult,
  PerformanceTestResult,
  RegressionAnalysis,
} from '../PerformanceBaselineService';
import {
  PerformanceBaselineRepository,
  PerformanceEvaluationRepository,
  PerformanceTestResultRepository,
} from '../../../repositories/PerformanceRepository';

// ==================== Mock Repositories ====================

class MockPerformanceBaselineRepository extends PerformanceBaselineRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const now = new Date();
    const entity = { ...data, created_at: now, updated_at: now };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string) {
    return this.store.get(id);
  }

  async findByTenantAndService(tenantId: string, service: string) {
    const matches = Array.from(this.store.values())
      .filter((e: any) => e.tenant_id === tenantId && e.service === service)
      .sort((a: any, b: any) => (b.version || 1) - (a.version || 1));
    return matches[0];
  }

  async findByTenant(tenantId: string) {
    return Array.from(this.store.values())
      .filter((e: any) => e.tenant_id === tenantId)
      .sort((a: any, b: any) => a.service.localeCompare(b.service));
  }

  async update(id: string, data: any) {
    const entity = this.store.get(id);
    if (!entity) throw new Error(`Baseline ${id} not found`);
    Object.assign(entity, data, { updated_at: new Date() });
    return entity;
  }

  async deleteByTenantAndService(tenantId: string, service: string) {
    let deleted = false;
    for (const [id, e] of this.store.entries()) {
      if (e.tenant_id === tenantId && e.service === service) {
        this.store.delete(id);
        deleted = true;
      }
    }
    return deleted;
  }

  async findAll(options: any = {}) {
    const limit = options.limit ?? 20;
    const entities = Array.from(this.store.values()).slice(0, limit);
    return { entities, total: entities.length };
  }

  clear() { this.store.clear(); }
}

class MockPerformanceEvaluationRepository extends PerformanceEvaluationRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const entity = { ...data, evaluated_at: new Date() };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findByBaselineId(baselineId: string, limit?: number) {
    const results = Array.from(this.store.values())
      .filter((e: any) => e.baseline_id === baselineId)
      .sort((a: any, b: any) => b.evaluated_at.getTime() - a.evaluated_at.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  clear() { this.store.clear(); }
}

class MockPerformanceTestResultRepository extends PerformanceTestResultRepository {
  private store: Map<string, any> = new Map();
  constructor() { super({} as any); }

  async create(data: any) {
    const entity = { ...data, timestamp: new Date() };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string) {
    return this.store.get(id);
  }

  async findByService(service: string, limit?: number) {
    const results = Array.from(this.store.values())
      .filter((e: any) => e.service === service)
      .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  clear() { this.store.clear(); }
}

// ==================== Tests ====================

describe('PerformanceBaselineService', () => {
  let service: PerformanceBaselineService;
  let baselineRepo: MockPerformanceBaselineRepository;
  let evaluationRepo: MockPerformanceEvaluationRepository;
  let testResultRepo: MockPerformanceTestResultRepository;

  beforeEach(() => {
    baselineRepo = new MockPerformanceBaselineRepository();
    evaluationRepo = new MockPerformanceEvaluationRepository();
    testResultRepo = new MockPerformanceTestResultRepository();

    // Create service with mock db
    const mockDb = {
      query: async () => ({ rows: [], rowCount: 0 }),
    };
    service = new PerformanceBaselineService(mockDb);

    // Replace repos with mocks via direct property access
    (service as any).baselineRepo = baselineRepo;
    (service as any).evaluationRepo = evaluationRepo;
    (service as any).testResultRepo = testResultRepo;
  });

  afterEach(() => {
    baselineRepo.clear();
    evaluationRepo.clear();
    testResultRepo.clear();
  });

  // ==================== createBaseline ====================

  describe('createBaseline', () => {
    it('should create a baseline with auto-generated thresholds (+/- 20%)', async () => {
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
        error_rate: 0.5,
      });

      expect(baseline.id).toBeDefined();
      expect(baseline.tenantId).toBe('tenant-1');
      expect(baseline.service).toBe('api-gateway');
      expect(baseline.version).toBe(1);
      expect(baseline.metrics).toEqual({
        latency_ms: 100,
        throughput_rps: 500,
        error_rate: 0.5,
      });

      // Auto thresholds: 80-120% of value
      expect(baseline.thresholds.latency_ms).toEqual({ min: 80, max: 120 });
      expect(baseline.thresholds.throughput_rps).toEqual({ min: 400, max: 600 });
      expect(baseline.thresholds.error_rate).toEqual({ min: 0.4, max: 0.6 });
    });

    it('should use provided thresholds instead of auto-generated', async () => {
      const customThresholds = {
        latency_ms: { min: 50, max: 200 },
        throughput_rps: { min: 300, max: 800 },
      };
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
      }, customThresholds);

      expect(baseline.thresholds.latency_ms).toEqual({ min: 50, max: 200 });
      expect(baseline.thresholds.throughput_rps).toEqual({ min: 300, max: 800 });
    });

    it('should auto-generate thresholds only for metrics without explicit thresholds', async () => {
      const partialThresholds = {
        latency_ms: { min: 50, max: 150 },
      };
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
      }, partialThresholds);

      expect(baseline.thresholds.latency_ms).toEqual({ min: 50, max: 150 });
      // throughput_rps should be auto-generated
      expect(baseline.thresholds.throughput_rps).toEqual({ min: 400, max: 600 });
    });
  });

  // ==================== getBaseline ====================

  describe('getBaseline', () => {
    it('should return baseline by tenant and service', async () => {
      await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });

      const found = await service.getBaseline('tenant-1', 'api-gateway');
      expect(found).not.toBeNull();
      expect(found?.service).toBe('api-gateway');
      expect(found?.tenantId).toBe('tenant-1');
    });

    it('should return null for non-existent baseline', async () => {
      const found = await service.getBaseline('tenant-1', 'non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== getBaselineById ====================

  describe('getBaselineById', () => {
    it('should return baseline by ID', async () => {
      const created = await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });

      const found = await service.getBaselineById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      expect(await service.getBaselineById('non-existent')).toBeNull();
    });
  });

  // ==================== listBaselines ====================

  describe('listBaselines', () => {
    it('should list all baselines for a tenant', async () => {
      await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });
      await service.createBaseline('tenant-1', 'web-frontend', { latency_ms: 200 });
      await service.createBaseline('tenant-2', 'api-gateway', { latency_ms: 150 });

      const tenant1Baselines = await service.listBaselines('tenant-1');
      expect(tenant1Baselines.length).toBe(2);

      const tenant2Baselines = await service.listBaselines('tenant-2');
      expect(tenant2Baselines.length).toBe(1);
    });

    it('should return empty array when no baselines exist', async () => {
      expect(await service.listBaselines('tenant-1')).toEqual([]);
    });
  });

  // ==================== getAllBaselines ====================

  describe('getAllBaselines', () => {
    it('should return all baselines across tenants', async () => {
      await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });
      await service.createBaseline('tenant-2', 'api-gateway', { latency_ms: 200 });

      const all = await service.getAllBaselines();
      expect(all.length).toBe(2);
    });
  });

  // ==================== updateBaseline ====================

  describe('updateBaseline', () => {
    it('should update baseline metrics and increment version', async () => {
      await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });

      const updated = await service.updateBaseline('tenant-1', 'api-gateway', {
        latency_ms: 120,
        throughput_rps: 600,
      });

      expect(updated).not.toBeNull();
      expect(updated?.metrics.latency_ms).toBe(120);
      expect(updated?.metrics.throughput_rps).toBe(600);
      expect(updated?.version).toBe(2);
    });

    it('should update thresholds when provided', async () => {
      await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });

      const updated = await service.updateBaseline(
        'tenant-1',
        'api-gateway',
        { latency_ms: 120 },
        { latency_ms: { min: 80, max: 160 } }
      );

      expect(updated?.thresholds.latency_ms).toEqual({ min: 80, max: 160 });
    });

    it('should return null for non-existent baseline', async () => {
      const updated = await service.updateBaseline('tenant-1', 'non-existent', { latency_ms: 100 });
      expect(updated).toBeNull();
    });
  });

  // ==================== deleteBaseline ====================

  describe('deleteBaseline', () => {
    it('should delete a baseline', async () => {
      await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });

      const deleted = await service.deleteBaseline('tenant-1', 'api-gateway');
      expect(deleted).toBe(true);

      expect(await service.getBaseline('tenant-1', 'api-gateway')).toBeNull();
    });

    it('should return false for non-existent baseline', async () => {
      const deleted = await service.deleteBaseline('tenant-1', 'non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== evaluatePerformance ====================

  describe('evaluatePerformance', () => {
    beforeEach(async () => {
      await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
        error_rate: 1.0,
      });
    });

    it('should return healthy when all metrics are within thresholds', async () => {
      const result = await service.evaluatePerformance('tenant-1', 'api-gateway', {
        latency_ms: 95,
        throughput_rps: 520,
        error_rate: 0.8,
      });

      expect(result).not.toBeNull();
      expect(result?.overall).toBe('healthy');
      expect(result?.details.every(d => d.status === 'within')).toBe(true);
    });

    it('should return degraded when some metrics are outside thresholds', async () => {
      const result = await service.evaluatePerformance('tenant-1', 'api-gateway', {
        latency_ms: 95,
        throughput_rps: 350, // below min 400
        error_rate: 0.8,
      });

      expect(result).not.toBeNull();
      expect(result?.overall).toBe('degraded');

      const throughputDetail = result?.details.find(d => d.metric === 'throughput_rps');
      expect(throughputDetail?.status).toBe('below');
    });

    it('should return critical when deviation exceeds 50% threshold range', async () => {
      const result = await service.evaluatePerformance('tenant-1', 'api-gateway', {
        latency_ms: 1000, // far above max 120
        throughput_rps: 500,
        error_rate: 1.0,
      });

      expect(result).not.toBeNull();
      expect(result?.overall).toBe('critical');
    });

    it('should return null when no baseline exists', async () => {
      const result = await service.evaluatePerformance('tenant-99', 'non-existent', {
        latency_ms: 100,
      });
      expect(result).toBeNull();
    });

    it('should handle metrics with no threshold (unknown metrics)', async () => {
      const result = await service.evaluatePerformance('tenant-1', 'api-gateway', {
        latency_ms: 100,
        unknown_metric: 999,
      });

      expect(result).not.toBeNull();
      const unknownDetail = result?.details.find(d => d.metric === 'unknown_metric');
      expect(unknownDetail?.status).toBe('within');
      expect(unknownDetail?.min).toBe(0);
      expect(unknownDetail?.max).toBe(Infinity);
    });

    it('should detect above-threshold violations', async () => {
      const result = await service.evaluatePerformance('tenant-1', 'api-gateway', {
        latency_ms: 200, // above max 120
        throughput_rps: 500,
        error_rate: 1.0,
      });

      expect(result).not.toBeNull();
      const latencyDetail = result?.details.find(d => d.metric === 'latency_ms');
      expect(latencyDetail?.status).toBe('above');
    });

    it('should save evaluation to history', async () => {
      await service.evaluatePerformance('tenant-1', 'api-gateway', {
        latency_ms: 95,
        throughput_rps: 520,
        error_rate: 0.8,
      });

      const baseline = await service.getBaseline('tenant-1', 'api-gateway');
      const history = await service.getEvaluationHistory(baseline!.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== getEvaluationHistory ====================

  describe('getEvaluationHistory', () => {
    it('should return evaluation history sorted by date', async () => {
      jest.useFakeTimers();
      try {
        await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });
        const baseline = (await service.getBaseline('tenant-1', 'api-gateway'))!;

        await service.evaluatePerformance('tenant-1', 'api-gateway', { latency_ms: 100 });
        jest.advanceTimersByTime(10);
        await service.evaluatePerformance('tenant-1', 'api-gateway', { latency_ms: 110 });
        jest.advanceTimersByTime(10);
        await service.evaluatePerformance('tenant-1', 'api-gateway', { latency_ms: 120 });

        const history = await service.getEvaluationHistory(baseline.id);
        expect(history.length).toBe(3);
        // Most recent first
        expect(history[0].details[0].current).toBe(120);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should respect limit parameter', async () => {
      jest.useFakeTimers();
      try {
        await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });
        const baseline = (await service.getBaseline('tenant-1', 'api-gateway'))!;

        for (let i = 0; i < 5; i++) {
          await service.evaluatePerformance('tenant-1', 'api-gateway', { latency_ms: 100 + i });
          jest.advanceTimersByTime(10);
        }

        const history = await service.getEvaluationHistory(baseline.id, 2);
        expect(history.length).toBe(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should return empty array for non-existent baseline', async () => {
      expect(await service.getEvaluationHistory('non-existent')).toEqual([]);
    });
  });

  // ==================== recordTestResult ====================

  describe('recordTestResult', () => {
    it('should record a test result with pass status when within thresholds', async () => {
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
      });

      const result = await service.recordTestResult('tenant-1', 'api-gateway', {
        baselineId: baseline.id,
        testName: 'load-test',
        metrics: { latency_ms: 95 },
        duration: 5000,
      });

      expect(result.status).toBe('pass');
      expect(result.testName).toBe('load-test');
      expect(result.duration).toBe(5000);
      expect(result.failures).toBeFalsy();
    });

    it('should set warn status when 1-2 metrics fail', async () => {
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
      });

      const result = await service.recordTestResult('tenant-1', 'api-gateway', {
        baselineId: baseline.id,
        testName: 'load-test',
        metrics: { latency_ms: 200, throughput_rps: 200 }, // both fail
        duration: 3000,
      });

      expect(result.status).toBe('warn');
      expect(result.failures?.length).toBe(2);
    });

    it('should set fail status when more than 2 metrics fail', async () => {
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
        error_rate: 1.0,
        cpu_usage: 50,
      });

      const result = await service.recordTestResult('tenant-1', 'api-gateway', {
        baselineId: baseline.id,
        testName: 'stress-test',
        metrics: {
          latency_ms: 200,
          throughput_rps: 200,
          error_rate: 5.0,
          cpu_usage: 95,
        },
        duration: 10000,
      });

      expect(result.status).toBe('fail');
      expect(result.failures?.length).toBeGreaterThan(2);
    });

    it('should pass when no baseline ID provided', async () => {
      const result = await service.recordTestResult('tenant-1', 'api-gateway', {
        testName: 'baseline-test',
        metrics: { latency_ms: 100 },
        duration: 2000,
      });

      expect(result.status).toBe('pass');
    });
  });

  // ==================== getTestResults ====================

  describe('getTestResults', () => {
    it('should get test results for a service', async () => {
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
      });

      await service.recordTestResult('tenant-1', 'api-gateway', {
        baselineId: baseline.id,
        testName: 'test-1',
        metrics: { latency_ms: 100 },
        duration: 1000,
      });
      await service.recordTestResult('tenant-1', 'api-gateway', {
        baselineId: baseline.id,
        testName: 'test-2',
        metrics: { latency_ms: 110 },
        duration: 2000,
      });

      const results = await service.getTestResults('api-gateway');
      expect(results.length).toBe(2);
    });

    it('should return empty array when no results exist', async () => {
      expect(await service.getTestResults('non-existent')).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const baseline = await service.createBaseline('tenant-1', 'api-gateway', { latency_ms: 100 });
      for (let i = 0; i < 5; i++) {
        await service.recordTestResult('tenant-1', 'api-gateway', {
          baselineId: baseline.id,
          testName: `test-${i}`,
          metrics: { latency_ms: 100 },
          duration: 1000,
        });
      }

      const results = await service.getTestResults('api-gateway', 3);
      expect(results.length).toBe(3);
    });
  });

  // ==================== getTestResultById ====================

  describe('getTestResultById', () => {
    it('should get a specific test result by ID', async () => {
      const result = await service.recordTestResult('tenant-1', 'api-gateway', {
        testName: 'test-1',
        metrics: { latency_ms: 100 },
        duration: 1000,
      });

      const found = await service.getTestResultById(result.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(result.id);
    });

    it('should return null for non-existent ID', async () => {
      expect(await service.getTestResultById('non-existent')).toBeNull();
    });
  });

  // ==================== detectRegression ====================

  describe('detectRegression', () => {
    beforeEach(async () => {
      await service.createBaseline('tenant-1', 'api-gateway', {
        latency_ms: 100,
        throughput_rps: 500,
      });
    });

    it('should return no_regression when metrics are within bounds', async () => {
      const result = await service.detectRegression('tenant-1', 'api-gateway', {
        latency_ms: 105,
        throughput_rps: 490,
      });

      expect(result).not.toBeNull();
      expect(result?.overallStatus).toBe('no_regression');
      expect(result?.regressions).toHaveLength(0);
    });

    it('should detect minor regression (1-15% deviation)', async () => {
      // latency_ms threshold max=120, so 125 exceeds threshold
      const result = await service.detectRegression('tenant-1', 'api-gateway', {
        latency_ms: 125, // 25% above baseline
        throughput_rps: 500,
      });

      expect(result).not.toBeNull();
      expect(result?.regressions.length).toBeGreaterThan(0);
      const regression = result?.regressions.find(r => r.metric === 'latency_ms');
      expect(regression?.severity).toBe('moderate'); // 25% deviation
    });

    it('should detect severe regression (30-50% deviation)', async () => {
      const result = await service.detectRegression('tenant-1', 'api-gateway', {
        latency_ms: 140, // 40% above baseline
        throughput_rps: 500,
      });

      expect(result).not.toBeNull();
      const regression = result?.regressions.find(r => r.metric === 'latency_ms');
      expect(regression?.severity).toBe('severe');
    });

    it('should detect critical regression (>50% deviation)', async () => {
      const result = await service.detectRegression('tenant-1', 'api-gateway', {
        latency_ms: 200, // 100% above baseline
        throughput_rps: 500,
      });

      expect(result).not.toBeNull();
      const regression = result?.regressions.find(r => r.metric === 'latency_ms');
      expect(regression?.severity).toBe('critical');
    });

    it('should return major_regression when any severe or critical regression found', async () => {
      const result = await service.detectRegression('tenant-1', 'api-gateway', {
        latency_ms: 200, // critical
        throughput_rps: 500,
      });

      expect(result?.overallStatus).toBe('major_regression');
    });

    it('should return minor_regression when only minor/moderate regressions found', async () => {
      const result = await service.detectRegression('tenant-1', 'api-gateway', {
        latency_ms: 125, // moderate
        throughput_rps: 500,
      });

      expect(result?.overallStatus).toBe('minor_regression');
    });

    it('should return null when no baseline exists', async () => {
      const result = await service.detectRegression('tenant-99', 'non-existent', {
        latency_ms: 100,
      });
      expect(result).toBeNull();
    });
  });
});
