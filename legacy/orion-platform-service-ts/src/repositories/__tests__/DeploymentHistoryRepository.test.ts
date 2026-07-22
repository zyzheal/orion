import { DeploymentHistoryRepository, DeploymentHistoryEntity } from '../DeploymentHistoryRepository';

describe('DeploymentHistoryRepository', () => {
  let repo: DeploymentHistoryRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new DeploymentHistoryRepository(mockDb);
  });

  test('should create deployment history', async () => {
    const mockRow = {
      id: 'deploy-1',
      tenant_id: 'tenant-1',
      project_id: null,
      pipeline_run_id: null,
      build_id: null,
      environment: 'production',
      status: 'running',
      strategy: 'rolling',
      config: { replicas: 3 },
      deployed_by: 'user-1',
      started_at: new Date(),
      completed_at: null,
      duration_ms: null,
      error_message: null,
      rollback_to: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ tenantId: 'tenant-1', environment: 'production' } as any);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.environment).toBe('production');
  });

  test('should find by tenant id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'd1', tenant_id: 'tenant-1', project_id: null, pipeline_run_id: null, build_id: null, environment: 'prod', status: 'completed', strategy: 'rolling', config: {}, deployed_by: null, started_at: new Date(), completed_at: new Date(), duration_ms: 1000, error_message: null, rollback_to: null, created_at: new Date() },
        { id: 'd2', tenant_id: 'tenant-1', project_id: null, pipeline_run_id: null, build_id: null, environment: 'dev', status: 'pending', strategy: 'canary', config: {}, deployed_by: null, started_at: null, completed_at: null, duration_ms: null, error_message: null, rollback_to: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByTenantId('tenant-1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('tenant-1');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'd1', tenant_id: 't1', project_id: null, pipeline_run_id: null, build_id: null, environment: 'prod', status: 'failed', strategy: 'rolling', config: {}, deployed_by: null, started_at: new Date(), completed_at: new Date(), duration_ms: null, error_message: 'Timeout', rollback_to: null, created_at: new Date() }],
    });
    const result = await repo.findByStatus('failed');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('failed');
  });

  test('should update status', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const completedAt = new Date();
    await repo.updateStatus('deploy-1', 'completed', completedAt);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE deployments'),
      expect.arrayContaining(['completed', completedAt, 'deploy-1']),
    );
  });
});