import { PipelineCheckpointRepository, PipelineCheckpointRecord, CreateCheckpointInput } from '../PipelineCheckpointRepository';

describe('PipelineCheckpointRepository', () => {
  let repo: PipelineCheckpointRepository;
  let mockPool: any;

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new PipelineCheckpointRepository(mockPool);
  });

  const createMockRecord = (overrides?: Partial<PipelineCheckpointRecord>): PipelineCheckpointRecord => ({
    id: 'cp-1',
    run_id: 'run-1',
    pipeline_id: 'pipe-1',
    checkpoint_data: { stages: [], pendingStages: [], runningStages: [], completedStages: [] },
    status: 'running',
    last_stage_name: 'build',
    last_task_name: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  // ==================== saveCheckpoint ====================

  test('should save a new checkpoint', async () => {
    const input: CreateCheckpointInput = {
      run_id: 'run-1',
      pipeline_id: 'pipe-1',
      checkpoint_data: { stages: [] },
      status: 'running',
    };
    mockPool.query.mockResolvedValue({
      rows: [createMockRecord()],
    });

    const result = await repo.saveCheckpoint(input);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pipeline_checkpoints'),
      expect.arrayContaining(['run-1', 'pipe-1'])
    );
    expect(result.run_id).toBe('run-1');
    expect(result.status).toBe('running');
  });

  test('should upsert checkpoint on conflict (ON CONFLICT DO UPDATE)', async () => {
    const input: CreateCheckpointInput = {
      run_id: 'run-1',
      pipeline_id: 'pipe-1',
      checkpoint_data: { stages: [{ id: 's1', status: 'running' }] },
      status: 'running',
      last_stage_name: 'build',
    };
    mockPool.query.mockResolvedValue({
      rows: [createMockRecord({ last_stage_name: 'build' })],
    });

    const result = await repo.saveCheckpoint(input);

    // Verify the query contains ON CONFLICT clause
    const callArgs = mockPool.query.mock.calls[0];
    expect(callArgs[0]).toContain('ON CONFLICT (run_id)');
    expect(callArgs[0]).toContain('DO UPDATE SET');
    expect(result.last_stage_name).toBe('build');
  });

  test('should handle optional last_stage_name and last_task_name', async () => {
    const input: CreateCheckpointInput = {
      run_id: 'run-1',
      pipeline_id: 'pipe-1',
      checkpoint_data: {},
      status: 'running',
      last_stage_name: 'deploy',
      last_task_name: 'kubectl apply',
    };
    mockPool.query.mockResolvedValue({
      rows: [createMockRecord({ last_stage_name: 'deploy', last_task_name: 'kubectl apply' })],
    });

    const result = await repo.saveCheckpoint(input);
    const params = mockPool.query.mock.calls[0][1];
    expect(params).toContain('deploy');
    expect(params).toContain('kubectl apply');
    expect(result.last_stage_name).toBe('deploy');
    expect(result.last_task_name).toBe('kubectl apply');
  });

  // ==================== findByRunId ====================

  test('should find checkpoint by run_id', async () => {
    mockPool.query.mockResolvedValue({
      rows: [createMockRecord()],
    });

    const result = await repo.findByRunId('run-1');

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT * FROM pipeline_checkpoints WHERE run_id = $1',
      ['run-1']
    );
    expect(result).not.toBeNull();
    expect(result!.run_id).toBe('run-1');
  });

  test('should return null when checkpoint not found', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const result = await repo.findByRunId('nonexistent');

    expect(result).toBeNull();
  });

  // ==================== findAllByStatus ====================

  test('should find all checkpoints by status', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        createMockRecord({ run_id: 'run-1' }),
        createMockRecord({ run_id: 'run-2' }),
      ],
    });

    const results = await repo.findAllByStatus('running');

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT * FROM pipeline_checkpoints WHERE status = $1 ORDER BY updated_at DESC',
      ['running']
    );
    expect(results.length).toBe(2);
  });

  test('should return empty array when no checkpoints match status', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const results = await repo.findAllByStatus('completed');

    expect(results).toEqual([]);
  });

  // ==================== deleteByRunId ====================

  test('should delete checkpoint by run_id', async () => {
    mockPool.query.mockResolvedValue({ rowCount: 1 });

    const result = await repo.deleteByRunId('run-1');

    expect(mockPool.query).toHaveBeenCalledWith(
      'DELETE FROM pipeline_checkpoints WHERE run_id = $1',
      ['run-1']
    );
    expect(result).toBe(true);
  });

  test('should return false when no checkpoint deleted', async () => {
    mockPool.query.mockResolvedValue({ rowCount: 0 });

    const result = await repo.deleteByRunId('nonexistent');

    expect(result).toBe(false);
  });

  // ==================== findByPipelineId ====================

  test('should find checkpoints by pipeline_id with limit', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        createMockRecord({ pipeline_id: 'pipe-1', run_id: 'run-1' }),
        createMockRecord({ pipeline_id: 'pipe-1', run_id: 'run-2' }),
      ],
    });

    const results = await repo.findByPipelineId('pipe-1', 10);

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT * FROM pipeline_checkpoints WHERE pipeline_id = $1 ORDER BY updated_at DESC LIMIT $2',
      ['pipe-1', 10]
    );
    expect(results.length).toBe(2);
    expect(results[0].pipeline_id).toBe('pipe-1');
  });

  test('should use default limit of 50', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await repo.findByPipelineId('pipe-1');

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['pipe-1', 50]
    );
  });

  // ==================== countByStatus ====================

  test('should count checkpoints by status', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ count: '5' }],
    });

    const count = await repo.countByStatus('running');

    expect(mockPool.query).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM pipeline_checkpoints WHERE status = $1',
      ['running']
    );
    expect(count).toBe(5);
  });
});
