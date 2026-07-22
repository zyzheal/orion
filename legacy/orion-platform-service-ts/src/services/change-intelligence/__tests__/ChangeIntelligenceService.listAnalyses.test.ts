/**
 * ChangeIntelligenceService - listAnalyses() Tests
 *
 * Covers tenant-based filtering, limit parameter, and edge cases.
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
  shap_factors: [{ factor: 'blast_radius', value: 0.8, contribution: 0.25 }],
  gitlab_comment_posted: false,
  created_at: new Date('2026-01-15'),
  updated_at: new Date('2026-01-15'),
  ...overrides,
});

describe('ChangeIntelligenceService.listAnalyses()', () => {
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

  test('should filter reports by tenantId prefix match on repoId', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', repo_id: 'tenantA-service1' }),
        mockReportEntity({ id: 'r2', repo_id: 'tenantA-service2' }),
        mockReportEntity({ id: 'r3', repo_id: 'otherTenant-service1' }),
      ],
    });

    const result = await service.listAnalyses('tenantA');

    // Should filter to only tenantA-prefixed repos
    expect(result).toHaveLength(2);
    expect(result.every(r => r.repoId.startsWith('tenantA-'))).toBe(true);
  });

  test('should filter reports by tenantId exact match on repoId', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', repo_id: 'exactTenant' }),
        mockReportEntity({ id: 'r2', repo_id: 'exactTenant-service1' }),
        mockReportEntity({ id: 'r3', repo_id: 'other' }),
      ],
    });

    const result = await service.listAnalyses('exactTenant');

    // exactTenant and exactTenant-service1 both match
    expect(result).toHaveLength(2);
  });

  test('should respect limit parameter', async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, repo_id: 'tenantA-svc' }),
    );
    mockDb.query.mockResolvedValue({ rows });

    const result = await service.listAnalyses('tenantA', 5);

    expect(result).toHaveLength(5);
  });

  test('should default limit to 50', async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      mockReportEntity({ id: `r${i}`, repo_id: 'tenantA-svc' }),
    );
    mockDb.query.mockResolvedValue({ rows });

    const result = await service.listAnalyses('tenantA');

    expect(result).toHaveLength(50);
  });

  test('should return empty array when no reports match tenant', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ id: 'r1', repo_id: 'otherTenant-svc' }),
      ],
    });

    const result = await service.listAnalyses('tenantA');

    expect(result).toHaveLength(0);
  });

  test('should return empty array when no reports exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    const result = await service.listAnalyses('tenantA');

    expect(result).toHaveLength(0);
  });

  test('should map entities to domain models correctly', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({
          id: 'r1',
          pr_id: 'PR-999',
          repo_id: 'tenantA-svc',
          commit_sha: 'sha123',
          risk_score: 0.9,
          risk_level: 'critical',
          affected_services: 5,
          affected_capabilities: 3,
          shap_factors: [{ factor: 'test', value: 0.5, contribution: 0.3 }],
          gitlab_comment_posted: true,
          created_at: new Date('2026-06-01'),
          updated_at: new Date('2026-06-02'),
        }),
      ],
    });

    const result = await service.listAnalyses('tenantA');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
    expect(result[0].prId).toBe('PR-999');
    expect(result[0].repoId).toBe('tenantA-svc');
    expect(result[0].commitSha).toBe('sha123');
    expect(result[0].riskScore).toBe(0.9);
    expect(result[0].riskLevel).toBe('critical');
    expect(result[0].affectedServices).toBe(5);
    expect(result[0].affectedCapabilities).toBe(3);
    expect(result[0].gitlabCommentPosted).toBe(true);
  });

  test('should handle null shapFactors in mapped report', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        mockReportEntity({ repo_id: 'tenantA-svc', shap_factors: null }),
      ],
    });

    const result = await service.listAnalyses('tenantA');

    expect(result).toHaveLength(1);
    expect(result[0].shapFactors).toEqual([]);
  });

  test('should call findRecent with 30 days', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await service.listAnalyses('tenantA');

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INTERVAL'),
      [30],
    );
  });

  test('should handle database errors', async () => {
    mockDb.query.mockRejectedValue(new Error('Database connection failed'));

    await expect(service.listAnalyses('tenantA')).rejects.toThrow('Database connection failed');
  });
});
