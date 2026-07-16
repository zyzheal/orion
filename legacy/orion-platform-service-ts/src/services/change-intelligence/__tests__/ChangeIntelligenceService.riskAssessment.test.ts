/**
 * ChangeIntelligenceService - getRiskAssessment() Deep Tests
 *
 * Covers overallRisk escalation logic, riskDistribution,
 * recentHighRiskReports sorting/filtering, and recommendation branches.
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

describe('ChangeIntelligenceService.getRiskAssessment()', () => {
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

  // ==================== overallRisk Logic ====================

  test('should return low overallRisk when no reports', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('low');
  });

  test('should return critical overallRisk when any critical report exists', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'critical' }),
        mockReportEntity({ id: 'r2', risk_level: 'low' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('critical');
  });

  test('should return high overallRisk when high count > 2', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'high' }),
        mockReportEntity({ id: 'r2', risk_level: 'high' }),
        mockReportEntity({ id: 'r3', risk_level: 'high' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('high');
  });

  test('should return high overallRisk when high count > 0 (even 1)', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'high' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('high');
  });

  test('should return medium overallRisk when medium count > 5 and no high/critical', async () => {
    const mediumReports = Array.from({ length: 6 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, risk_level: 'medium' }),
    );
    mockDb.query.mockResolvedValue({ rows: mediumReports });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('medium');
  });

  test('should return low overallRisk when only low reports exist', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'low' }),
        mockReportEntity({ id: 'r2', risk_level: 'low' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('low');
  });

  test('should return low overallRisk when medium count <= 5', async () => {
    const mediumReports = Array.from({ length: 5 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, risk_level: 'medium' }),
    );
    mockDb.query.mockResolvedValue({ rows: mediumReports });

    const result = await service.getRiskAssessment(30);

    expect(result.overallRisk).toBe('low');
  });

  // ==================== riskDistribution ====================

  test('should count risk distribution correctly', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'low' }),
        mockReportEntity({ id: 'r2', risk_level: 'low' }),
        mockReportEntity({ id: 'r3', risk_level: 'medium' }),
        mockReportEntity({ id: 'r4', risk_level: 'high' }),
        mockReportEntity({ id: 'r5', risk_level: 'critical' }),
        mockReportEntity({ id: 'r6', risk_level: 'critical' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.riskDistribution).toEqual({
      low: 2,
      medium: 1,
      high: 1,
      critical: 2,
    });
  });

  test('should initialize all risk levels to 0 when no reports', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.getRiskAssessment(30);

    expect(result.riskDistribution).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });

  // ==================== recentHighRiskReports ====================

  test('should filter recentHighRiskReports to only high and critical', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'low' }),
        mockReportEntity({ id: 'r2', risk_level: 'medium' }),
        mockReportEntity({ id: 'r3', risk_level: 'high' }),
        mockReportEntity({ id: 'r4', risk_level: 'critical' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.recentHighRiskReports).toHaveLength(2);
    expect(result.recentHighRiskReports.every(
      r => r.riskLevel === 'high' || r.riskLevel === 'critical',
    )).toBe(true);
  });

  test('should sort recentHighRiskReports by createdAt descending', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'high', created_at: new Date('2026-01-01') }),
        mockReportEntity({ id: 'r2', risk_level: 'critical', created_at: new Date('2026-01-15') }),
        mockReportEntity({ id: 'r3', risk_level: 'high', created_at: new Date('2026-01-10') }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    expect(result.recentHighRiskReports[0].id).toBe('r2'); // Jan 15
    expect(result.recentHighRiskReports[1].id).toBe('r3'); // Jan 10
    expect(result.recentHighRiskReports[2].id).toBe('r1'); // Jan 1
  });

  test('should limit recentHighRiskReports to 10', async () => {
    const highReports = Array.from({ length: 15 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, risk_level: 'high', created_at: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`) }),
    );
    mockDb.query.mockResolvedValue({ rows: highReports });

    const result = await service.getRiskAssessment(30);

    expect(result.recentHighRiskReports).toHaveLength(10);
  });

  // ==================== Recommendations ====================

  test('should generate critical risk recommendation', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', risk_level: 'critical' }),
      ],
    });

    const result = await service.getRiskAssessment(30);

    const criticalRec = result.recommendations.find(r => r.includes('Critical risk'));
    expect(criticalRec).toBeDefined();
    expect(criticalRec).toContain('1'); // count
  });

  test('should generate recommendation for many high-risk changes (>5)', async () => {
    const highReports = Array.from({ length: 6 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, risk_level: 'high' }),
    );
    mockDb.query.mockResolvedValue({ rows: highReports });

    const result = await service.getRiskAssessment(30);

    const highRec = result.recommendations.find(r => r.includes('High number of high-risk'));
    expect(highRec).toBeDefined();
  });

  test('should generate recommendation for frequent medium-risk changes (>10)', async () => {
    const mediumReports = Array.from({ length: 11 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, risk_level: 'medium' }),
    );
    mockDb.query.mockResolvedValue({ rows: mediumReports });

    const result = await service.getRiskAssessment(30);

    const mediumRec = result.recommendations.find(r => r.includes('Moderate risk changes'));
    expect(mediumRec).toBeDefined();
  });

  test('should generate service concentration recommendation', async () => {
    // Need 3+ high-risk reports with affected_services > 3 for the same repo
    const reports = Array.from({ length: 3 }, (_, i) =>
      mockReportEntity({
        id: `r${i}`,
        risk_level: 'high',
        repo_id: 'coupled-repo',
        affected_services: 5,
        created_at: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`),
      }),
    );
    mockDb.query.mockResolvedValue({ rows: reports });

    const result = await service.getRiskAssessment(30);

    const concentrationRec = result.recommendations.find(r => r.includes('coupled-repo'));
    expect(concentrationRec).toBeDefined();
    expect(concentrationRec).toContain('Review architecture');
  });

  test('should default to normal parameters recommendation when no risks', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.getRiskAssessment(30);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toContain('normal parameters');
  });

  test('should not generate service concentration rec when affected_services <= 3', async () => {
    // Reports with affected_services <= 3 should not trigger concentration recommendation
    const reports = Array.from({ length: 3 }, (_, i) =>
      mockReportEntity({
        id: `r${i}`,
        risk_level: 'high',
        repo_id: 'normal-repo',
        affected_services: 2,
        created_at: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`),
      }),
    );
    mockDb.query.mockResolvedValue({ rows: reports });

    const result = await service.getRiskAssessment(30);

    const concentrationRec = result.recommendations.find(r => r.includes('normal-repo'));
    expect(concentrationRec).toBeUndefined();
  });

  test('should not generate service concentration rec when count < 3', async () => {
    // Only 2 reports for the same repo (need >= 3)
    const reports = [
      mockReportEntity({ id: 'r1', risk_level: 'high', repo_id: 'repo-a', affected_services: 5, created_at: new Date('2026-01-01') }),
      mockReportEntity({ id: 'r2', risk_level: 'high', repo_id: 'repo-a', affected_services: 5, created_at: new Date('2026-01-02') }),
    ];
    mockDb.query.mockResolvedValue({ rows: reports });

    const result = await service.getRiskAssessment(30);

    const concentrationRec = result.recommendations.find(r => r.includes('repo-a'));
    expect(concentrationRec).toBeUndefined();
  });

  test('should pass correct days parameter', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.getRiskAssessment(14);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INTERVAL'),
      [14],
    );
  });

  test('should handle database errors', async () => {
    mockDb.query.mockRejectedValue(new Error('Connection refused'));

    await expect(service.getRiskAssessment(30)).rejects.toThrow('Connection refused');
  });
});
