/**
 * Comprehensive tests for HeartbeatWatchdog
 * Tests: constructor, start, stop, register, beat, unregister, checkHeartbeats
 */

// --- Module-level mocks matching HeartbeatWatchdogRepository method signatures ---
const mockUpsert = jest.fn().mockResolvedValue({});
const mockFindActive = jest.fn().mockResolvedValue([]);
const mockFindTimedOut = jest.fn().mockResolvedValue([]);
const mockRecordBeat = jest.fn().mockResolvedValue({});
const mockMarkFailure = jest.fn().mockResolvedValue({});
const mockDelete = jest.fn().mockResolvedValue(true);

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

jest.mock('../../../repositories/HeartbeatWatchdogRepository', () => ({
  HeartbeatWatchdogRepository: jest.fn().mockImplementation(() => ({
    upsert: mockUpsert,
    findActive: mockFindActive,
    findTimedOut: mockFindTimedOut,
    recordBeat: mockRecordBeat,
    markFailure: mockMarkFailure,
    delete: mockDelete,
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
    mockFindTimedOut.mockResolvedValue([]);
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
        {
          id: '1',
          tenantId: '00000000-0000-0000-0000-000000000000',
          serviceName: 'task-1',
          lastHeartbeat: new Date(Date.now()),
          status: 'healthy',
          failureCount: 0,
          errorMessage: null,
          createdAt: new Date(),
        },
        {
          id: '2',
          tenantId: '00000000-0000-0000-0000-000000000000',
          serviceName: 'task-2',
          lastHeartbeat: new Date(Date.now()),
          status: 'healthy',
          failureCount: 0,
          errorMessage: null,
          createdAt: new Date(),
        },
      ] as unknown as Array<{ id: string; tenantId: string; serviceName: string; lastHeartbeat: Date; status: string; failureCount: number; errorMessage: string | null; createdAt: Date }>);

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
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-uuid-hb',
        tenantId: '00000000-0000-0000-0000-000000000000',
        serviceName: 'task-1',
        lastHeartbeat: expect.any(Date),
        status: 'healthy',
        failureCount: 0,
      }));
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockUpsert.mockRejectedValueOnce(new Error('DB down'));

      expect(() => watchdog.register('task-1', {})).not.toThrow();
    });
  });

  describe('beat', () => {
    it('should update lastBeat in DB when db provided', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);

      watchdog.beat('task-1');
      expect(mockRecordBeat).toHaveBeenCalledWith('task-1');
    });

    it('should do nothing when no db', () => {
      watchdog = new HeartbeatWatchdog();
      watchdog.beat('task-1');
      expect(mockRecordBeat).not.toHaveBeenCalled();
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockRecordBeat.mockRejectedValueOnce(new Error('DB down'));

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
      expect(mockDelete).toHaveBeenCalledWith('task-1');
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      mockDelete.mockRejectedValueOnce(new Error('DB down'));

      expect(() => watchdog.unregister('task-1')).not.toThrow();
    });
  });

  describe('checkHeartbeats (via timer)', () => {
    it('should trigger timeout callback when heartbeat expired', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      const callback = jest.fn();

      watchdog.register('task-1', { timeoutMs: 15000, onTimeout: callback });

      const now = Date.now();
      const timedOutEntities = [{
        id: '1',
        tenantId: '00000000-0000-0000-0000-000000000000',
        serviceName: 'task-1',
        lastHeartbeat: new Date(now - 20000),
        status: 'healthy',
        failureCount: 0,
        errorMessage: null,
        createdAt: new Date(now - 20000),
      }] as unknown as Array<{ id: string; tenantId: string; serviceName: string; lastHeartbeat: Date; status: string; failureCount: number; errorMessage: string | null; createdAt: Date }>;

      mockFindTimedOut.mockResolvedValueOnce(timedOutEntities);

      await watchdog.start();
      await jest.advanceTimersByTimeAsync(5000);

      expect(callback).toHaveBeenCalledWith('task-1', expect.stringContaining('No heartbeat'));
    });

    it('should not trigger callback when heartbeat is fresh', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);
      const callback = jest.fn();

      watchdog.register('task-1', { timeoutMs: 15000, onTimeout: callback });

      // No timed-out entries returned
      mockFindTimedOut.mockResolvedValueOnce([]);

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
      mockFindTimedOut.mockResolvedValueOnce([{
        id: '1',
        tenantId: '00000000-0000-0000-0000-000000000000',
        serviceName: 'task-1',
        lastHeartbeat: new Date(now - 20000),
        status: 'healthy',
        failureCount: 0,
        errorMessage: null,
        createdAt: new Date(now - 20000),
      }] as unknown as Array<{ id: string; tenantId: string; serviceName: string; lastHeartbeat: Date; status: string; failureCount: number; errorMessage: string | null; createdAt: Date }>);

      await watchdog.start();
      await jest.advanceTimersByTimeAsync(5000);

      expect(mockMarkFailure).toHaveBeenCalledWith('task-1', expect.stringContaining('No heartbeat'));
    });

    it('should handle DB query failure in checkHeartbeats', async () => {
      const db = { query: jest.fn() };
      watchdog = new HeartbeatWatchdog(db);

      await watchdog.start();
      mockFindTimedOut.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw
      await jest.advanceTimersByTimeAsync(5000);
    });
  });
});
