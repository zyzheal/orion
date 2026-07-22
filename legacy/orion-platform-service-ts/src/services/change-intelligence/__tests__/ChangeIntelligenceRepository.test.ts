/**
 * ChangeIntelligenceRepository Unit Tests
 *
 * Covers all 4 repository classes: ChangeIntelligenceRepository,
 * AffectedServiceRepository, RiskFactorRepository, HistoricalMatchRepository.
 */

import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
} from '../../../repositories/ChangeIntelligenceRepository';

const createMockDb = () => ({
  query: jest.fn(),
});

describe('ChangeIntelligenceRepository', () => {
  let repo: ChangeIntelligenceRepository;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    repo = new ChangeIntelligenceRepository(mockDb);
  });

  describe('findByPrRepo()', () => {
    test('should query with prId and repoId', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r1', pr_id: 'PR-1', repo_id: 'repo-1', commit_sha: 'sha',
          risk_score: 0.5, risk_level: 'medium', affected_services: 1,
          affected_capabilities: 0, shap_factors: [], gitlab_comment_posted: false,
          created_at: new Date(), updated_at: new Date(),
        }],
      });

      const result = await repo.findByPrRepo('PR-1', 'repo-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('pr_id = $1 AND repo_id = $2'),
        ['PR-1', 'repo-1'],
      );
      expect(result).toHaveLength(1);
      expect(result[0].prId).toBe('PR-1');
    });

    test('should return empty array when no matches', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByPrRepo('PR-X', 'repo-X');

      expect(result).toEqual([]);
    });
  });

  describe('findByRiskLevel()', () => {
    test('should query with risk level', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findByRiskLevel('critical');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('risk_level = $1'),
        ['critical'],
      );
    });
  });

  describe('findRecent()', () => {
    test('should query with INTERVAL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findRecent(7);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INTERVAL'),
        [7],
      );
    });
  });

  describe('markCommentPosted()', () => {
    test('should return mapped entity on success', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r1', pr_id: 'PR-1', repo_id: 'repo-1', commit_sha: 'sha',
          risk_score: 0.5, risk_level: 'medium', affected_services: 1,
          affected_capabilities: 0, shap_factors: [], gitlab_comment_posted: true,
          created_at: new Date(), updated_at: new Date(),
        }],
      });

      const result = await repo.markCommentPosted('r1');

      expect(result).not.toBeNull();
      expect(result!.gitlabCommentPosted).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE change_intelligence_reports'),
        ['r1'],
      );
    });

    test('should return null when no rows affected', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.markCommentPosted('missing');

      expect(result).toBeNull();
    });
  });

  describe('mapRowToEntity()', () => {
    test('should map snake_case fields to camelCase', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r1', pr_id: 'PR-1', repo_id: 'repo-1', commit_sha: 'abc',
          risk_score: 0.75, risk_level: 'high', affected_services: 3,
          affected_capabilities: 2, shap_factors: [{ factor: 'test', value: 0.5 }],
          gitlab_comment_posted: true, created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-02'),
        }],
      });

      const result = await repo.findByPrRepo('PR-1', 'repo-1');
      const entity = result[0];

      expect(entity.id).toBe('r1');
      expect(entity.prId).toBe('PR-1');
      expect(entity.repoId).toBe('repo-1');
      expect(entity.commitSha).toBe('abc');
      expect(entity.riskScore).toBe(0.75);
      expect(entity.riskLevel).toBe('high');
      expect(entity.affectedServices).toBe(3);
      expect(entity.affectedCapabilities).toBe(2);
      expect(entity.shapFactors).toEqual([{ factor: 'test', value: 0.5 }]);
      expect(entity.gitlabCommentPosted).toBe(true);
    });

    test('should default null numeric fields to 0', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'r1', pr_id: 'PR-1', repo_id: 'repo-1', commit_sha: 'abc',
          risk_score: null, risk_level: null, affected_services: null,
          affected_capabilities: null, shap_factors: null,
          gitlab_comment_posted: null, created_at: new Date(), updated_at: new Date(),
        }],
      });

      const result = await repo.findByPrRepo('PR-1', 'repo-1');
      const entity = result[0];

      expect(entity.riskScore).toBe(0);
      expect(entity.riskLevel).toBe('low');
      expect(entity.affectedServices).toBe(0);
      expect(entity.affectedCapabilities).toBe(0);
      expect(entity.gitlabCommentPosted).toBe(false);
    });
  });
});

