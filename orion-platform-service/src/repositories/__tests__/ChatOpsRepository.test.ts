import {
  ChatOpsCommandRepository,
  ChatOpsExecutionRepository,
  ChatOpsSessionRepository,
  ChatOpsAuditLogRepository,
} from '../ChatOpsRepository';

describe('ChatOpsCommandRepository', () => {
  let repo: ChatOpsCommandRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChatOpsCommandRepository(mockDb);
  });

  test('should find command by name', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'cmd-1', name: 'deploy', subcommand: 'service', schema: { service: { type: 'string' } }, aliases: ['rollout'], permission_level: 'deployer', examples: ['/deploy service=api'] }],
    });
    const result = await repo.findByName('deploy');
    expect(result?.name).toBe('deploy');
    expect(result?.permissionLevel).toBe('deployer');
  });

  test('should find command by alias', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'cmd-1', name: 'deploy', subcommand: 'service', schema: {}, aliases: ['rollout', 'deploy-service'], permission_level: 'deployer', examples: [] }],
    });
    const result = await repo.findByAlias('rollout');
    expect(result?.name).toBe('deploy');
  });

  test('should find by permission level', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'cmd-1', name: 'restart', subcommand: 'pod', schema: {}, aliases: [], permission_level: 'operator', examples: [] },
        { id: 'cmd-2', name: 'rollback', subcommand: 'deployment', schema: {}, aliases: [], permission_level: 'operator', examples: [] },
      ],
    });
    const result = await repo.findByPermission('operator');
    expect(result.length).toBe(2);
  });

  test('should create command', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'cmd-1', name: 'status', subcommand: 'pipeline', schema: { pipelineId: { type: 'string' } }, aliases: ['ps'], permission_level: 'user', examples: ['/status pipelineId=123'] }],
    });
    const result = await repo.create({ name: 'status', subcommand: 'pipeline', schema: { pipelineId: { type: 'string' } }, aliases: ['ps'], permissionLevel: 'user', examples: ['/status pipelineId=123'] });
    expect(result.name).toBe('status');
  });
});

describe('ChatOpsExecutionRepository', () => {
  let repo: ChatOpsExecutionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChatOpsExecutionRepository(mockDb);
  });

  test('should find executions by user', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'exec-1', command_id: 'deploy', user_id: 'user-1', platform: 'slack', channel: 'devops', params: { service: 'api' }, status: 'completed', start_time: new Date(), end_time: new Date(), result: { success: true }, milestones: {} },
      ],
    });
    const result = await repo.findByUser('user-1');
    expect(result.length).toBe(1);
    expect(result[0].userId).toBe('user-1');
    expect(result[0].status).toBe('completed');
  });

  test('should find by status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'exec-1', command_id: 'deploy', user_id: 'u1', platform: 'slack', channel: 'devops', params: {}, status: 'running', start_time: new Date(), end_time: null, result: {}, milestones: {} }],
    });
    const result = await repo.findByStatus('running');
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('running');
  });

  test('should update status', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'exec-1', command_id: 'deploy', user_id: 'u1', platform: 'slack', channel: 'devops', params: {}, status: 'completed', start_time: new Date(), end_time: new Date(), result: { success: true }, milestones: {} }],
    });
    const result = await repo.updateStatus('exec-1', 'completed', new Date(), { success: true });
    expect(result?.status).toBe('completed');
    expect(result?.endTime).toBeDefined();
  });
});

describe('ChatOpsSessionRepository', () => {
  let repo: ChatOpsSessionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChatOpsSessionRepository(mockDb);
  });

  test('should find session by key', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ key: 'session-abc', user_id: 'user-1', channel_id: 'channel-1', history: [{ msg: 'hello' }], state: { step: 1 } }],
    });
    const result = await repo.findByKey('session-abc');
    expect(result?.key).toBe('session-abc');
    expect(result?.userId).toBe('user-1');
  });

  test('should find sessions by user', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { key: 'sess-1', user_id: 'user-1', channel_id: 'ch-1', history: [], state: {} },
        { key: 'sess-2', user_id: 'user-1', channel_id: 'ch-2', history: [], state: {} },
      ],
    });
    const result = await repo.findByUser('user-1');
    expect(result.length).toBe(2);
  });

  test('should update state', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ key: 'sess-1', user_id: 'user-1', channel_id: 'ch-1', history: [{ msg: 'step1' }, { msg: 'step2' }], state: { step: 2 } }],
    });
    const result = await repo.updateState('sess-1', { step: 2 }, [{ msg: 'step1' }, { msg: 'step2' }]);
    expect(result?.state.step).toBe(2);
  });
});

describe('ChatOpsAuditLogRepository', () => {
  let repo: ChatOpsAuditLogRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChatOpsAuditLogRepository(mockDb);
  });

  test('should find by trace id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'log-1', trace_id: 'trace-abc', actor: { userId: 'user-1' }, timestamp: new Date(), action: { command: 'deploy' }, result: 'success', context: {} },
      ],
    });
    const result = await repo.findByTraceId('trace-abc');
    expect(result.length).toBe(1);
    expect(result[0].traceId).toBe('trace-abc');
    expect(result[0].result).toBe('success');
  });

  test('should find by result type', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'log-1', trace_id: 't1', actor: {}, timestamp: new Date(), action: {}, result: 'failed', context: {} }],
    });
    const result = await repo.findByResult('failed');
    expect(result.length).toBe(1);
    expect(result[0].result).toBe('failed');
  });

  test('should find recent logs', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'log-1', trace_id: 't1', actor: {}, timestamp: new Date(), action: {}, result: 'success', context: {} }],
    });
    const result = await repo.findRecent(24);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('INTERVAL'), [24]);
  });
});