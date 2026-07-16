import {
  ChangeIntelligenceRepository,
  AffectedServiceRepository,
  RiskFactorRepository,
  HistoricalMatchRepository,
} from '../ChangeIntelligenceRepository';

describe('ChangeIntelligenceRepository', () => {
  let repo: ChangeIntelligenceRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChangeIntelligenceRepository(mockDb);
  });

  test('should create report', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'report-1', pr_id: 'PR-123', repo_id: 'repo-1', commit_sha: 'abc123', risk_score: 0.65, risk_level: 'medium', affected_services: 3, affected_capabilities: 5, shap_factors: [{ factor: 'blast_radius', value: 0.7 }], gitlab_comment_posted: false, created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.create({ prId: 'PR-123', repoId: 'repo-1', commitSha: 'abc123', riskScore: 0.65, riskLevel: 'medium', affectedServices: 3, affectedCapabilities: 5, createdAt: new Date(), updatedAt: new Date() });
    expect(result.prId).toBe('PR-123');
    expect(result.riskScore).toBe(0.65);
  });

  test('should find by PR and repo', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'report-1', pr_id: 'PR-123', repo_id: 'repo-1', commit_sha: 'abc', risk_score: 0.5, risk_level: 'low', affected_services: 1, affected_capabilities: 2, shap_factors: null, gitlab_comment_posted: false, created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findByPrRepo('PR-123', 'repo-1');
    expect(result.length).toBe(1);
    expect(result[0].prId).toBe('PR-123');
  });

  test('should find by risk level', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'report-1', pr_id: 'PR-123', repo_id: 'repo-1', commit_sha: 'abc', risk_score: 0.9, risk_level: 'critical', affected_services: 5, affected_capabilities: 10, shap_factors: null, gitlab_comment_posted: false, created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.findByRiskLevel('critical');
    expect(result.length).toBe(1);
    expect(result[0].riskLevel).toBe('critical');
  });

  test('should find recent reports', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'report-1', pr_id: 'PR-123', repo_id: 'repo-1', commit_sha: 'abc', risk_score: 0.5, risk_level: 'low', affected_services: 1, affected_capabilities: 2, shap_factors: null, gitlab_comment_posted: false, created_at: new Date(), updated_at: new Date() },
      ],
    });
    const result = await repo.findRecent(7);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL'), [7]);
  });

  test('should mark comment posted', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'report-1', pr_id: 'PR-123', repo_id: 'repo-1', commit_sha: 'abc', risk_score: 0.5, risk_level: 'low', affected_services: 1, affected_capabilities: 2, shap_factors: null, gitlab_comment_posted: true, created_at: new Date(), updated_at: new Date() }],
    });
    const result = await repo.markCommentPosted('report-1');
    expect(result?.gitlabCommentPosted).toBe(true);
  });
});

describe('AffectedServiceRepository', () => {
  let repo: AffectedServiceRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new AffectedServiceRepository(mockDb);
  });

  test('should find by report', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'svc-1', report_id: 'report-1', service_name: 'payment-service', service_tier: 'tier-0', impact_type: 'direct', changed_files: ['src/payment.ts'], slo_risk: 'high', recommended_reviewers: ['user-1'] },
      ],
    });
    const result = await repo.findByReport('report-1');
    expect(result.length).toBe(1);
    expect(result[0].serviceName).toBe('payment-service');
    expect(result[0].sloRisk).toBe('high');
  });
});

describe('RiskFactorRepository', () => {
  let repo: RiskFactorRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new RiskFactorRepository(mockDb);
  });

  test('should find by report', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'factor-1', report_id: 'report-1', factor_name: 'blast_radius', factor_value: 0.7, weight: 0.35, contribution: 0.25, description: 'Blast radius description' },
      ],
    });
    const result = await repo.findByReport('report-1');
    expect(result.length).toBe(1);
    expect(result[0].factorName).toBe('blast_radius');
    expect(result[0].contribution).toBe(0.25);
  });
});

describe('HistoricalMatchRepository', () => {
  let repo: HistoricalMatchRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new HistoricalMatchRepository(mockDb);
  });

  test('should find by report', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'match-1', report_id: 'report-1', historical_pr: 'PR-4521', similarity: 0.85, incident_linked: true, incident_id: 'INC-001' },
      ],
    });
    const result = await repo.findByReport('report-1');
    expect(result.length).toBe(1);
    expect(result[0].historicalPr).toBe('PR-4521');
    expect(result[0].incidentLinked).toBe(true);
  });

  test('should find by incident', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'match-1', report_id: 'report-1', historical_pr: 'PR-4521', similarity: 0.85, incident_linked: true, incident_id: 'INC-001' }],
    });
    const result = await repo.findByIncident('INC-001');
    expect(result.length).toBe(1);
    expect(result[0].incidentId).toBe('INC-001');
  });
});