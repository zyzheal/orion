/**
 * PluginSandbox - Comprehensive Unit Tests
 *
 * Covers: validateInput, detectSensitiveOutput, executeInSandbox (success, timeout, error, cancel),
 * cancelExecution, cancelAllExecutions, getActiveExecutionCount, getActiveExecutions, shutdown,
 * input validation rules (size, type, format, custom), command injection detection,
 * path traversal detection, environment variable validation, convertResultToOutputs.
 */

import { PluginSandbox, SandboxConfig } from '../PluginSandbox';
import { PluginResourceManager } from '../PluginResourceManager';
import { PluginAuditLogger } from '../PluginAuditLogger';
import type { ExecutionContext } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createSandbox(config?: Partial<SandboxConfig>) {
  const resourceManager = new PluginResourceManager();
  const auditLogger = new PluginAuditLogger();
  return new PluginSandbox({
    resourceManager,
    auditLogger,
    config,
  });
}

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    taskId: 'task-1',
    pluginId: 'plugin-1',
    tenantId: 'tenant-1',
    quota: {
      cpuCores: 2,
      memoryBytes: 512 * 1024 * 1024,
      timeoutMs: 60000,
      maxConcurrent: 10,
    },
    ...overrides,
  } as ExecutionContext;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(async () => {
    await sandbox.shutdown();
    sandbox.removeAllListeners();
  });

  // =========================================================================
  // validateInput
  // =========================================================================

  describe('validateInput', () => {
    it('should pass valid input', () => {
      const result = sandbox.validateInput({ data: 'hello' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when input exceeds max size', () => {
      const largeInput = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB
      const result = sandbox.validateInput(largeInput);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('maximum size');
    });

    it('should pass when input validation is disabled', () => {
      const noValidationSandbox = createSandbox({ enableInputValidation: false });
      const largeInput = 'x'.repeat(11 * 1024 * 1024);
      const result = noValidationSandbox.validateInput(largeInput);
      expect(result.valid).toBe(true);
    });

    it('should detect dangerous command patterns - semicolon', () => {
      const result = sandbox.validateInput({ command: 'ls; rm -rf /' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'command')).toBe(true);
    });

    it('should detect dangerous command patterns - pipe', () => {
      const result = sandbox.validateInput({ cmd: 'cat /etc/passwd | grep root' });
      expect(result.valid).toBe(false);
    });

    it('should detect dangerous command patterns - sudo', () => {
      const result = sandbox.validateInput({ command: 'sudo rm -rf /' });
      expect(result.valid).toBe(false);
    });

    it('should detect dangerous command patterns - backtick', () => {
      const result = sandbox.validateInput({ command: 'echo `whoami`' });
      expect(result.valid).toBe(false);
    });

    it('should detect dangerous command patterns - command substitution', () => {
      const result = sandbox.validateInput({ command: 'echo $(whoami)' });
      expect(result.valid).toBe(false);
    });

    it('should pass safe command', () => {
      const result = sandbox.validateInput({ command: 'ls -la' });
      expect(result.valid).toBe(true);
    });

    it('should detect path traversal', () => {
      const result = sandbox.validateInput({ path: '../../../etc/passwd' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'path')).toBe(true);
    });

    it('should detect /etc/ path', () => {
      const result = sandbox.validateInput({ filePath: '/etc/shadow' });
      expect(result.valid).toBe(false);
    });

    it('should detect /root/ path', () => {
      const result = sandbox.validateInput({ path: '/root/.ssh/id_rsa' });
      expect(result.valid).toBe(false);
    });

    it('should detect null byte in path', () => {
      const result = sandbox.validateInput({ path: '/tmp/file\0.txt' });
      expect(result.valid).toBe(false);
    });

    it('should pass safe path', () => {
      const result = sandbox.validateInput({ path: '/tmp/safe/file.txt' });
      expect(result.valid).toBe(true);
    });

    it('should detect dangerous environment variables - PATH', () => {
      const result = sandbox.validateInput({ env: { PATH: '/malicious' } });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'env.PATH')).toBe(true);
    });

    it('should detect dangerous environment variables - LD_PRELOAD', () => {
      const result = sandbox.validateInput({ env: { LD_PRELOAD: '/evil.so' } });
      expect(result.valid).toBe(false);
    });

    it('should detect dangerous environment variables - SUDO_USER', () => {
      const result = sandbox.validateInput({ env: { SUDO_USER: 'root' } });
      expect(result.valid).toBe(false);
    });

    it('should pass safe environment variables', () => {
      const result = sandbox.validateInput({ env: { MY_VAR: 'safe_value' } });
      expect(result.valid).toBe(true);
    });

    it('should validate custom rules - type check', () => {
      const result = sandbox.validateInput(
        { name: 123 },
        [{ type: 'type', field: 'name', constraint: 'string', message: 'Name must be string' }],
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Name must be string');
    });

    it('should validate custom rules - format check', () => {
      const result = sandbox.validateInput(
        { email: 'not-an-email' },
        [{ type: 'format', field: 'email', constraint: { pattern: '^.+@.+$' }, message: 'Invalid email' }],
      );
      expect(result.valid).toBe(false);
    });

    it('should validate custom rules - custom validator', () => {
      const result = sandbox.validateInput(
        { value: -1 },
        [{
          type: 'custom',
          constraint: (input: any) => ({ valid: input.value >= 0, field: 'value', message: 'Must be positive' }),
          message: 'Must be positive',
        }],
      );
      expect(result.valid).toBe(false);
    });

    it('should pass when custom validator returns valid', () => {
      const result = sandbox.validateInput(
        { value: 5 },
        [{
          type: 'custom',
          constraint: (input: any) => ({ valid: input.value >= 0 }),
          message: 'Must be positive',
        }],
      );
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // detectSensitiveOutput
  // =========================================================================

  describe('detectSensitiveOutput', () => {
    it('should return no sensitive data for safe output', () => {
      const result = sandbox.detectSensitiveOutput({ data: 'safe output' });
      expect(result.hasSensitiveData).toBe(false);
    });

    it('should handle string output', () => {
      const result = sandbox.detectSensitiveOutput('safe string');
      expect(result.hasSensitiveData).toBe(false);
    });

    it('should handle number output', () => {
      const result = sandbox.detectSensitiveOutput(42);
      expect(result.hasSensitiveData).toBe(false);
    });

    it('should skip detection when DLP is disabled', () => {
      const noDLPSandbox = createSandbox({ enableOutputDLPSanitization: false });
      const result = noDLPSandbox.detectSensitiveOutput('anything');
      expect(result.hasSensitiveData).toBe(false);
    });
  });

  // =========================================================================
  // executeInSandbox
  // =========================================================================

  describe('executeInSandbox', () => {
    it('should execute function successfully', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue('result');

      const result = await sandbox.executeInSandbox(context, fn);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-1');
      expect(result.exitCode).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(fn).toHaveBeenCalled();
    });

    it('should return outputs for string result', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue('hello');

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.outputs).toEqual({ result: 'hello' });
    });

    it('should return outputs for object result', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue({ key: 'value', num: 42 });

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.outputs).toBeDefined();
      expect(result.outputs!.key).toBe('value');
      expect(result.outputs!.num).toBe('42');
    });

    it('should return undefined outputs for null result', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue(null);

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.outputs).toBeUndefined();
    });

    it('should handle timeout', async () => {
      const context = makeContext();
      // Function that never resolves
      const fn = jest.fn().mockImplementation(() => new Promise(() => {}));

      const result = await sandbox.executeInSandbox(context, fn, { timeout: 50 });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('TIMEOUT');
      expect(result.errorMessage).toContain('timeout');
    }, 10000);

    it('should handle function error', async () => {
      const context = makeContext();
      const fn = jest.fn().mockRejectedValue(new Error('Execution failed'));

      const result = await sandbox.executeInSandbox(context, fn);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toBe('Execution failed');
    });

    it('should handle non-Error thrown value', async () => {
      const context = makeContext();
      const fn = jest.fn().mockRejectedValue('string error');

      const result = await sandbox.executeInSandbox(context, fn);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('string error');
    });

    it('should respect maxTimeoutMs cap', async () => {
      const cappedSandbox = createSandbox({ maxTimeoutMs: 100 });
      const context = makeContext();
      const fn = jest.fn().mockImplementation(() => new Promise(() => {}));

      const result = await cappedSandbox.executeInSandbox(context, fn, { timeout: 999999 });

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
    }, 10000);

    it('should use default timeout when not specified', async () => {
      const context = makeContext({ quota: { timeoutMs: 0 } as any });
      const fn = jest.fn().mockResolvedValue('ok');

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.success).toBe(true);
    });

    it('should emit execution:complete event on success', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue('done');
      const eventHandler = jest.fn();

      sandbox.on('execution:complete', eventHandler);
      await sandbox.executeInSandbox(context, fn);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1' }),
      );
    });

    it('should emit execution:error event on error', async () => {
      const context = makeContext();
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      const eventHandler = jest.fn();

      sandbox.on('execution:error', eventHandler);
      await sandbox.executeInSandbox(context, fn);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', error: 'fail' }),
      );
    });

    it('should emit execution:timeout event on timeout', async () => {
      const context = makeContext();
      const fn = jest.fn().mockImplementation(() => new Promise(() => {}));
      const eventHandler = jest.fn();

      sandbox.on('execution:timeout', eventHandler);
      await sandbox.executeInSandbox(context, fn, { timeout: 50 });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1' }),
      );
    }, 10000);

    it('should not start resource monitoring when disabled', async () => {
      const noMonitorSandbox = createSandbox({ enableResourceMonitoring: false });
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue('ok');

      const result = await noMonitorSandbox.executeInSandbox(context, fn);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // cancelExecution
  // =========================================================================

  describe('cancelExecution', () => {
    it('should return false when no execution found', () => {
      const result = sandbox.cancelExecution('nonexistent');
      expect(result).toBe(false);
    });

    it('should cancel a running execution', async () => {
      const longSandbox = createSandbox({ defaultTimeoutMs: 30000 });
      const context = makeContext();

      // Use a function that respects the AbortSignal
      const fn = jest.fn().mockImplementation(
        (signal: AbortSignal) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve('done'), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        }),
      );

      // Start execution in background
      const execPromise = longSandbox.executeInSandbox(context, fn);

      // Wait for execution to be tracked
      await new Promise(r => setTimeout(r, 50));

      expect(longSandbox.getActiveExecutionCount()).toBe(1);

      const cancelled = longSandbox.cancelExecution('task-1', 'Test cancellation');
      expect(cancelled).toBe(true);

      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('CANCELLED');

      await longSandbox.shutdown();
    }, 15000);

    it('should emit execution:cancelled event', async () => {
      const longSandbox = createSandbox({ defaultTimeoutMs: 30000 });
      const context = makeContext();

      const fn = jest.fn().mockImplementation(
        (signal: AbortSignal) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve('done'), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        }),
      );

      const eventHandler = jest.fn();
      longSandbox.on('execution:cancelled', eventHandler);

      const execPromise = longSandbox.executeInSandbox(context, fn);
      await new Promise(r => setTimeout(r, 50));

      longSandbox.cancelExecution('task-1', 'User request');
      await execPromise;

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', reason: 'User request' }),
      );

      await longSandbox.shutdown();
    }, 15000);
  });

  // =========================================================================
  // cancelAllExecutions
  // =========================================================================

  describe('cancelAllExecutions', () => {
    it('should return 0 when no active executions', async () => {
      const count = await sandbox.cancelAllExecutions();
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // getActiveExecutionCount / getActiveExecutions
  // =========================================================================

  describe('getActiveExecutionCount', () => {
    it('should return 0 initially', () => {
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });
  });

  describe('getActiveExecutions', () => {
    it('should return empty array initially', () => {
      expect(sandbox.getActiveExecutions()).toEqual([]);
    });
  });

  // =========================================================================
  // shutdown
  // =========================================================================

  describe('shutdown', () => {
    it('should cancel all executions and complete', async () => {
      await sandbox.shutdown();
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });
  });

  // =========================================================================
  // convertResultToOutputs (private, tested via executeInSandbox)
  // =========================================================================

  describe('convertResultToOutputs', () => {
    it('should handle number result', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue(42);

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.outputs).toEqual({ result: '42' });
    });

    it('should handle object with nested non-string values', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue({ arr: [1, 2], nested: { a: 1 } });

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.outputs!.arr).toBe('[1,2]');
      expect(result.outputs!.nested).toBe('{"a":1}');
    });

    it('should handle undefined result', async () => {
      const context = makeContext();
      const fn = jest.fn().mockResolvedValue(undefined);

      const result = await sandbox.executeInSandbox(context, fn);
      expect(result.outputs).toBeUndefined();
    });
  });
});
