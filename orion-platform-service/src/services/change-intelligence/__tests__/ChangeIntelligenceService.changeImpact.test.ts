/**
 * ChangeIntelligenceService - getChangeImpact() Deep Tests
 *
 * Covers trend calculation, topAffectedServices aggregation,
 * avgRiskScore rounding, and edge cases.
 */

import {
  ChangeIntelligenceService,
} from '../ChangeIntelligenceService';
import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
} from '../../../repositories/ChangeIntelligenceRepository';

const createMockDb = () => ({
  query: jest.fn(),
});

const mockReportEntity = (overrides: Record<string, any> = {}) => ({
  id: 'report-1',
  pr_id: 'PR-123',
  repo_id: 'repo-1',
  commit_sha: 'abc123def',
  risk_score: 0.75,
  risk_level: 'high',
  affected_services: 3,
  affected_capabilities: 2,
  shap_factors: [],
  gitlab_comment_posted: false,
  created_at: new Date('2026-01-15'),
  updated_at: new Date('2026-01-15'),
  ...overrides,
});

const mockAffectedService = (overrides: Record<string, any> = {}) => ({
  id: 'svc-1',
  report_id: 'report-1',
  service_name: 'payment-service',
  service_tier: 'tier-0',
  impact_type: 'direct',
  changed_files: ['src/payment.ts'],
  slo_risk: 'high',
  recommended_reviewers: ['user-1'],
  ...overrides,
});

