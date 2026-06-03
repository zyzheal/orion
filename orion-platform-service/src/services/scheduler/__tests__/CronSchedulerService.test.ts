/**
 * Tests for CronSchedulerService
 * Covers: constructor, job CRUD, execution, lifecycle, scheduler tick, error paths
 */

// ── Manual mocks (must be before imports) ─────────────────────────────────

const mockCronJobCreate = jest.fn().mockResolvedValue({});
const mockCronJobFindAll = jest.fn().mockResolvedValue({ entities: [], total: 0 });
const mockCronJobFindEnabled = jest.fn().mockResolvedValue([]);
const mockCronJobDelete = jest.fn().mockResolvedValue(undefined);
const mockCronJobUpdate = jest.fn().mockResolvedValue({});
const mockCronJobUpdateLastRun = jest.fn().mockResolvedValue({});

jest.mock('../../../repositories/CronJobRepository', () => ({
  CronJobRepository: jest.fn().mockImplementation(() => ({
    create: mockCronJobCreate,
    findAll: mockCronJobFindAll,
    findEnabled: mockCronJobFindEnabled,
    delete: mockCronJobDelete,
    update: mockCronJobUpdate,
    updateLastRun: mockCronJobUpdateLastRun,
  })),
}));

const mockExecCreate = jest.fn().mockResolvedValue({});
const mockExecComplete = jest.fn().mockResolvedValue({});

jest.mock('../../../repositories/CronExecutionRepository', () => ({
  CronExecutionRepository: jest.fn().mockImplementation(() => ({
    create: mockExecCreate,
    complete: mockExecComplete,
  })),
}));

// Mock cron-parser
let mockPrevFn: jest.Mock;
let mockNextFn: jest.Mock;

jest.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: jest.fn(() => ({
      prev: (...args: any[]) => mockPrevFn(...args),
      next: (...args: any[]) => mockNextFn(...args),
    })),
  },
}));

// Mock pino logger
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return jest.fn(() => mockLogger);
});

import { CronSchedulerService, CronJob } from '../CronSchedulerService';
import { CronJobRepository } from '../../../repositories/CronJobRepository';
import { CronExecutionRepository } from '../../../repositories/CronExecutionRepository';
import { CronExpressionParser } from 'cron-parser';

