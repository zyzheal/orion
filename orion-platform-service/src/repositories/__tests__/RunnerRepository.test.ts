import { PostgresRunnerRepository } from '../RunnerRepository';

describe('PostgresRunnerRepository', () => {
  let repo: PostgresRunnerRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PostgresRunnerRepository(mockDb);
  });

  test('should create a runner', async () => {
    const now = new Date();
    const mockRow = {
      id: 'runner-1',
      tenant_id: 't1',
      name: 'runner-alpha',
      status: 'online',
      labels: '["linux","gpu"]',
      max_concurrent: 5,
      current_jobs: 0,
      last_heartbeat: now,
      metadata: '{"os":"ubuntu"}',
      endpoint: 'http://runner-1:8080',
      created_at: now,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.create({
      tenantId: 't1',
      name: 'runner-alpha',
      labels: ['linux', 'gpu'],
      maxConcurrent: 5,
      metadata: { os: 'ubuntu' },
      endpoint: 'http://runner-1:8080',
    });

    expect(result.name).toBe('runner-alpha');
    expect(result.tenantId).toBe('t1');
    expect(result.status).toBe('online');
    expect(result.labels).toEqual(['linux', 'gpu']);
    expect(result.maxConcurrent).toBe(5);
    expect(result.currentJobs).toBe(0);
    expect(result.endpoint).toBe('http://runner-1:8080');
  });

  test('should find runner by name', async () => {
    const mockRow = {
      id: 'runner-1',
      tenant_id: 't1',
      name: 'runner-alpha',
      status: 'online',
      labels: '[]',
      max_concurrent: 3,
      current_jobs: 1,
      last_heartbeat: new Date(),
      metadata: '{}',
      endpoint: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.findByName('t1', 'runner-alpha');
    expect(result).toBeDefined();
    expect(result!.name).toBe('runner-alpha');
    expect(result!.tenantId).toBe('t1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1 AND name = $2'),
      ['t1', 'runner-alpha'],
    );
  });

  test('should find runners by status', async () => {
    const mockRows = [
      { id: 'r1', tenant_id: 't1', name: 'runner-1', status: 'offline', labels: '[]', max_concurrent: 3, current_jobs: 0, last_heartbeat: new Date(), metadata: '{}', endpoint: null, created_at: new Date() },
      { id: 'r2', tenant_id: 't2', name: 'runner-2', status: 'offline', labels: '[]', max_concurrent: 5, current_jobs: 0, last_heartbeat: new Date(), metadata: '{}', endpoint: null, created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows, rowCount: 2 });

    const result = await repo.findByStatus('offline');
    expect(result.length).toBe(2);
    expect(result[0].status).toBe('offline');
    expect(result[1].status).toBe('offline');
  });

  test('should return undefined when runner not found by name', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await repo.findByName('t1', 'nonexistent');
    expect(result).toBeUndefined();
  });

  test('should update runner status', async () => {
    const mockRow = {
      id: 'runner-1',
      tenant_id: 't1',
      name: 'runner-alpha',
      status: 'draining',
      labels: '[]',
      max_concurrent: 3,
      current_jobs: 1,
      last_heartbeat: new Date(),
      metadata: '{}',
      endpoint: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.update('runner-1', { status: 'draining' });
    expect(result).toBeDefined();
    expect(result!.status).toBe('draining');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('status = $2'),
      ['runner-1', 'draining'],
    );
  });

  test('should update runner heartbeat', async () => {
    const mockRow = {
      id: 'runner-1',
      tenant_id: 't1',
      name: 'runner-alpha',
      status: 'online',
      labels: '[]',
      max_concurrent: 3,
      current_jobs: 0,
      last_heartbeat: new Date(),
      metadata: '{}',
      endpoint: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.updateHeartbeat('runner-1');
    expect(result).toBeDefined();
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('last_heartbeat'),
      ['runner-1'],
    );
  });
});
