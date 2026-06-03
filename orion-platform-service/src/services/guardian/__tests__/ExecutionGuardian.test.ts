/**
 * Comprehensive tests for ExecutionGuardian
 * Tests: constructor, start, stop, registerTask, unregisterTask, heartbeat,
 *        abortTask, createAbortSignal, timeout behavior, event emission
 */

// --- Module-level mocks ---
const mockWatchdogStart = jest.fn().mockResolvedValue(undefined);
const mockWatchdogStop = jest.fn();
const mockWatchdogRegister = jest.fn();
const mockWatchdogUnregister = jest.fn();
const mockWatchdogBeat = jest.fn();

const mockKillerKill = jest.fn().mockResolvedValue(undefined);

const mockRepoCreate = jest.fn().mockResolvedValue({});
const mockRepoMarkCompleted = jest.fn().mockResolvedValue({});
const mockRepoMarkAborted = jest.fn().mockResolvedValue({});

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
  v4: jest.fn(() => 'test-uuid-eg'),
}));

jest.mock('../HeartbeatWatchdog', () => ({
  HeartbeatWatchdog: jest.fn().mockImplementation(() => ({
    start: mockWatchdogStart,
    stop: mockWatchdogStop,
    register: mockWatchdogRegister,
    unregister: mockWatchdogUnregister,
    beat: mockWatchdogBeat,
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  })),
}));

jest.mock('../ProcessKiller', () => ({
  ProcessKiller: jest.fn().mockImplementation(() => ({
    kill: mockKillerKill,
    register: jest.fn(),
    unregister: jest.fn(),
  })),
}));

jest.mock('../../../repositories/GuardianTaskRepository', () => ({
  GuardianTaskRepository: jest.fn().mockImplementation(() => ({
    create: mockRepoCreate,
    markCompleted: mockRepoMarkCompleted,
    markAborted: mockRepoMarkAborted,
  })),
}));

// --- Tests ---
import { ExecutionGuardian, DEFAULT_GUARDIAN_CONFIG } from '../ExecutionGuardian';