describe('CronSchedulerService', () => {
  let service: CronSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock for cron-parser
    mockPrevFn = jest.fn().mockReturnValue(new Date(Date.now() - 30_000));
    mockNextFn = jest.fn().mockReturnValue(new Date(Date.now() + 300_000));

    // Reset parse mock to default behavior
    (CronExpressionParser.parse as jest.Mock).mockImplementation(() => ({
      prev: (...args: any[]) => mockPrevFn(...args),
      next: (...args: any[]) => mockNextFn(...args),
    }));

    // Reset all repo mocks to default success
    mockCronJobCreate.mockResolvedValue({});
    mockCronJobFindAll.mockResolvedValue({ entities: [], total: 0 });
    mockCronJobFindEnabled.mockResolvedValue([]);
    mockCronJobDelete.mockResolvedValue(undefined);
    mockCronJobUpdate.mockResolvedValue({});
    mockCronJobUpdateLastRun.mockResolvedValue({});
    mockExecCreate.mockResolvedValue({});
    mockExecComplete.mockResolvedValue({});

    // Create service without DB (in-memory mode)
    service = new CronSchedulerService();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create service in memory-only mode when no db provided', () => {
      const svc = new CronSchedulerService();
      expect(svc).toBeDefined();
      expect(svc.getRunningJobs()).toEqual([]);
    });

    it('should create service with DB repositories when db is provided', () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);
      expect(svc).toBeDefined();
      expect(CronJobRepository).toHaveBeenCalledWith(mockDb);
      expect(CronExecutionRepository).toHaveBeenCalledWith(mockDb);
    });
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  describe('start / stop', () => {
    it('should start and set up interval', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      await service.start();
      expect(setIntervalSpy).toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      await service.start();
      await service.start();
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should stop and clear interval', async () => {
      await service.start();
      service.stop();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should be safe to stop when not started', () => {
      expect(() => service.stop()).not.toThrow();
    });

    it('should restore enabled jobs from DB on start', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      const restoredEntity = {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        handler: 'test-task',
        enabled: true,
        lastRunAt: null,
        lastRunStatus: null,
        nextRunAt: new Date(),
        createdAt: new Date(),
        payload: {},
      };

      mockCronJobFindEnabled.mockResolvedValue([restoredEntity]);
      // getJobs also calls findAll when DB is present, so mock it too
      mockCronJobFindAll.mockResolvedValue({ entities: [restoredEntity], total: 1 });

      await svc.start();
      const jobs = await svc.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe('job-1');
      svc.stop();
    });

    it('should handle DB restore failure gracefully', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);
      mockCronJobFindEnabled.mockRejectedValue(new Error('DB down'));

      await expect(svc.start()).resolves.not.toThrow();
      svc.stop();
    });
  });

  // ── Job CRUD ─────────────────────────────────────────────────────────────

  describe('addJob', () => {
    it('should add a job with default enabled=true', () => {
      service.addJob({ id: 'j1', name: 'Job 1', schedule: '*/5 * * * *', task: 'my-task' });
      const job = service.getJob('j1');
      expect(job).toBeDefined();
      expect(job!.id).toBe('j1');
      expect(job!.name).toBe('Job 1');
      expect(job!.enabled).toBe(true);
      expect(job!.schedule).toBe('*/5 * * * *');
      expect(job!.task).toBe('my-task');
    });

    it('should add a job with explicit enabled=false', () => {
      service.addJob({ id: 'j2', name: 'Disabled', schedule: '0 * * * *', task: 't', enabled: false });
      const job = service.getJob('j2');
      expect(job!.enabled).toBe(false);
    });

    it('should set nextRunAt from cron-parser', () => {
      mockNextFn.mockReturnValue(new Date('2026-06-01T12:00:00Z'));
      service.addJob({ id: 'j3', name: 'J3', schedule: '0 * * * *', task: 't' });
      const job = service.getJob('j3');
      expect(job!.nextRunAt).toBe('2026-06-01T12:00:00.000Z');
    });

    it('should overwrite existing job with same id', () => {
      service.addJob({ id: 'j4', name: 'First', schedule: '* * * * *', task: 't1' });
      service.addJob({ id: 'j4', name: 'Second', schedule: '0 0 * * *', task: 't2' });
      const job = service.getJob('j4');
      expect(job!.name).toBe('Second');
      expect(job!.task).toBe('t2');
    });

    it('should persist to DB when repository is available', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      svc.addJob({ id: 'db-job', name: 'DB Job', schedule: '* * * * *', task: 't' });

      // fire-and-forget, wait a microtask tick
      await Promise.resolve();
      expect(mockCronJobCreate).toHaveBeenCalled();
    });

    it('should handle DB persistence failure gracefully', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);
      mockCronJobCreate.mockRejectedValue(new Error('DB error'));

      expect(() => {
        svc.addJob({ id: 'fail-job', name: 'Fail', schedule: '* * * * *', task: 't' });
      }).not.toThrow();

      expect(svc.getJob('fail-job')).toBeDefined();
    });
  });

  describe('getJobs', () => {
    it('should return empty array when no jobs exist', async () => {
      const jobs = await service.getJobs();
      expect(jobs).toEqual([]);
    });

    it('should return all in-memory jobs', async () => {
      service.addJob({ id: 'a', name: 'A', schedule: '* * * * *', task: 't1' });
      service.addJob({ id: 'b', name: 'B', schedule: '0 * * * *', task: 't2' });
      const jobs = await service.getJobs();
      expect(jobs.length).toBe(2);
    });

    it('should return jobs from DB when repository is available', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      mockCronJobFindAll.mockResolvedValue({
        entities: [
          {
            id: 'db-1', name: 'DB Job', schedule: '* * * * *', handler: 't',
            enabled: true, lastRunAt: null, lastRunStatus: null,
            nextRunAt: new Date(), createdAt: new Date(), payload: {},
          },
        ],
        total: 1,
      });

      const jobs = await svc.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe('db-1');
    });

    it('should fall back to in-memory when DB query fails', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      // Add a job in memory first
      svc.addJob({ id: 'mem-1', name: 'Mem', schedule: '* * * * *', task: 't' });

      // Now mock findAll to fail
      mockCronJobFindAll.mockRejectedValue(new Error('DB down'));

      const jobs = await svc.getJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe('mem-1');
    });
  });

  describe('getJob', () => {
    it('should return undefined for non-existent job', () => {
      expect(service.getJob('nonexistent')).toBeUndefined();
    });

    it('should return the job by id', () => {
      service.addJob({ id: 'x', name: 'X', schedule: '* * * * *', task: 't' });
      expect(service.getJob('x')!.name).toBe('X');
    });
  });

  describe('removeJob', () => {
    it('should remove a job from in-memory store', () => {
      service.addJob({ id: 'rm1', name: 'Remove', schedule: '* * * * *', task: 't' });
      service.removeJob('rm1');
      expect(service.getJob('rm1')).toBeUndefined();
    });

    it('should be safe to remove non-existent job', () => {
      expect(() => service.removeJob('ghost')).not.toThrow();
    });

    it('should remove from running job ids', () => {
      service.addJob({ id: 'rm2', name: 'Rm2', schedule: '* * * * *', task: 't' });
      service.removeJob('rm2');
      expect(service.getRunningJobs()).not.toContain('rm2');
    });

    it('should call repository delete when DB is available', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      svc.addJob({ id: 'rm-db', name: 'RmDB', schedule: '* * * * *', task: 't' });
      svc.removeJob('rm-db');

      await Promise.resolve();
      expect(mockCronJobDelete).toHaveBeenCalledWith('rm-db');
    });
  });

  describe('enableJob / disableJob', () => {
    it('should enable a disabled job', () => {
      service.addJob({ id: 'en1', name: 'En', schedule: '* * * * *', task: 't', enabled: false });
      service.enableJob('en1');
      const job = service.getJob('en1');
      expect(job!.enabled).toBe(true);
      expect(job!.nextRunAt).toBeDefined();
    });

    it('should disable an enabled job', () => {
      service.addJob({ id: 'dis1', name: 'Dis', schedule: '* * * * *', task: 't' });
      service.disableJob('dis1');
      const job = service.getJob('dis1');
      expect(job!.enabled).toBe(false);
      expect(job!.nextRunAt).toBeUndefined();
    });

    it('should warn when enabling non-existent job', () => {
      expect(() => service.enableJob('ghost')).not.toThrow();
    });

    it('should warn when disabling non-existent job', () => {
      expect(() => service.disableJob('ghost')).not.toThrow();
    });

    it('should update DB when repository is available', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      svc.addJob({ id: 'upd1', name: 'Upd', schedule: '* * * * *', task: 't' });
      svc.disableJob('upd1');

      await Promise.resolve();
      expect(mockCronJobUpdate).toHaveBeenCalledWith('upd1', { enabled: false });
    });
  });

  // ── Execution ────────────────────────────────────────────────────────────

  describe('executeJob', () => {
    it('should execute a job successfully', async () => {
      service.addJob({ id: 'exec1', name: 'Exec', schedule: '* * * * *', task: 'my-task' });
      const result = await service.executeJob('exec1');

      expect(result.executionId).toBeTruthy();
      expect(result.jobId).toBe('exec1');
      expect(result.status).toBe('success');
      expect(result.completedAt).toBeDefined();
      expect(result.output).toContain('my-task');
    });

    it('should throw OrionError for non-existent job', async () => {
      await expect(service.executeJob('nonexistent')).rejects.toThrow('Cron job not found');
    });

    it('should update job lastRunAt and lastRunStatus after execution', async () => {
      service.addJob({ id: 'exec2', name: 'Exec2', schedule: '* * * * *', task: 't' });
      await service.executeJob('exec2');

      const job = service.getJob('exec2');
      expect(job!.lastRunAt).toBeDefined();
      expect(job!.lastRunStatus).toBe('success');
    });

    it('should add execution to history', async () => {
      service.addJob({ id: 'exec3', name: 'Exec3', schedule: '* * * * *', task: 't' });
      await service.executeJob('exec3');

      const history = service.getExecutionHistory('exec3');
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('success');
    });

    it('should clear running job id after execution', async () => {
      service.addJob({ id: 'exec4', name: 'Exec4', schedule: '* * * * *', task: 't' });
      await service.executeJob('exec4');
      expect(service.getRunningJobs()).not.toContain('exec4');
    });

    it('should persist execution record to DB', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      svc.addJob({ id: 'exec-db', name: 'ExecDB', schedule: '* * * * *', task: 't' });
      await svc.executeJob('exec-db');

      expect(mockExecCreate).toHaveBeenCalled();
      expect(mockExecComplete).toHaveBeenCalledWith(
        expect.any(String),
        'completed',
        expect.objectContaining({ output: expect.any(String) }),
      );
    });
  });

  // ── Execution History ────────────────────────────────────────────────────

  describe('getExecutionHistory', () => {
    it('should return empty array when no executions', () => {
      expect(service.getExecutionHistory()).toEqual([]);
    });

    it('should return all executions when no jobId filter', async () => {
      service.addJob({ id: 'h1', name: 'H1', schedule: '* * * * *', task: 't' });
      service.addJob({ id: 'h2', name: 'H2', schedule: '* * * * *', task: 't' });
      await service.executeJob('h1');
      await service.executeJob('h2');

      const all = service.getExecutionHistory();
      expect(all.length).toBe(2);
    });

    it('should filter by jobId', async () => {
      service.addJob({ id: 'hf1', name: 'HF1', schedule: '* * * * *', task: 't' });
      service.addJob({ id: 'hf2', name: 'HF2', schedule: '* * * * *', task: 't' });
      await service.executeJob('hf1');
      await service.executeJob('hf2');

      const filtered = service.getExecutionHistory('hf1');
      expect(filtered.length).toBe(1);
      expect(filtered[0].jobId).toBe('hf1');
    });
  });

  // ── Running Jobs ─────────────────────────────────────────────────────────

  describe('getRunningJobs', () => {
    it('should return empty array when no jobs are running', () => {
      expect(service.getRunningJobs()).toEqual([]);
    });
  });

  // ── shouldExecuteJob ─────────────────────────────────────────────────────

  describe('shouldExecuteJob', () => {
    it('should return false for disabled job', () => {
      const job: CronJob = {
        id: 'j', name: 'J', schedule: '* * * * *', task: 't',
        enabled: false, createdAt: '', updatedAt: '',
      };
      expect(service.shouldExecuteJob(job)).toBe(false);
    });

    it('should return true when previous scheduled time is within tick window', () => {
      const now = new Date();
      mockPrevFn.mockReturnValue(new Date(now.getTime() - 30_000));

      const job: CronJob = {
        id: 'j', name: 'J', schedule: '* * * * *', task: 't',
        enabled: true, createdAt: '', updatedAt: '',
      };
      expect(service.shouldExecuteJob(job, now)).toBe(true);
    });

    it('should return false when previous scheduled time is outside tick window', () => {
      const now = new Date();
      mockPrevFn.mockReturnValue(new Date(now.getTime() - 300_000));

      const job: CronJob = {
        id: 'j', name: 'J', schedule: '* * * * *', task: 't',
        enabled: true, createdAt: '', updatedAt: '',
      };
      expect(service.shouldExecuteJob(job, now)).toBe(false);
    });

    it('should return false for invalid cron expression', () => {
      (CronExpressionParser.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid cron');
      });

      const job: CronJob = {
        id: 'j', name: 'J', schedule: 'invalid', task: 't',
        enabled: true, createdAt: '', updatedAt: '',
      };
      expect(service.shouldExecuteJob(job)).toBe(false);
    });
  });

  // ── DB failure paths ─────────────────────────────────────────────────────

  describe('DB failure resilience', () => {
    it('should handle execution completion DB failure gracefully', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      mockExecCreate.mockResolvedValue({});
      mockExecComplete.mockRejectedValue(new Error('DB write fail'));
      mockCronJobCreate.mockResolvedValue({});
      mockCronJobUpdateLastRun.mockRejectedValue(new Error('DB write fail'));

      svc.addJob({ id: 'fail-exec', name: 'FailExec', schedule: '* * * * *', task: 't' });
      const result = await svc.executeJob('fail-exec');

      // Should still return success (task itself succeeded)
      expect(result.status).toBe('success');
    });

    it('should handle execution create DB failure gracefully', async () => {
      const mockDb = { query: jest.fn() };
      const svc = new CronSchedulerService(mockDb);

      mockExecCreate.mockRejectedValue(new Error('DB fail'));
      mockExecComplete.mockResolvedValue({});
      mockCronJobCreate.mockResolvedValue({});
      mockCronJobUpdateLastRun.mockResolvedValue({});

      svc.addJob({ id: 'fail-create', name: 'FailCreate', schedule: '* * * * *', task: 't' });
      const result = await svc.executeJob('fail-create');
      expect(result.status).toBe('success');
    });
  });
});
