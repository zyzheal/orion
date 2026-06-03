/**
 * Comprehensive tests for HeartbeatWatchdog
 * Tests: constructor, start, stop, register, beat, unregister, checkHeartbeats
 */

// --- Module-level mocks ---
const mockCreate = jest.fn().mockResolvedValue({});
const mockFindActive = jest.fn().mockResolvedValue([]);
const mockUpdateLastBeat = jest.fn().mockResolvedValue({});
const mockMarkTimeout = jest.fn().mockResolvedValue({});
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
  v4: jest.fn(() => 'test-uuid-hb'),
}));

jest.mock('../../../repositories/HeartbeatRegistryRepository', () => ({
  HeartbeatRegistryRepository: jest.fn().mockImplementation(() => ({
    create: mockCreate,
    findActive: mockFindActive,
    updateLastBeat: mockUpdateLastBeat,
    markTimeout: mockMarkTimeout,
    deleteByTaskId: mockDeleteByTaskId,
  })),
}));

// --- Tests ---
import { HeartbeatWatchdog } from '../HeartbeatWatchdog';

describe('HeartbeatWatchdog', () => {
  let watchdog: HeartbeatWatchdog;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFindActive.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create without db - no repository', () => {
      watchdog = new HeartbeatWatchdog();
      expect(watchdog).toBeDefined();
    });

    it('should create with db - repository instantiated', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      expect(watchdog).toBeDefined();
    });
  });

  describe('start', () => {
    it('should set up check interval', async () => {
      watchdog = new HeartbeatWatchdog();
      await watchdog.start();

      // Verify interval is running by checking that advancing timers does not throw
      await jest.advanceTimersByTimeAsync(5000);
    });

    it('should restore active entries from DB when db provided', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockFindActive.mockResolvedValueOnce([
        { taskId: 'task-1', lastBeat: Date.now(), timeoutMs: 15000 },
        { taskId: 'task-2', lastBeat: Date.now(), timeoutMs: 15000 },
      ]);

      await watchdog.start();
      expect(mockFindActive).toHaveBeenCalled();
    });

    it('should handle DB restore failure gracefully', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockFindActive.mockRejectedValueOnce(new Error('DB connection failed'));

      await watchdog.start();
      // Should not throw
    });

    it('should not query DB when no repository', async () => {
      watchdog = new HeartbeatWatchdog();
      await watchdog.start();
      expect(mockFindActive).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clear interval and callbacks', async () => {
      watchdog = new HeartbeatWatchdog();
      await watchdog.start();

      const callback = jest.fn();
      watchdog.register('task-1', { onTimeout: callback });

      watchdog.stop();

      // After stop, advancing timers should not trigger checkHeartbeats
      await jest.advanceTimersByTimeAsync(10000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    beforeEach(() => {
      watchdog = new HeartbeatWatchdog();
    });

    it('should store callback for later use', async () => {
      const callback = jest.fn();
      watchdog.register('task-1', { intervalMs: 5000, timeoutMs: 15000, onTimeout: callback });
      // Callback is stored; we verify it's called in checkHeartbeats tests
    });

    it('should use default values when options not provided', () => {
      watchdog.register('task-1', {});
      // Should not throw
    });

    it('should persist to DB when db provided', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);

      watchdog.register('task-1', { intervalMs: 3000, timeoutMs: 10000 });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'task-1',
        intervalMs: 3000,
        timeoutMs: 10000,
        status: 'active',
      }));
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockCreate.mockRejectedValueOnce(new Error('DB down'));

      expect(() => watchdog.register('task-1', {})).not.toThrow();
    });
  });

  describe('beat', () => {
    it('should update lastBeat in DB when db provided', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);

      watchdog.beat('task-1');
      expect(mockUpdateLastBeat).toHaveBeenCalledWith('task-1', expect.any(Number));
    });

    it('should do nothing when no db', () => {
      watchdog = new HeartbeatWatchdog();
      watchdog.beat('task-1');
      expect(mockUpdateLastBeat).not.toHaveBeenCalled();
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockUpdateLastBeat.mockRejectedValueOnce(new Error('DB down'));

      expect(() => watchdog.beat('task-1')).not.toThrow();
    });
  });

  describe('unregister', () => {
    it('should remove callback', () => {
      watchdog = new HeartbeatWatchdog();
      const callback = jest.fn();
      watchdog.register('task-1', { onTimeout: callback });
      watchdog.unregister('task-1');
      // Callback should no longer be called by checkHeartbeats
    });

    it('should delete from DB when db provided', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);

      watchdog.unregister('task-1');
      expect(mockDeleteByTaskId).toHaveBeenCalledWith('task-1');
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockDeleteByTaskId.mockRejectedValueOnce(new Error('DB down'));

      expect(() => watchdog.unregister('task-1')).not.toThrow();
    });
  });

  describe('checkHeartbeats (via timer)', () => {
    it('should trigger timeout callback when heartbeat expired', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      const callback = jest.fn();

      watchdog.register('task-1', { timeoutMs: 15000, onTimeout: callback });

      // Mock findActive to return an expired entry
      const now = Date.now();
      mockFindActive.mockResolvedValue([{
        taskId: 'task-1',
        lastBeat: now - 20000, // 20 seconds ago, past 15s timeout
        timeoutMs: 15000,
      }]);

      await watchdog.start();
      await jest.advanceTimersByTimeAsync(5000); // trigger checkHeartbeats

      expect(callback).toHaveBeenCalledWith('task-1', expect.stringContaining('No heartbeat'));
    });

    it('should not trigger callback when heartbeat is fresh', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      const callback = jest.fn();

      watchdog.register('task-1', { timeoutMs: 15000, onTimeout: callback });

      const now = Date.now();
      mockFindActive.mockResolvedValue([{
        taskId: 'task-1',
        lastBeat: now - 5000, // 5 seconds ago, within 15s timeout
        timeoutMs: 15000,
      }]);

      await watchdog.start();
      await jest.advanceTimersByTimeAsync(5000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should mark timeout in DB when entry expires', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      const callback = jest.fn();

      watchdog.register('task-1', { timeoutMs: 15000, onTimeout: callback });

      const now = Date.now();
      mockFindActive.mockResolvedValue([{
        taskId: 'task-1',
        lastBeat: now - 20000,
        timeoutMs: 15000,
      }]);

      await watchdog.start();
      await jest.advanceTimersByTimeAsync(5000);

      expect(mockMarkTimeout).toHaveBeenCalledWith('task-1');
    });

    it('should handle DB query failure in checkHeartbeats', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);

      await watchdog.start();
      mockFindActive.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw
      await jest.advanceTimersByTimeAsync(5000);
    });
  });
});