describe('ExecutionGuardian', () => {
  let guardian: ExecutionGuardian;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockKillerKill.mockResolvedValue(undefined);
    mockRepoCreate.mockResolvedValue({});
    mockRepoMarkCompleted.mockResolvedValue({});
    mockRepoMarkAborted.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      guardian = new ExecutionGuardian();
      expect(guardian).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      guardian = new ExecutionGuardian({ globalTimeoutMs: 60000 });
      expect(guardian).toBeDefined();
    });

    it('should create repository when db provided', () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);
      guardian.registerTask('task-1');
      expect(mockRepoCreate).toHaveBeenCalled();
    });
  });

  describe('DEFAULT_GUARDIAN_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_GUARDIAN_CONFIG).toEqual({
        globalTimeoutMs: 30 * 60 * 1000,
        stepTimeoutMs: 5 * 60 * 1000,
        heartbeatIntervalMs: 5000,
        heartbeatTimeoutMs: 15000,
      });
    });
  });

  describe('start', () => {
    it('should start the heartbeat watchdog', () => {
      guardian = new ExecutionGuardian();
      guardian.start();
      expect(mockWatchdogStart).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the heartbeat watchdog', async () => {
      guardian = new ExecutionGuardian();
      guardian.start();
      await guardian.stop();
      expect(mockWatchdogStop).toHaveBeenCalled();
    });

    it('should abort all registered tasks on shutdown', async () => {
      guardian = new ExecutionGuardian();

      // Register two tasks
      guardian.registerTask('task-1');
      guardian.registerTask('task-2');

      // Mock kill to resolve immediately
      mockKillerKill.mockResolvedValue(undefined);

      await guardian.stop();

      expect(mockKillerKill).toHaveBeenCalledTimes(2);
      expect(mockKillerKill).toHaveBeenCalledWith('task-1', 'guardian_shutdown');
      expect(mockKillerKill).toHaveBeenCalledWith('task-2', 'guardian_shutdown');
    });

    it('should emit task:aborted for each task during shutdown', async () => {
      guardian = new ExecutionGuardian();
      const events: any[] = [];
      guardian.on('task:aborted', (data) => events.push(data));

      guardian.registerTask('task-1');
      await guardian.stop();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ taskId: 'task-1', reason: 'guardian_shutdown' });
    });
  });

  describe('registerTask', () => {
    beforeEach(() => {
      guardian = new ExecutionGuardian();
    });

    it('should register with default timeouts', () => {
      guardian.registerTask('task-1');
      // Verify no errors
    });

    it('should register with custom timeouts', () => {
      guardian.registerTask('task-1', { globalTimeoutMs: 60000, stepTimeoutMs: 10000 });
      // Verify no errors
    });

    it('should persist to DB when db provided', () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);

      guardian.registerTask('task-1');
      expect(mockRepoCreate).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'task-1',
        aborted: false,
        status: 'active',
      }));
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);
      mockRepoCreate.mockRejectedValueOnce(new Error('DB down'));

      expect(() => guardian.registerTask('task-1')).not.toThrow();
    });
  });

  describe('unregisterTask', () => {
    beforeEach(() => {
      guardian = new ExecutionGuardian();
    });

    it('should clear timers and unregister from heartbeat watchdog', () => {
      guardian.registerTask('task-1');
      guardian.unregisterTask('task-1');
      expect(mockWatchdogUnregister).toHaveBeenCalledWith('task-1');
    });

    it('should mark completed in DB when db provided', () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);

      guardian.registerTask('task-1');
      guardian.unregisterTask('task-1');
      expect(mockRepoMarkCompleted).toHaveBeenCalledWith('task-1');
    });

    it('should fire-and-forget DB errors', () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);
      mockRepoMarkCompleted.mockRejectedValueOnce(new Error('DB down'));

      guardian.registerTask('task-1');
      expect(() => guardian.unregisterTask('task-1')).not.toThrow();
    });

    it('should not throw for unknown task id', () => {
      guardian.unregisterTask('nonexistent-task');
      expect(mockWatchdogUnregister).toHaveBeenCalledWith('nonexistent-task');
    });

    it('should prevent timeout callbacks after unregister', () => {
      guardian = new ExecutionGuardian({ stepTimeoutMs: 1000 });
      const events: any[] = [];
      guardian.on('task:timeout', (data) => events.push(data));

      guardian.registerTask('task-1');
      guardian.unregisterTask('task-1');

      // Advance past step timeout
      jest.advanceTimersByTime(2000);

      expect(events).toHaveLength(0);
    });
  });

  describe('heartbeat', () => {
    beforeEach(() => {
      guardian = new ExecutionGuardian({ stepTimeoutMs: 2000 });
    });

    it('should delegate to heartbeat watchdog beat', () => {
      guardian.registerTask('task-1');
      guardian.heartbeat('task-1');
      expect(mockWatchdogBeat).toHaveBeenCalledWith('task-1');
    });

    it('should reset step timer on heartbeat', () => {
      const events: any[] = [];
      guardian.on('task:timeout', (data) => events.push(data));

      guardian.registerTask('task-1');

      // Advance halfway to step timeout
      jest.advanceTimersByTime(1500);

      // Send heartbeat - resets the step timer
      guardian.heartbeat('task-1');

      // Advance another 1500ms (total 3000ms from register, but only 1500ms from heartbeat)
      jest.advanceTimersByTime(1500);
      // Should NOT have timed out yet (step timer was reset)
      expect(events.filter(e => e.type === 'step')).toHaveLength(0);

      // Advance past the new step timeout
      jest.advanceTimersByTime(600);
      expect(events.filter(e => e.type === 'step')).toHaveLength(1);
    });

    it('should not reset step timer for aborted tasks', () => {
      guardian = new ExecutionGuardian({ stepTimeoutMs: 1000 });
      guardian.registerTask('task-1');

      // Abort the task
      guardian.abortTask('task-1', 'test');
      mockKillerKill.mockResolvedValue(undefined);

      // Heartbeat should not throw for aborted task
      guardian.heartbeat('task-1');
    });
  });

  describe('abortTask', () => {
    beforeEach(() => {
      guardian = new ExecutionGuardian();
    });

    it('should kill process via ProcessKiller', async () => {
      guardian.registerTask('task-1');
      await guardian.abortTask('task-1', 'timeout');

      expect(mockKillerKill).toHaveBeenCalledWith('task-1', 'timeout');
    });

    it('should emit task:aborted event', async () => {
      const events: any[] = [];
      guardian.on('task:aborted', (data) => events.push(data));

      guardian.registerTask('task-1');
      await guardian.abortTask('task-1', 'global_timeout');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ taskId: 'task-1', reason: 'global_timeout' });
    });

    it('should unregister from heartbeat watchdog', async () => {
      guardian.registerTask('task-1');
      await guardian.abortTask('task-1', 'test');

      expect(mockWatchdogUnregister).toHaveBeenCalledWith('task-1');
    });

    it('should mark aborted in DB when db provided', async () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);

      guardian.registerTask('task-1');
      await guardian.abortTask('task-1', 'timeout');

      expect(mockRepoMarkAborted).toHaveBeenCalledWith('task-1');
    });

    it('should be no-op for unknown task', async () => {
      await guardian.abortTask('unknown-task', 'test');
      expect(mockKillerKill).not.toHaveBeenCalled();
    });

    it('should clear timers to prevent further timeout events', async () => {
      const events: any[] = [];
      guardian.on('task:timeout', (data) => events.push(data));

      guardian.registerTask('task-1');
      await guardian.abortTask('task-1', 'test');

      // Advance past timeouts
      jest.advanceTimersByTime(100000);
      expect(events).toHaveLength(0);
    });

    it('should fire-and-forget DB errors', async () => {
      const db = { query: jest.fn() };
      guardian = new ExecutionGuardian({}, db);
      mockRepoMarkAborted.mockRejectedValueOnce(new Error('DB down'));

      guardian.registerTask('task-1');
      await guardian.abortTask('task-1', 'test');
      // Should not throw
    });
  });

  describe('createAbortSignal', () => {
    beforeEach(() => {
      guardian = new ExecutionGuardian();
    });

    it('should return an AbortController', () => {
      guardian.registerTask('task-1');
      const controller = guardian.createAbortSignal('task-1');
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });

    it('should not abort signal on guardian internal abort (listener removed first)', async () => {
      guardian.registerTask('task-1');
      const controller = guardian.createAbortSignal('task-1');

      // abortTask removes the listener via off() before emitting
      await guardian.abortTask('task-1', 'timeout');

      expect(controller.signal.aborted).toBe(false);
    });

    it('should abort signal on external task:aborted emission', () => {
      guardian.registerTask('task-1');
      const controller = guardian.createAbortSignal('task-1');

      // Directly emit the event (external abort, not through abortTask)
      guardian.emit('task:aborted', { taskId: 'task-1', reason: 'external_cancel' });

      expect(controller.signal.aborted).toBe(true);
    });

    it('should not abort signal for different task', () => {
      guardian.registerTask('task-1');
      guardian.registerTask('task-2');
      const controller1 = guardian.createAbortSignal('task-1');
      const controller2 = guardian.createAbortSignal('task-2');

      guardian.emit('task:aborted', { taskId: 'task-1', reason: 'cancel' });

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(false);
    });

    it('should not double-abort if signal already aborted', () => {
      guardian.registerTask('task-1');
      const controller = guardian.createAbortSignal('task-1');

      guardian.emit('task:aborted', { taskId: 'task-1', reason: 'first' });
      expect(controller.signal.aborted).toBe(true);

      // Second emit should not cause errors (once listener already consumed)
      guardian.emit('task:aborted', { taskId: 'task-1', reason: 'second' });
    });
  });

  describe('global timeout', () => {
    it('should emit task:timeout with type global and abort task', async () => {
      guardian = new ExecutionGuardian({ globalTimeoutMs: 5000, stepTimeoutMs: 100000 });
      const timeoutEvents: any[] = [];
      const abortedEvents: any[] = [];
      guardian.on('task:timeout', (data) => timeoutEvents.push(data));
      guardian.on('task:aborted', (data) => abortedEvents.push(data));

      guardian.registerTask('task-1');

      // Advance past global timeout
      await jest.advanceTimersByTimeAsync(5100);

      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0]).toEqual({ taskId: 'task-1', type: 'global' });
      expect(abortedEvents).toHaveLength(1);
      expect(abortedEvents[0].reason).toBe('global_timeout');
    });

    it('should use custom global timeout when provided', async () => {
      guardian = new ExecutionGuardian({ globalTimeoutMs: 100000, stepTimeoutMs: 100000 });
      const timeoutEvents: any[] = [];
      guardian.on('task:timeout', (data) => timeoutEvents.push(data));

      guardian.registerTask('task-1', { globalTimeoutMs: 3000 });

      await jest.advanceTimersByTimeAsync(3100);

      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0].type).toBe('global');
    });
  });

  describe('step timeout', () => {
    it('should emit task:timeout with type step and abort task', async () => {
      guardian = new ExecutionGuardian({ globalTimeoutMs: 100000, stepTimeoutMs: 3000 });
      const timeoutEvents: any[] = [];
      const abortedEvents: any[] = [];
      guardian.on('task:timeout', (data) => timeoutEvents.push(data));
      guardian.on('task:aborted', (data) => abortedEvents.push(data));

      guardian.registerTask('task-1');

      // Advance past step timeout
      await jest.advanceTimersByTimeAsync(3100);

      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0]).toEqual({ taskId: 'task-1', type: 'step' });
      expect(abortedEvents).toHaveLength(1);
      expect(abortedEvents[0].reason).toBe('step_timeout');
    });

    it('should use custom step timeout when provided', async () => {
      guardian = new ExecutionGuardian({ globalTimeoutMs: 100000, stepTimeoutMs: 100000 });
      const timeoutEvents: any[] = [];
      guardian.on('task:timeout', (data) => timeoutEvents.push(data));

      guardian.registerTask('task-1', { stepTimeoutMs: 2000 });

      await jest.advanceTimersByTimeAsync(2100);

      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0].type).toBe('step');
    });
  });

  describe('multiple tasks', () => {
    it('should handle multiple tasks independently', async () => {
      guardian = new ExecutionGuardian({ globalTimeoutMs: 100000, stepTimeoutMs: 5000 });
      const events: any[] = [];
      guardian.on('task:timeout', (data) => events.push(data));

      guardian.registerTask('task-1');
      guardian.registerTask('task-2');

      // Unregister task-1
      guardian.unregisterTask('task-1');

      // Advance past step timeout for task-2
      await jest.advanceTimersByTimeAsync(5100);

      // Only task-2 should timeout
      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('task-2');
    });
  });
});