describe('AffectedServiceRepository', () => {
  let repo: AffectedServiceRepository;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    repo = new AffectedServiceRepository(mockDb);
  });

  describe('findByReport()', () => {
    test('should query by report_id', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findByReport('report-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('report_id = $1'),
        ['report-1'],
      );
    });
  });

  describe('batchCreate()', () => {
    test('should insert each service individually', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'svc-1', report_id: 'r1', service_name: 'svc-a',
            service_tier: 'tier-0', impact_type: 'direct',
            changed_files: ['a.ts'], slo_risk: 'high', recommended_reviewers: ['u1'],
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'svc-2', report_id: 'r1', service_name: 'svc-b',
            service_tier: 'tier-1', impact_type: 'dependency',
            changed_files: ['b.ts'], slo_risk: 'low', recommended_reviewers: ['u2'],
          }],
        });

      const result = await repo.batchCreate([
        { reportId: 'r1', serviceName: 'svc-a', serviceTier: 'tier-0', impactType: 'direct', changedFiles: ['a.ts'], sloRisk: 'high', recommendedReviewers: ['u1'] },
        { reportId: 'r1', serviceName: 'svc-b', serviceTier: 'tier-1', impactType: 'dependency', changedFiles: ['b.ts'], sloRisk: 'low', recommendedReviewers: ['u2'] },
      ]);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].serviceName).toBe('svc-a');
      expect(result[1].serviceName).toBe('svc-b');
    });
  });

  describe('mapRowToEntity()', () => {
    test('should default null arrays to empty', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'svc-1', report_id: 'r1', service_name: 'svc-a',
          service_tier: null, impact_type: null,
          changed_files: null, slo_risk: null, recommended_reviewers: null,
        }],
      });

      const result = await repo.findByReport('r1');
      const entity = result[0];

      expect(entity.changedFiles).toEqual([]);
      expect(entity.recommendedReviewers).toEqual([]);
      expect(entity.serviceTier).toBeNull();
      expect(entity.impactType).toBeNull();
      expect(entity.sloRisk).toBeNull();
    });
  });
});

describe('RiskFactorRepository', () => {
  let repo: RiskFactorRepository;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    repo = new RiskFactorRepository(mockDb);
  });

  describe('findByReport()', () => {
    test('should query ordered by contribution DESC', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findByReport('report-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY contribution DESC'),
        ['report-1'],
      );
    });
  });

  describe('batchCreate()', () => {
    test('should insert each factor individually', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'f1', report_id: 'r1', factor_name: 'blast_radius',
            factor_value: 0.8, weight: 0.25, contribution: 0.2, description: 'desc',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 'f2', report_id: 'r1', factor_name: 'file_change_volume',
            factor_value: 0.5, weight: 0.15, contribution: 0.1, description: null,
          }],
        });

      const result = await repo.batchCreate([
        { reportId: 'r1', factorName: 'blast_radius', factorValue: 0.8, weight: 0.25, contribution: 0.2, description: 'desc' },
        { reportId: 'r1', factorName: 'file_change_volume', factorValue: 0.5, weight: 0.15, contribution: 0.1 },
      ]);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });
});

describe('HistoricalMatchRepository', () => {
  let repo: HistoricalMatchRepository;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    repo = new HistoricalMatchRepository(mockDb);
  });

  describe('findByReport()', () => {
    test('should query ordered by similarity DESC', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findByReport('report-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY similarity DESC'),
        ['report-1'],
      );
    });
  });

  describe('findByIncident()', () => {
    test('should query by incident_id', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findByIncident('INC-001');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('incident_id = $1'),
        ['INC-001'],
      );
    });

    test('should return mapped entities', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'm1', report_id: 'r1', historical_pr: 'PR-100',
          similarity: 0.9, incident_linked: true, incident_id: 'INC-001',
        }],
      });

      const result = await repo.findByIncident('INC-001');

      expect(result).toHaveLength(1);
      expect(result[0].historicalPr).toBe('PR-100');
      expect(result[0].similarity).toBe(0.9);
      expect(result[0].incidentLinked).toBe(true);
      expect(result[0].incidentId).toBe('INC-001');
    });
  });

  describe('mapRowToEntity()', () => {
    test('should default null boolean to false', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'm1', report_id: 'r1', historical_pr: null,
          similarity: null, incident_linked: null, incident_id: null,
        }],
      });

      const result = await repo.findByReport('r1');
      const entity = result[0];

      expect(entity.incidentLinked).toBe(false);
      expect(entity.historicalPr).toBeNull();
      expect(entity.similarity).toBeNull();
      expect(entity.incidentId).toBeNull();
    });
  });
});
