/**
 * ChangeIntelligenceService - Entity Mapping & Remaining Methods Tests
 *
 * Covers entity mapping edge cases, list() edge cases, deleteReport(),
 * markCommentPosted(), getById(), and error handling for all methods.
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
  shap_factors: [{ factor: 'blast_radius', value: 0.8, contribution: 0.25 }],
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

const mockRiskFactor = (overrides: Record<string, any> = {}) => ({
  id: 'factor-1',
  report_id: 'report-1',
  factor_name: 'blast_radius',
  factor_value: 0.8,
  weight: 0.25,
  contribution: 0.25,
  description: 'Blast radius description',
  ...overrides,
});

const mockHistoricalMatch = (overrides: Record<string, any> = {}) => ({
  id: 'match-1',
  report_id: 'report-1',
  historical_pr: 'PR-4521',
  similarity: 0.85,
  incident_linked: true,
  incident_id: 'INC-001',
  ...overrides,
});

describe('ChangeIntelligenceService - Entity Mapping', () => {
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

  describe('mapAffectedService edge cases', () => {
    test('should handle null serviceTier', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [mockAffectedService({ service_tier: null })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalysis('report-1');

      expect(result!.affectedServices[0].serviceTier).toBeUndefined();
    });

    test('should handle null impactType', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [mockAffectedService({ impact_type: null })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalysis('report-1');

      expect(result!.affectedServices[0].impactType).toBeUndefined();
    });

    test('should handle null sloRisk', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [mockAffectedService({ slo_risk: null })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalysis('report-1');

      expect(result!.affectedServices[0].sloRisk).toBeUndefined();
    });

    test('should handle null changedFiles', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [mockAffectedService({ changed_files: null })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalysis('report-1');

      expect(result!.affectedServices[0].changedFiles).toEqual([]);
    });

    test('should handle null recommendedReviewers', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [mockAffectedService({ recommended_reviewers: null })] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalysis('report-1');

      expect(result!.affectedServices[0].recommendedReviewers).toEqual([]);
    });
  });

  describe('mapRiskFactor edge cases', () => {
    test('should handle null description', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockRiskFactor({ description: null })] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalysis('report-1');

      expect(result!.riskFactors[0].description).toBeUndefined();
    });
  });

  describe('mapHistoricalMatch edge cases', () => {
    test('should handle null historicalPr', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockHistoricalMatch({ historical_pr: null })] });

      const result = await service.getAnalysis('report-1');

      expect(result!.historicalMatches[0].historicalPr).toBeUndefined();
    });

    test('should handle null similarity', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockHistoricalMatch({ similarity: null })] });

      const result = await service.getAnalysis('report-1');

      expect(result!.historicalMatches[0].similarity).toBeUndefined();
    });

    test('should handle null incidentId', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockHistoricalMatch({ incident_id: null })] });

      const result = await service.getAnalysis('report-1');

      expect(result!.historicalMatches[0].incidentId).toBeUndefined();
    });

    test('should handle false incidentLinked', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReportEntity()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockHistoricalMatch({ incident_linked: false })] });

      const result = await service.getAnalysis('report-1');

      expect(result!.historicalMatches[0].incidentLinked).toBe(false);
    });
  });
});

describe('ChangeIntelligenceService - list() edge cases', () => {
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

  test('should fall through to default (30 days) when only repoId is provided without prId', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.list({ repoId: 'repo-1' });

    // repoId alone doesn't match prId+repoId branch, no riskLevel, no days -> default 30
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INTERVAL'),
      [30],
    );
  });

  test('should handle empty filter object', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.list({});

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INTERVAL'),
      [30],
    );
  });

  test('should prefer prId+repoId over riskLevel when both provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.list({ prId: 'PR-1', repoId: 'repo-1', riskLevel: 'high' });

    // Should use findByPrRepo, not findByRiskLevel
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('pr_id'),
      ['PR-1', 'repo-1'],
    );
  });

  test('should use riskLevel when prId is missing but riskLevel is set', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.list({ riskLevel: 'critical' });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('risk_level'),
      ['critical'],
    );
  });

  test('should use days when set and no prId/repoId/riskLevel', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.list({ days: 7 });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INTERVAL'),
      [7],
    );
  });

  test('should map multiple reports correctly', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'low' }),
        mockReportEntity({ id: 'r2', risk_level: 'high' }),
        mockReportEntity({ id: 'r3', risk_level: 'critical' }),
      ],
    });

    const result = await service.list({ days: 7 });

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('r1');
    expect(result[1].id).toBe('r2');
    expect(result[2].id).toBe('r3');
  });

  test('should handle database errors', async () => {
    mockDb.query.mockRejectedValue(new Error('Query timeout'));

    await expect(service.list()).rejects.toThrow('Query timeout');
  });
});

describe('ChangeIntelligenceService - deleteReport()', () => {
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

    await expect(service.deleteReport('missing')).rejects.toThrow(ChangeIntelligenceServiceError);
  });

  test('should throw with REPORT_NOT_FOUND code', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    try {
      await service.deleteReport('missing');
      fail('Expected error');
    } catch (err: any) {
      expect(err.code).toBe('REPORT_NOT_FOUND');
    }
  });

  test('should return true when delete succeeds', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] }) // findById
      .mockResolvedValueOnce({ rows: [{ id: 'report-1' }], rowCount: 1 }); // delete

    const result = await service.deleteReport('report-1');

    expect(result).toBe(true);
  });

  test('should return false when delete affects no rows', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] }) // findById
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // delete

    const result = await service.deleteReport('report-1');

    expect(result).toBe(false);
  });

  test('should call DELETE query with correct id', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: [{ id: 'report-1' }], rowCount: 1 });

    await service.deleteReport('report-1');

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM change_intelligence_reports'),
      ['report-1', '__system__'],
    );
  });

  test('should handle database errors during findById', async () => {
    mockDb.query.mockRejectedValue(new Error('DB error'));

    await expect(service.deleteReport('report-1')).rejects.toThrow('DB error');
  });
});

describe('ChangeIntelligenceService - markCommentPosted()', () => {
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

  test('should return mapped report when comment posted', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockReportEntity({ gitlab_comment_posted: true })],
    });

    const result = await service.markCommentPosted('report-1');

    expect(result).not.toBeNull();
    expect(result!.gitlabCommentPosted).toBe(true);
    expect(result!.id).toBe('report-1');
  });

  test('should return null for non-existent report', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.markCommentPosted('missing-id');

    expect(result).toBeNull();
  });

  test('should call UPDATE query with correct id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [mockReportEntity({ gitlab_comment_posted: true })],
    });

    await service.markCommentPosted('report-1');

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE change_intelligence_reports'),
      ['report-1'],
    );
  });

  test('should handle database errors', async () => {
    mockDb.query.mockRejectedValue(new Error('Write lock timeout'));

    await expect(service.markCommentPosted('report-1')).rejects.toThrow('Write lock timeout');
  });
});

describe('ChangeIntelligenceService - getById()', () => {
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

  test('should return null when getAnalysis returns null', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.getById('missing');

    expect(result).toBeNull();
  });

  test('should return only the report (not full analysis)', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: [mockAffectedService()] })
      .mockResolvedValueOnce({ rows: [mockRiskFactor()] })
      .mockResolvedValueOnce({ rows: [mockHistoricalMatch()] });

    const result = await service.getById('report-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('report-1');
    // getById returns ChangeIntelligenceReport (which has affectedServices as a number),
    // NOT AnalyzeResult (which has affectedServices as an array + riskFactors + historicalMatches)
    expect(typeof result!.affectedServices).toBe('number');
    expect(result).not.toHaveProperty('riskFactors');
    expect(result).not.toHaveProperty('historicalMatches');
  });

  test('should handle database errors', async () => {
    mockDb.query.mockRejectedValue(new Error('Connection reset'));

    await expect(service.getById('report-1')).rejects.toThrow('Connection reset');
  });
});

describe('ChangeIntelligenceService - getAnalysis() mapping', () => {
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

  test('should map all affected services correctly', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({
        rows: [
          mockAffectedService({ id: 'svc-1', service_name: 'svc-a', service_tier: 'tier-0', impact_type: 'direct', slo_risk: 'high' }),
          mockAffectedService({ id: 'svc-2', service_name: 'svc-b', service_tier: 'tier-1', impact_type: 'dependency', slo_risk: 'medium' }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getAnalysis('report-1');

    expect(result!.affectedServices).toHaveLength(2);
    expect(result!.affectedServices[0].serviceName).toBe('svc-a');
    expect(result!.affectedServices[0].serviceTier).toBe('tier-0');
    expect(result!.affectedServices[0].impactType).toBe('direct');
    expect(result!.affectedServices[0].sloRisk).toBe('high');
    expect(result!.affectedServices[1].serviceName).toBe('svc-b');
    expect(result!.affectedServices[1].serviceTier).toBe('tier-1');
    expect(result!.affectedServices[1].impactType).toBe('dependency');
    expect(result!.affectedServices[1].sloRisk).toBe('medium');
  });

  test('should map all risk factors correctly', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          mockRiskFactor({ id: 'f1', factor_name: 'blast_radius', factor_value: 0.8, weight: 0.25, contribution: 0.2, description: 'desc1' }),
          mockRiskFactor({ id: 'f2', factor_name: 'file_change_volume', factor_value: 0.5, weight: 0.15, contribution: 0.1, description: 'desc2' }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.getAnalysis('report-1');

    expect(result!.riskFactors).toHaveLength(2);
    expect(result!.riskFactors[0].factorName).toBe('blast_radius');
    expect(result!.riskFactors[0].factorValue).toBe(0.8);
    expect(result!.riskFactors[0].weight).toBe(0.25);
    expect(result!.riskFactors[0].contribution).toBe(0.2);
    expect(result!.riskFactors[0].description).toBe('desc1');
  });

  test('should map all historical matches correctly', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          mockHistoricalMatch({ id: 'm1', historical_pr: 'PR-100', similarity: 0.95, incident_linked: true, incident_id: 'INC-10' }),
        ],
      });

    const result = await service.getAnalysis('report-1');

    expect(result!.historicalMatches).toHaveLength(1);
    expect(result!.historicalMatches[0].historicalPr).toBe('PR-100');
    expect(result!.historicalMatches[0].similarity).toBe(0.95);
    expect(result!.historicalMatches[0].incidentLinked).toBe(true);
    expect(result!.historicalMatches[0].incidentId).toBe('INC-10');
  });

  test('should call all three findByReport queries in parallel', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [mockReportEntity()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.getAnalysis('report-1');

    // 4 queries total: findById + 3 findByReport
    expect(mockDb.query).toHaveBeenCalledTimes(4);
  });
});

describe('ChangeIntelligenceServiceError', () => {
  test('should have correct name property', () => {
    const err = new ChangeIntelligenceServiceError('test', 'TEST_CODE');
    expect(err.name).toBe('ChangeIntelligenceServiceError');
  });

  test('should have correct message', () => {
    const err = new ChangeIntelligenceServiceError('custom message', 'CODE');
    expect(err.message).toBe('custom message');
  });

  test('should have correct code', () => {
    const err = new ChangeIntelligenceServiceError('msg', 'MY_CODE');
    expect(err.code).toBe('MY_CODE');
  });

  test('should be instanceof Error', () => {
    const err = new ChangeIntelligenceServiceError('msg', 'CODE');
    expect(err).toBeInstanceOf(Error);
  });
});
