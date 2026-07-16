/**
 * AgentSandbox Tests - Worker Thread sandbox isolation
 *
 * Covers: constructor config, execute lifecycle, timeout, worker errors,
 * worker exit codes, active worker tracking, shutdown.
 */

import { EventEmitter } from 'events';

// Mock worker_threads before importing AgentSandbox
const mockWorkerInstances: any[] = [];
let mockWorkerClass: jest.Mock;

jest.mock('worker_threads', () => {
  mockWorkerClass = jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    emitter.terminate = jest.fn().mockResolvedValue(undefined);
    emitter.postMessage = jest.fn();
    mockWorkerInstances.push(emitter);
    return emitter;
  });
  return { Worker: mockWorkerClass };
});

let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `test-uuid-${++uuidCounter}`),
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

import { AgentSandbox, SandboxTask, SandboxConfig } from '../AgentSandbox';

describe('AgentSandbox', () => {
  let sandbox: AgentSandbox;

  beforeEach(() => {
    jest.clearAllMocks();
    uuidCounter = 0;
    mockWorkerInstances.length = 0;
    sandbox = new AgentSandbox();
  });

  afterEach(async () => {
    // Force-resolve any pending execute promises to prevent leaks.
    // Note: exit(0) does NOT resolve execute promises (only non-zero does),
    // so we emit 'message' with success to resolve them.
    mockWorkerInstances.forEach((w, i) => {
      try {
        w.emit('message', { taskId: `cleanup-${i}`, success: true, output: {}, durationMs: 0 });
      } catch { /* ignore */ }
    });
    await sandbox.shutdown();
  });

  const makeTask = (overrides?: Partial<SandboxTask>): Omit<SandboxTask, 'id'> => ({
    action: 'read_file',
    input: { filePath: '/tmp/test.ts' },
    profile: {
      allowedTools: ['read_file', 'run_command'],
      maxExecutionTimeMs: 5000,
      memoryLimitMB: 256,
    },
    ...overrides,
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const s = new AgentSandbox();
      expect(s.getActiveWorkerCount()).toBe(0);
    });

    it('should merge custom config with defaults', () => {
      const s = new AgentSandbox({ memoryLimitMB: 1024 });
      expect(s.getActiveWorkerCount()).toBe(0);
    });

    it('should accept all custom config options', () => {
      const config: SandboxConfig = {
        memoryLimitMB: 256,
        defaultTimeoutMs: 10000,
        idleTimeoutMs: 30000,
      };
      const s = new AgentSandbox(config);
      expect(s.getActiveWorkerCount()).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute a task successfully via worker message', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      worker.emit('message', {
        taskId: 'test-uuid-1',
        success: true,
        output: { content: 'file contents' },
        durationMs: 100,
      });

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ content: 'file contents' });
      expect(result.taskId).toBe('test-uuid-1');
    });

    it('should post task to worker with generated id', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-1',
          action: 'read_file',
          input: { filePath: '/tmp/test.ts' },
        }),
      );

      worker.emit('message', {
        taskId: 'test-uuid-1',
        success: true,
        output: {},
        durationMs: 10,
      });
      await resultPromise;
    });

    it('should track active workers during execution', async () => {
      expect(sandbox.getActiveWorkerCount()).toBe(0);

      const resultPromise = sandbox.execute(makeTask());
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      const worker = mockWorkerInstances[0];
      worker.emit('message', {
        taskId: 'test-uuid-1',
        success: true,
        output: {},
        durationMs: 10,
      });
      await resultPromise;

      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should set resource limits on the worker', async () => {
      const resultPromise = sandbox.execute(makeTask({
        profile: { allowedTools: ['read_file'], maxExecutionTimeMs: 5000, memoryLimitMB: 512 },
      }));

      expect(mockWorkerClass).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          resourceLimits: expect.objectContaining({
            maxOldGenerationSizeMb: 512,
            maxYoungGenerationSizeMb: 64,
            stackSizeMb: 8,
          }),
        }),
      );

      const worker = mockWorkerInstances[0];
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 10 });
      await resultPromise;
    });

    it('should fall back to default memory limit when profile memoryLimitMB is falsy', async () => {
      const resultPromise = sandbox.execute(makeTask({
        profile: { allowedTools: ['read_file'], maxExecutionTimeMs: 5000, memoryLimitMB: 0 },
      }));

      expect(mockWorkerClass).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          resourceLimits: expect.objectContaining({
            maxOldGenerationSizeMb: 512, // default
          }),
        }),
      );

      const worker = mockWorkerInstances[0];
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 10 });
      await resultPromise;
    });

    it('should handle worker error event', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      worker.emit('error', new Error('Worker crashed'));

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker crashed');
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should handle worker exit with non-zero code', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      worker.emit('exit', 1);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker exited with code 1');
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should not resolve twice when worker sends message then exits with non-zero', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: { ok: true }, durationMs: 10 });
      worker.emit('exit', 1);

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ ok: true });
    });

    it('should handle worker error after message (settled guard)', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 10 });
      worker.emit('error', new Error('late error'));

      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    it('should use default timeout when profile maxExecutionTimeMs is 0', async () => {
      const resultPromise = sandbox.execute(makeTask({
        profile: { allowedTools: ['read_file'], maxExecutionTimeMs: 0, memoryLimitMB: 256 },
      }));

      const worker = mockWorkerInstances[0];
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 10 });
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    it('should terminate worker on timeout', async () => {
      jest.useFakeTimers();

      const resultPromise = sandbox.execute(makeTask({
        profile: { allowedTools: ['read_file'], maxExecutionTimeMs: 100, memoryLimitMB: 256 },
      }));

      jest.advanceTimersByTime(150);

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('execution timeout');
      expect(sandbox.getActiveWorkerCount()).toBe(0);

      const worker = mockWorkerInstances[0];
      expect(worker.terminate).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not double-resolve on timeout after message', async () => {
      jest.useFakeTimers();

      const resultPromise = sandbox.execute(makeTask({
        profile: { allowedTools: ['read_file'], maxExecutionTimeMs: 100, memoryLimitMB: 256 },
      }));

      const worker = mockWorkerInstances[0];
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: { data: 'ok' }, durationMs: 10 });
      jest.advanceTimersByTime(150);

      const result = await resultPromise;
      expect(result.success).toBe(true);

      jest.useRealTimers();
    });

    it('should handle multiple concurrent tasks with unique ids', async () => {
      const promise1 = sandbox.execute(makeTask({ action: 'read_file' }));
      const promise2 = sandbox.execute(makeTask({ action: 'run_command' }));

      expect(sandbox.getActiveWorkerCount()).toBe(2);

      const worker1 = mockWorkerInstances[0];
      const worker2 = mockWorkerInstances[1];

      worker1.emit('message', { taskId: 'test-uuid-1', success: true, output: { file: true }, durationMs: 10 });
      worker2.emit('message', { taskId: 'test-uuid-2', success: true, output: { cmd: true }, durationMs: 20 });

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1.taskId).toBe('test-uuid-1');
      expect(result2.taskId).toBe('test-uuid-2');
      expect(result1.output).toEqual({ file: true });
      expect(result2.output).toEqual({ cmd: true });
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should clean up active workers on error', async () => {
      const resultPromise = sandbox.execute(makeTask());
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      const worker = mockWorkerInstances[0];
      worker.emit('error', new Error('boom'));

      await resultPromise;
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should clean up active workers on exit with non-zero code', async () => {
      const resultPromise = sandbox.execute(makeTask());
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      const worker = mockWorkerInstances[0];
      worker.emit('exit', 137);

      await resultPromise;
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should not handle exit with code 0 as error', async () => {
      const resultPromise = sandbox.execute(makeTask());

      const worker = mockWorkerInstances[0];
      // Exit code 0 after the worker has already sent a message via 'message' event
      // should not trigger the exit handler since settled=true
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: { done: true }, durationMs: 5 });
      worker.emit('exit', 0);

      const result = await resultPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('getActiveWorkerCount', () => {
    it('should return 0 when no workers are active', () => {
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });

    it('should reflect count as workers start and finish', async () => {
      const p1 = sandbox.execute(makeTask());
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      const p2 = sandbox.execute(makeTask());
      expect(sandbox.getActiveWorkerCount()).toBe(2);

      // Finish first worker
      mockWorkerInstances[0].emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 10 });
      await p1;
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      // Finish second worker
      mockWorkerInstances[1].emit('message', { taskId: 'test-uuid-2', success: true, output: {}, durationMs: 10 });
      await p2;
      expect(sandbox.getActiveWorkerCount()).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should call terminate on each active worker and clear the map', async () => {
      const p1 = sandbox.execute(makeTask());
      const worker = mockWorkerInstances[0];
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      // Emit message to resolve the execute promise (exit(0) does NOT resolve)
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 10 });
      await p1;

      // Now start a fresh task to test shutdown
      const p2 = sandbox.execute(makeTask());
      const worker2 = mockWorkerInstances[1];
      expect(sandbox.getActiveWorkerCount()).toBe(1);

      // Shutdown while task is active
      await sandbox.shutdown();
      expect(sandbox.getActiveWorkerCount()).toBe(0);
      expect(worker2.terminate).toHaveBeenCalled();

      // Clean up dangling promise (after shutdown, map is cleared, so emit doesn't help;
      // but afterEach will also try via mockWorkerInstances)
      worker2.emit('message', { taskId: 'test-uuid-2', success: true, output: {}, durationMs: 0 });
      await Promise.allSettled([p2]);
    });

    it('should handle shutdown with no active workers', async () => {
      await expect(sandbox.shutdown()).resolves.toBeUndefined();
    });

    it('should be safe to call multiple times', async () => {
      await sandbox.shutdown();
      await expect(sandbox.shutdown()).resolves.toBeUndefined();
    });

    it('should terminate workers with custom config', async () => {
      const customSandbox = new AgentSandbox({ memoryLimitMB: 1024, defaultTimeoutMs: 1000 });
      const p1 = customSandbox.execute(makeTask());
      const worker = mockWorkerInstances[0];

      expect(customSandbox.getActiveWorkerCount()).toBe(1);

      await customSandbox.shutdown();
      expect(worker.terminate).toHaveBeenCalled();
      expect(customSandbox.getActiveWorkerCount()).toBe(0);

      // Clean up dangling promise
      worker.emit('message', { taskId: 'test-uuid-1', success: true, output: {}, durationMs: 0 });
      await Promise.allSettled([p1]);
    });
  });
});
