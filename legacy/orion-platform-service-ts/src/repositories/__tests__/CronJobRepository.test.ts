/**
 * CronJobRepository 单元测试
 */

import { CronJobRepository, CronJobEntity } from '../CronJobRepository';

describe('CronJobRepository', () => {
  let repo: CronJobRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new CronJobRepository(mockDb);
  });

  test('should create a cron job', async () => {
    const mockRow = {
      id: 'job-1',
      name: 'cleanup-logs',
      schedule: '0 0 * * *',
      handler: 'LogCleanupHandler',
      payload: { retentionDays: 30 },
      enabled: true,
      last_run_at: null,
      last_run_status: null,
      next_run_at: new Date('2024-01-02T00:00:00Z'),
      created_at: new Date('2024-01-01T00:00:00Z'),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      name: 'cleanup-logs',
      schedule: '0 0 * * *',
      handler: 'LogCleanupHandler',
      payload: { retentionDays: 30 },
      enabled: true,
      nextRunAt: new Date('2024-01-02T00:00:00Z'),
    });

    expect(result.name).toBe('cleanup-logs');
    expect(result.schedule).toBe('0 0 * * *');
    expect(result.handler).toBe('LogCleanupHandler');
    expect(result.payload).toEqual({ retentionDays: 30 });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cron_jobs'),
      expect.arrayContaining(['cleanup-logs', '0 0 * * *', 'LogCleanupHandler'])
    );
  });

  test('should find cron job by name', async () => {
    const mockRow = {
      id: 'job-1',
      name: 'cleanup-logs',
      schedule: '0 0 * * *',
      handler: 'LogCleanupHandler',
      payload: { retentionDays: 30 },
      enabled: true,
      last_run_at: new Date('2024-01-01T00:00:00Z'),
      last_run_status: 'success',
      next_run_at: new Date('2024-01-02T00:00:00Z'),
      created_at: new Date('2024-01-01T00:00:00Z'),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.findByName('cleanup-logs');

    expect(result?.name).toBe('cleanup-logs');
    expect(result?.handler).toBe('LogCleanupHandler');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM cron_jobs WHERE name = $1'),
      ['cleanup-logs']
    );
  });

  test('should find enabled cron jobs', async () => {
    const mockRows = [
      {
        id: 'job-1',
        name: 'cleanup-logs',
        schedule: '0 0 * * *',
        handler: 'LogCleanupHandler',
        payload: {},
        enabled: true,
        last_run_at: null,
        last_run_status: null,
        next_run_at: new Date('2024-01-02T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'job-2',
        name: 'sync-data',
        schedule: '*/5 * * * *',
        handler: 'DataSyncHandler',
        payload: { source: 'external' },
        enabled: true,
        last_run_at: null,
        last_run_status: null,
        next_run_at: new Date('2024-01-01T00:05:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows });

    const result = await repo.findEnabled();

    expect(result).toHaveLength(2);
    expect(result[0].enabled).toBe(true);
    expect(result[1].enabled).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM cron_jobs WHERE enabled = true')
    );
  });

  test('should update last run status', async () => {
    const mockRow = {
      id: 'job-1',
      name: 'cleanup-logs',
      schedule: '0 0 * * *',
      handler: 'LogCleanupHandler',
      payload: {},
      enabled: true,
      last_run_at: new Date('2024-01-01T12:00:00Z'),
      last_run_status: 'success',
      next_run_at: new Date('2024-01-02T00:00:00Z'),
      created_at: new Date('2024-01-01T00:00:00Z'),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const lastRunAt = new Date('2024-01-01T12:00:00Z');
    const nextRunAt = new Date('2024-01-02T00:00:00Z');
    const result = await repo.updateLastRun('job-1', lastRunAt, 'success', nextRunAt);

    expect(result.lastRunStatus).toBe('success');
    expect(result.lastRunAt).toEqual(lastRunAt);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE cron_jobs SET'),
      expect.arrayContaining([lastRunAt, 'success', nextRunAt, 'job-1'])
    );
  });

  test('should list cron jobs', async () => {
    const mockRows = [
      {
        id: 'job-1',
        name: 'cleanup-logs',
        schedule: '0 0 * * *',
        handler: 'LogCleanupHandler',
        payload: {},
        enabled: true,
        last_run_at: null,
        last_run_status: null,
        next_run_at: new Date('2024-01-02T00:00:00Z'),
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'job-2',
        name: 'sync-data',
        schedule: '*/5 * * * *',
        handler: 'DataSyncHandler',
        payload: {},
        enabled: false,
        last_run_at: null,
        last_run_status: null,
        next_run_at: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
    ];
    mockDb.query
      .mockResolvedValueOnce({ rows: mockRows })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const result = await repo.list();

    expect(result.entities).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.entities[0].name).toBe('cleanup-logs');
  });
});