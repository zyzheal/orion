import { PluginExecutionRepository, PluginExecutionEntity } from '../PluginExecutionRepository';

describe('PluginExecutionRepository', () => {
  let repo: PluginExecutionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PluginExecutionRepository(mockDb);
  });

  test('should create execution', async () => {
    const mockRow = {
      id: 'exec-1',
      plugin_id: 'plugin-1',
      triggered_by: 'user-1',
      input: { action: 'deploy' },
      output: null,
      status: 'running',
      started_at: new Date(),
      completed_at: null,
      error: null,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ pluginId: 'plugin-1', triggeredBy: 'user-1' } as any);
    expect(result.pluginId).toBe('plugin-1');
    expect(result.status).toBe('running');
  });

  test('should find by plugin id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'e1', plugin_id: 'plugin-1', triggered_by: null, input: {}, output: {}, status: 'completed', started_at: new Date(), completed_at: new Date(), error: null },
        { id: 'e2', plugin_id: 'plugin-1', triggered_by: null, input: {}, output: null, status: 'running', started_at: new Date(), completed_at: null, error: null },
      ],
    });
    const result = await repo.findByPluginId('plugin-1');
    expect(result.length).toBe(2);
    expect(result[0].pluginId).toBe('plugin-1');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'e1', plugin_id: 'p1', triggered_by: null, input: {}, output: null, status: 'failed', started_at: new Date(), completed_at: new Date(), error: 'Timeout' }],
    });
    const result = await repo.findByStatus('failed');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('failed');
  });

  test('should update result', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const completedAt = new Date();
    await repo.updateResult('exec-1', { result: 'success' }, 'completed', completedAt);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE plugin_executions'),
      expect.arrayContaining([expect.any(String), 'completed', completedAt, 'exec-1']),
    );
  });
});