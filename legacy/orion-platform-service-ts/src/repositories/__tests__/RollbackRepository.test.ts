import { RollbackRepository, RollbackEntity } from '../RollbackRepository';

describe('RollbackRepository', () => {
  let repo: RollbackRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new RollbackRepository(mockDb);
  });

  test('should create rollback', async () => {
    const mockRow = {
      id: 'rollback-1',
      deployment_id: 'deploy-1',
      rollback_type: 'manual',
      reason: 'User triggered rollback',
      triggered_by: 'user-1',
      started_at: new Date(),
      completed_at: null,
      status: 'running',
      previous_version: 'v1.0.0',
      target_version: 'v0.9.0',
      error_message: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ deploymentId: 'deploy-1', rollbackType: 'manual' } as any);
    expect(result.deploymentId).toBe('deploy-1');
    expect(result.rollbackType).toBe('manual');
  });

  test('should find by deployment id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'r1', deployment_id: 'deploy-1', rollback_type: 'auto', reason: 'Health check failed', triggered_by: null, started_at: new Date(), completed_at: new Date(), status: 'completed', previous_version: 'v1.0', target_version: 'v0.9', error_message: null, created_at: new Date() },
      ],
    });
    const result = await repo.findByDeploymentId('deploy-1');
    expect(result.length).toBe(1);
    expect(result[0].deploymentId).toBe('deploy-1');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'r1', deployment_id: 'd1', rollback_type: 'manual', reason: 'Test', triggered_by: null, started_at: new Date(), completed_at: new Date(), status: 'failed', previous_version: null, target_version: null, error_message: 'Rollback failed', created_at: new Date() }],
    });
    const result = await repo.findByStatus('failed');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('failed');
  });

  test('should update status', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const completedAt = new Date();
    await repo.updateStatus('rollback-1', 'completed', completedAt);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rollback_history'),
      expect.arrayContaining(['completed', completedAt, 'rollback-1']),
    );
  });
});