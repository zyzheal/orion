import { RiskAssessmentRepository, RiskAssessmentEntity } from '../RiskAssessmentRepository';

describe('RiskAssessmentRepository', () => {
  let repo: RiskAssessmentRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new RiskAssessmentRepository(mockDb);
  });

  test('should create risk assessment', async () => {
    const mockRow = {
      id: 'risk-1',
      tenant_id: 'tenant-1',
      name: 'Security Assessment',
      type: 'security',
      target_type: 'deployment',
      target_id: 'deploy-1',
      score: 75.5,
      risk_level: 'high',
      findings: [{ severity: 'high', description: 'Vulnerability found' }],
      status: 'completed',
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      tenantId: 'tenant-1',
      name: 'Security Assessment',
      type: 'security',
      targetType: 'deployment',
      targetId: 'deploy-1',
      score: 75.5,
      riskLevel: 'high',
      findings: [{ severity: 'high', description: 'Vulnerability found' }],
    } as any);

    expect(result.id).toBe('risk-1');
    expect(result.name).toBe('Security Assessment');
    expect(result.riskLevel).toBe('high');
    expect(result.findings).toHaveLength(1);
  });

  test('should find assessments by tenant', async () => {
    const mockRows = [
      { id: 'risk-1', tenant_id: 'tenant-1', name: 'Risk 1', type: 'security', target_type: 'project', target_id: 'p1', score: 50, risk_level: 'medium', findings: [], status: 'completed', created_at: new Date() },
      { id: 'risk-2', tenant_id: 'tenant-1', name: 'Risk 2', type: 'compliance', target_type: 'project', target_id: 'p2', score: 80, risk_level: 'high', findings: [], status: 'completed', created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const results = await repo.findByTenant('tenant-1');

    expect(results).toHaveLength(2);
    expect(results[0].tenantId).toBe('tenant-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1'),
      ['tenant-1', 20, 0],
    );
  });

  test('should find assessments by target', async () => {
    const mockRows = [
      { id: 'risk-1', tenant_id: 'tenant-1', name: 'Risk 1', type: 'security', target_type: 'deployment', target_id: 'deploy-1', score: 50, risk_level: 'medium', findings: [], status: 'completed', created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const results = await repo.findByTarget('deployment', 'deploy-1');

    expect(results).toHaveLength(1);
    expect(results[0].targetType).toBe('deployment');
    expect(results[0].targetId).toBe('deploy-1');
  });

  test('should find assessments by risk level', async () => {
    const mockRows = [
      { id: 'risk-1', tenant_id: 'tenant-1', name: 'High Risk', type: 'security', target_type: 'project', target_id: 'p1', score: 90, risk_level: 'critical', findings: [], status: 'completed', created_at: new Date() },
      { id: 'risk-2', tenant_id: 'tenant-2', name: 'Another Critical', type: 'security', target_type: 'project', target_id: 'p2', score: 85, risk_level: 'critical', findings: [], status: 'completed', created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const results = await repo.findByRiskLevel('critical');

    expect(results).toHaveLength(2);
    expect(results.every(r => r.riskLevel === 'critical')).toBe(true);
  });
});