describe('ChangeIntelligenceService.getChangeImpact()', () => {
  let service: ChangeIntelligenceService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    const changeIntelligenceRepo = new ChangeIntelligenceRepository(mockDb);
    const affectedServiceRepo = new AffectedServiceRepository(mockDb);
    const riskFactorRepo = new RiskFactorRepository(mockDb);
    const historicalMatchRepo = new HistoricalMatchRepository(mockDb);

    service = new ChangeIntelligenceService(
      changeIntelligenceRepo,
      affectedServiceRepo,
      riskFactorRepo,
      historicalMatchRepo,
    );
  });

  test('should return zero metrics when no reports exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.getChangeImpact(30);

    expect(result.totalAnalyses).toBe(0);
    expect(result.highRiskCount).toBe(0);
    expect(result.criticalRiskCount).toBe(0);
    expect(result.avgRiskScore).toBe(0);
    expect(result.topAffectedServices).toEqual([]);
    expect(result.trend).toBe('stable');
  });

  test('should count high-risk reports correctly', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'high', risk_score: 0.7 }),
        mockReportEntity({ id: 'r2', risk_level: 'high', risk_score: 0.65 }),
        mockReportEntity({ id: 'r3', risk_level: 'low', risk_score: 0.1 }),
      ],
    });

    const result = await service.getChangeImpact(30);

    expect(result.highRiskCount).toBe(2);
  });

  test('should count critical-risk reports correctly', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'critical', risk_score: 0.9 }),
        mockReportEntity({ id: 'r2', risk_level: 'critical', risk_score: 0.85 }),
        mockReportEntity({ id: 'r3', risk_level: 'medium', risk_score: 0.4 }),
      ],
    });

    const result = await service.getChangeImpact(30);

    expect(result.criticalRiskCount).toBe(2);
  });

  test('should calculate avgRiskScore correctly and round to 2 decimals', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_score: 0.333 }),
        mockReportEntity({ id: 'r2', risk_score: 0.667 }),
      ],
    });

    const result = await service.getChangeImpact(30);

    // (0.333 + 0.667) / 2 = 0.5
    expect(result.avgRiskScore).toBe(0.5);
  });

  test('should round avgRiskScore to 2 decimal places', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_score: 0.333 }),
        mockReportEntity({ id: 'r2', risk_score: 0.333 }),
        mockReportEntity({ id: 'r3', risk_score: 0.334 }),
      ],
    });

    const result = await service.getChangeImpact(30);

    // (0.333 + 0.333 + 0.334) / 3 = 0.333333... -> 0.33
    expect(result.avgRiskScore).toBe(0.33);
  });

  test('should determine increasing trend when recent 7-day avg is 10%+ above overall', async () => {
    // Overall avg = 0.4, recent 7-day avg = 0.5 (> 0.4 * 1.1 = 0.44)
    const lowReports = Array.from({ length: 5 }, (_, i) =>
      mockReportEntity({ id: `low-${i}`, risk_score: 0.4, risk_level: 'medium' }),
    );

    // First call: findRecent(30) -> low risk
    // Second through N+1: findByReport for each report (aggregating affected services)
    // Next call: findRecent(7) -> high risk
    const queryCalls: any[] = [];
    // findRecent(30)
    queryCalls.push(Promise.resolve({ rows: lowReports }));
    // findByReport for each of the 5 reports (affected services aggregation)
    for (let i = 0; i < 5; i++) {
      queryCalls.push(Promise.resolve({ rows: [] }));
    }
    // findRecent(7) -> higher risk
    queryCalls.push(Promise.resolve({
      rows: [
        mockReportEntity({ id: 'r7-1', risk_score: 0.5, risk_level: 'high' }),
        mockReportEntity({ id: 'r7-2', risk_score: 0.5, risk_level: 'high' }),
      ],
    }));

    let callIndex = 0;
    mockDb.query.mockImplementation(() => queryCalls[callIndex++]);

    const result = await service.getChangeImpact(30);

    expect(result.trend).toBe('increasing');
  });

  test('should determine decreasing trend when recent 7-day avg is 10%+ below overall', async () => {
    // Overall avg = 0.6, recent 7-day avg = 0.4 (< 0.6 * 0.9 = 0.54)
    const highReports = Array.from({ length: 5 }, (_, i) =>
      mockReportEntity({ id: `high-${i}`, risk_score: 0.6, risk_level: 'high' }),
    );

    const queryCalls: any[] = [];
    // findRecent(30)
    queryCalls.push(Promise.resolve({ rows: highReports }));
    // findByReport for each report
    for (let i = 0; i < 5; i++) {
      queryCalls.push(Promise.resolve({ rows: [] }));
    }
    // findRecent(7) -> lower risk
    queryCalls.push(Promise.resolve({
      rows: [
        mockReportEntity({ id: 'r7-1', risk_score: 0.4, risk_level: 'medium' }),
      ],
    }));

    let callIndex = 0;
    mockDb.query.mockImplementation(() => queryCalls[callIndex++]);

    const result = await service.getChangeImpact(30);

    expect(result.trend).toBe('decreasing');
  });

  test('should determine stable trend when recent 7-day avg is within 10% of overall', async () => {
    // Overall avg = 0.5, recent 7-day avg = 0.5 (within 10%)
    const reports = Array.from({ length: 5 }, (_, i) =>
      mockReportEntity({ id: `r-${i}`, risk_score: 0.5, risk_level: 'medium' }),
    );

    const queryCalls: any[] = [];
    queryCalls.push(Promise.resolve({ rows: reports }));
    for (let i = 0; i < 5; i++) {
      queryCalls.push(Promise.resolve({ rows: [] }));
    }
    queryCalls.push(Promise.resolve({
      rows: [
        mockReportEntity({ id: 'r7-1', risk_score: 0.5, risk_level: 'medium' }),
      ],
    }));

    let callIndex = 0;
    mockDb.query.mockImplementation(() => queryCalls[callIndex++]);

    const result = await service.getChangeImpact(30);

    expect(result.trend).toBe('stable');
  });

  test('should aggregate topAffectedServices by name', async () => {
    const reports = [
      mockReportEntity({ id: 'r1' }),
      mockReportEntity({ id: 'r2' }),
    ];

    const queryCalls: any[] = [];
    // findRecent(30)
    queryCalls.push(Promise.resolve({ rows: reports }));
    // findByReport for r1
    queryCalls.push(Promise.resolve({
      rows: [
        mockAffectedService({ id: 'svc-1', report_id: 'r1', service_name: 'payment-svc' }),
        mockAffectedService({ id: 'svc-2', report_id: 'r1', service_name: 'auth-svc' }),
      ],
    }));
    // findByReport for r2
    queryCalls.push(Promise.resolve({
      rows: [
        mockAffectedService({ id: 'svc-3', report_id: 'r2', service_name: 'payment-svc' }),
        mockAffectedService({ id: 'svc-4', report_id: 'r2', service_name: 'order-svc' }),
      ],
    }));
    // findRecent(7)
    queryCalls.push(Promise.resolve({ rows: reports }));

    let callIndex = 0;
    mockDb.query.mockImplementation(() => queryCalls[callIndex++]);

    const result = await service.getChangeImpact(30);

    expect(result.topAffectedServices).toHaveLength(3);
    // payment-svc appears twice, should be first
    expect(result.topAffectedServices[0]).toEqual({ serviceName: 'payment-svc', count: 2 });
  });

  test('should limit topAffectedServices to 10', async () => {
    const reports = [mockReportEntity({ id: 'r1' })];
    const manyServices = Array.from({ length: 15 }, (_, i) =>
      mockAffectedService({ id: `svc-${i}`, service_name: `service-${i}` }),
    );

    const queryCalls: any[] = [];
    queryCalls.push(Promise.resolve({ rows: reports }));
    queryCalls.push(Promise.resolve({ rows: manyServices }));
    queryCalls.push(Promise.resolve({ rows: reports }));

    let callIndex = 0;
    mockDb.query.mockImplementation(() => queryCalls[callIndex++]);

    const result = await service.getChangeImpact(30);

    expect(result.topAffectedServices).toHaveLength(10);
  });

  test('should pass correct days parameter to findRecent', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.getChangeImpact(7);

    // findRecent(7) is called, then findRecent(7) again for trend
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INTERVAL'),
      [7],
    );
  });

  test('should handle database errors', async () => {
    mockDb.query.mockRejectedValue(new Error('Database timeout'));

    await expect(service.getChangeImpact(30)).rejects.toThrow('Database timeout');
  });
});
