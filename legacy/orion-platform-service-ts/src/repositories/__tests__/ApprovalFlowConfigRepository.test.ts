import { ApprovalFlowConfigRepository } from '../ApprovalFlowConfigRepository';

describe('ApprovalFlowConfigRepository', () => {
  let repo: ApprovalFlowConfigRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ApprovalFlowConfigRepository(mockDb);
  });

  test('should create approval flow config via base create', async () => {
    const now = new Date();
    const mockRow = {
      id: 'afc-1',
      tenant_id: 't1',
      flow_id: 'flow-deploy',
      name: 'Deploy Approval',
      description: 'Approval for production deploys',
      enabled: true,
      capability_ids: '["deploy"]',
      environments: '["production"]',
      min_risk_level: 2,
      max_risk_level: 4,
      priority: 10,
      nodes: '[{"type":"manual","assignees":["team-lead"]}]',
      version: 1,
      created_by: 'admin',
      created_at: now,
      updated_at: now,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.create({
      tenant_id: 't1',
      flow_id: 'flow-deploy',
      name: 'Deploy Approval',
      description: 'Approval for production deploys',
      enabled: true,
      capability_ids: ['deploy'],
      environments: ['production'],
      min_risk_level: 2,
      max_risk_level: 4,
      priority: 10,
      nodes: [{ type: 'manual', assignees: ['team-lead'] }],
      created_by: 'admin',
    });

    expect(result.name).toBe('Deploy Approval');
    expect(result.flow_id).toBe('flow-deploy');
    expect(result.capability_ids).toEqual(['deploy']);
    expect(result.environments).toEqual(['production']);
    expect(result.nodes).toEqual([{ type: 'manual', assignees: ['team-lead'] }]);
  });

  test('should find configs by tenant id', async () => {
    const mockRows = [
      { id: 'afc-1', tenant_id: 't1', flow_id: 'f1', name: 'Flow 1', description: null, enabled: true, capability_ids: '[]', environments: '["*"]', min_risk_level: 1, max_risk_level: 4, priority: 0, nodes: '[]', version: 1, created_by: null, created_at: new Date(), updated_at: new Date() },
      { id: 'afc-2', tenant_id: 't1', flow_id: 'f2', name: 'Flow 2', description: null, enabled: false, capability_ids: '["build"]', environments: '[]', min_risk_level: 1, max_risk_level: 3, priority: 5, nodes: '[]', version: 1, created_by: null, created_at: new Date(), updated_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows, rowCount: 2 });

    const result = await repo.findByTenantId('t1');
    expect(result.length).toBe(2);
    expect(result[0].tenant_id).toBe('t1');
    expect(result[0].name).toBe('Flow 1');
    expect(result[1].name).toBe('Flow 2');
  });

  test('should find config by flow id and tenant id', async () => {
    const mockRow = {
      id: 'afc-1',
      tenant_id: 't1',
      flow_id: 'flow-deploy',
      name: 'Deploy Approval',
      description: null,
      enabled: true,
      capability_ids: '["deploy"]',
      environments: '["production"]',
      min_risk_level: 2,
      max_risk_level: 4,
      priority: 10,
      nodes: '[]',
      version: 1,
      created_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.findByFlowId('flow-deploy', 't1');
    expect(result).toBeDefined();
    expect(result!.flow_id).toBe('flow-deploy');
    expect(result!.name).toBe('Deploy Approval');
  });

  test('should update config by flow id', async () => {
    const mockRow = {
      id: 'afc-1',
      tenant_id: 't1',
      flow_id: 'flow-deploy',
      name: 'Updated Flow',
      description: 'Updated description',
      enabled: false,
      capability_ids: '["deploy","build"]',
      environments: '["staging","production"]',
      min_risk_level: 1,
      max_risk_level: 4,
      priority: 20,
      nodes: '[]',
      version: 2,
      created_by: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.updateByFlowId('flow-deploy', 't1', {
      name: 'Updated Flow',
      enabled: false,
      priority: 20,
    });

    expect(result).toBeDefined();
    expect(result!.name).toBe('Updated Flow');
    expect(result!.enabled).toBe(false);
    expect(result!.priority).toBe(20);
  });

  test('should delete config by flow id', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

    const result = await repo.deleteByFlowId('flow-deploy', 't1');
    expect(result).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM approval_flow_configs'),
      ['flow-deploy', 't1'],
    );
  });

  test('should return undefined when flow config not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await repo.findByFlowId('nonexistent', 't1');
    expect(result).toBeUndefined();
  });
});
