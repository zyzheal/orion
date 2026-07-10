/**
 * Comprehensive tests for ProcessKiller
 * Tests: constructor, register, unregister, kill sequence (SIGTERM/SIGKILL/docker)
 */

import { EventEmitter } from 'events';

// --- Module-level mocks ---
const mockCreate = jest.fn().mockResolvedValue({});
const mockFindByTaskId = jest.fn().mockResolvedValue(undefined);
const mockMarkKilled = jest.fn().mockResolvedValue({});
const mockDeleteByTaskId = jest.fn().mockResolvedValue(true);

jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return jest.fn(() => mockLogger);
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

jest.mock('../../../repositories/ProcessRegistryRepository', () => ({
  ProcessRegistryRepository: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    findByTaskId: mockFindByTaskId,
    markKilled: mockMarkKilled,
    deleteByTaskId: mockDeleteByTaskId,
  })),
}));

jest.mock('../../../errors', () => ({
  OrionError: class OrionError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'OrionError';
    }
  },
  ErrorCode: { INTERNAL_ERROR: 'INTERNAL_ERROR' },
}));

// Mock child_process.spawn
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

function createMockChildProcess(exitCode: number = 0) {
  const child = new EventEmitter();
  (child as any).stdout = new EventEmitter();
  (child as any).stderr = new EventEmitter();
  (child as any).kill = jest.fn();
  // Auto-emit close after a tick
  process.nextTick(() => {
    child.emit('close', exitCode);
  });
  return child;
}

// --- Tests ---
import { ProcessKiller } from '../ProcessKiller';

describe('ProcessKiller', () => {
  let processKiller: ProcessKiller;
  let killSpy: jest.SpyInstance;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSpawn.mockImplementation(() => createMockChildProcess(0));
    processKiller = new ProcessKiller(mockDb);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (killSpy) killSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should throw when db is not provided', () => {
      expect(() => new ProcessKiller()).toThrow('ProcessKiller requires a database connection');
    });

    it('should throw when db is undefined', () => {
      expect(() => new ProcessKiller(undefined as any)).toThrow('ProcessKiller requires a database connection');
    });

    it('should create with db - repository instantiated', () => {
      processKiller = new ProcessKiller(mockDb);
      expect(processKiller).toBeDefined();
      processKiller.register({ taskId: 't1', pid: 100 });
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should persist process info to DB', () => {
      processKiller.register({ taskId: 'task-1', pid: 1234, pgid: 1200, containerId: 'ctr-abc' });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'task-1',
        pid: 1234,
        pgid: 1200,
        containerId: 'ctr-abc',
        status: 'active',
      }));
    });

    it('should handle missing pgid and containerId as null', () => {
      processKiller.register({ taskId: 'task-2', pid: 5678 });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'task-2',
        pid: 5678,
        pgid: null,
        containerId: null,
      }));
    });

    it('should fire-and-forget DB errors', () => {
      mockCreate.mockRejectedValueOnce(new Error('DB down'));
      expect(() => processKiller.register({ taskId: 'task-3', pid: 100 })).not.toThrow();
    });
  });

  describe('unregister', () => {
    it('should delete process from DB', () => {
      processKiller.unregister('task-1');
      expect(mockDeleteByTaskId).toHaveBeenCalledWith('task-1');
    });

    it('should fire-and-forget DB errors', () => {
      mockDeleteByTaskId.mockRejectedValueOnce(new Error('DB down'));
      expect(() => processKiller.unregister('task-1')).not.toThrow();
    });
  });

  describe('kill', () => {
    it('should return early when process not found in DB', async () => {
      mockFindByTaskId.mockResolvedValueOnce(undefined);
      await processKiller.kill('unknown-task', 'test');
      expect(mockMarkKilled).not.toHaveBeenCalled();
    });

    it('should propagate DB lookup errors', async () => {
      mockFindByTaskId.mockRejectedValueOnce(new Error('DB connection lost'));
      await expect(processKiller.kill('task-1', 'test')).rejects.toThrow('DB connection lost');
    });

    it('should send SIGTERM to process group and complete when process dies', async () => {
      mockFindByTaskId.mockResolvedValueOnce({
        taskId: 'task-1', pid: 1234, pgid: 1200, containerId: null,
      });
      killSpy = jest.spyOn(process, 'kill').mockImplementation((..._args: any[]) => {
        throw new Error('No such process');
      });

      const killPromise = processKiller.kill('task-1', 'timeout');
      await jest.advanceTimersByTimeAsync(200);
      await killPromise;

      expect(killSpy).toHaveBeenCalledWith(-1200, 'SIGTERM');
      expect(mockMarkKilled).toHaveBeenCalledWith('task-1');
    });

    it('should fall back to pid when process group SIGTERM fails', async () => {
      mockFindByTaskId.mockResolvedValueOnce({
        taskId: 'task-1', pid: 1234, pgid: 1200, containerId: null,
      });
      let callCount = 0;
      killSpy = jest.spyOn(process, 'kill').mockImplementation((...args: any[]) => {
        callCount++;
        if (callCount === 1) throw new Error('ESRCH');
        throw new Error('No such process');
      });

      const killPromise = processKiller.kill('task-1', 'timeout');
      await jest.advanceTimersByTimeAsync(200);
      await killPromise;

      expect(killSpy).toHaveBeenCalledWith(-1200, 'SIGTERM');
      expect(killSpy).toHaveBeenCalledWith(1234, 'SIGTERM');
    });

    it('should send signal to pid when no pgid is set', async () => {
      mockFindByTaskId.mockResolvedValueOnce({
        taskId: 'task-1', pid: 1234, pgid: null, containerId: null,
      });
      killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('No such process');
      });

      const killPromise = processKiller.kill('task-1', 'timeout');
      await jest.advanceTimersByTimeAsync(200);
      await killPromise;

      expect(killSpy).toHaveBeenCalledWith(-1234, 'SIGTERM');
    });

    it('should mark process as killed in DB after kill sequence', async () => {
      mockFindByTaskId.mockResolvedValueOnce({
        taskId: 'task-1', pid: 1234, pgid: 1200, containerId: null,
      });
      killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('No such process');
      });

      const killPromise = processKiller.kill('task-1', 'global_timeout');
      await jest.advanceTimersByTimeAsync(200);
      await killPromise;

      expect(mockMarkKilled).toHaveBeenCalledWith('task-1');
    });

    it('should handle markKilled DB error gracefully', async () => {
      mockFindByTaskId.mockResolvedValueOnce({
        taskId: 'task-1', pid: 1234, pgid: 1200, containerId: null,
      });
      mockMarkKilled.mockRejectedValueOnce(new Error('DB down'));
      killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('No such process');
      });

      const killPromise = processKiller.kill('task-1', 'test');
      await jest.advanceTimersByTimeAsync(200);
      await killPromise;
    });
  });
});
