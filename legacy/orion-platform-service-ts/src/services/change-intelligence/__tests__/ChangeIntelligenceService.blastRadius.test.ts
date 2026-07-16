/**
 * ChangeIntelligenceService - getBlastRadius() Deep Tests
 *
 * Covers critical services filtering, serviceTiers aggregation,
 * file deduplication, and edge cases.
 */

import {
  ChangeIntelligenceService,
  ChangeIntelligenceServiceError,
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

describe('ChangeIntelligenceService.getBlastRadius()', () => {
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

  test('should throw ChangeIntelligenceServiceError for non-existent report', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await expect(service.getBlastRadius('missing-id')).rejects.toThrow(ChangeIntelligenceServiceError);
  });

  test('should throw with REPORT_NOT_FOUND error code', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    try {
      await service.getBlastRadius('missing-id');
      fail('Expected error to be thrown');
    } catch (err: any) {
      expect(err.code).toBe('REPORT_NOT_FOUND');
      expect(err.name).toBe('ChangeIntelligenceServiceError');
    }
  });

  test('should identify critical services (tier-0 + direct impact)', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', service_name: 'payment', service_tier: 'tier-0', impact_type: 'direct' }),
          mockAffectedService({ id: 'svc-2', service_name: 'auth', service_tier: 'tier-0', impact_type: 'dependency' }),
          mockAffectedService({ id: 'svc-3', service_name: 'logging', service_tier: 'tier-1', impact_type: 'direct' }),
        ],
      });

    const result = await service.getBlastRadius('report-1');

    // Only tier-0 + direct is critical
    expect(result.criticalServices).toHaveLength(1);
    expect(result.criticalServices[0].serviceName).toBe('payment');
  });

  test('should aggregate serviceTiers correctly', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', service_tier: 'tier-0' }),
          mockAffectedService({ id: 'svc-2', service_tier: 'tier-0' }),
          mockAffectedService({ id: 'svc-3', service_tier: 'tier-1' }),
          mockAffectedService({ id: 'svc-4', service_tier: 'tier-2' }),
          mockAffectedService({ id: 'svc-5', service_tier: 'tier-2' }),
          mockAffectedService({ id: 'svc-6', service_tier: 'tier-2' }),
        ],
      });

    const result = await service.getBlastRadius('report-1');

    expect(result.serviceTiers).toEqual({
      'tier-0': 2,
      'tier-1': 1,
      'tier-2': 3,
    });
  });

  test('should handle services with null serviceTier as unknown', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', service_tier: null }),
        ],
      });

    const result = await service.getBlastRadius('report-1');

    expect(result.serviceTiers).toEqual({ unknown: 1 });
  });

  test('should deduplicate changed files across services', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', changed_files: ['src/shared.ts', 'src/a.ts'] }),
          mockAffectedService({ id: 'svc-2', changed_files: ['src/shared.ts', 'src/b.ts'] }),
          mockAffectedService({ id: 'svc-3', changed_files: ['src/a.ts', 'src/c.ts'] }),
        ],
      });

    const result = await service.getBlastRadius('report-1');

    // shared.ts and a.ts appear in multiple services, should be deduped
    expect(result.totalChangedFiles).toBe(4); // shared.ts, a.ts, b.ts, c.ts
  });

  test('should handle services with empty changedFiles', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', changed_files: [] }),
          mockAffectedService({ id: 'svc-2', changed_files: ['src/a.ts'] }),
        ],
      });

    const result = await service.getBlastRadius('report-1');

    expect(result.totalChangedFiles).toBe(1);
  });

  test('should handle services with null changedFiles', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', changed_files: null }),
          mockAffectedService({ id: 'svc-2', changed_files: ['src/a.ts'] }),
        ],
      });

    const result = await service.getBlastRadius('report-1');

    // flatMap on null produces no items for that entry, so only src/a.ts
    expect(result.totalChangedFiles).toBe(1);
  });

  test('should return all affected services in result', async () => {
    const services = [
      mockAffectedService({ id: 'svc-1', service_name: 'svc-a' }),
      mockAffectedService({ id: 'svc-2', service_name: 'svc-b' }),
      mockAffectedService({ id: 'svc-3', service_name: 'svc-c' }),
    ];
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: services });

    const result = await service.getBlastRadius('report-1');

    expect(result.affectedServices).toHaveLength(3);
  });

  test('should return the report entity', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity({ id: 'report-42' })] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getBlastRadius('report-42');

    expect(result.report.id).toBe('report-42');
  });

  test('should handle database error on findById', async () => {
    mockDb.query.mockRejectedValue(new Error('DB connection lost'));

    await expect(service.getBlastRadius('report-1')).rejects.toThrow('DB connection lost');
  });

  test('should handle database error on findByReport', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockRejectedValueOnce(new Error('Query timeout'));

    await expect(service.getBlastRadius('report-1')).rejects.toThrow('Query timeout');
  });

  test('should return empty serviceTiers when no affected services', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getBlastRadius('report-1');

    expect(result.affectedServices).toHaveLength(0);
    expect(result.criticalServices).toHaveLength(0);
    expect(result.totalChangedFiles).toBe(0);
    expect(result.serviceTiers).toEqual({});
  });
});
