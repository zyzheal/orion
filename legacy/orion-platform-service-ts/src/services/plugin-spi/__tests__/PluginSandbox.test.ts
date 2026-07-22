/**
 * Plugin Sandbox SPI Tests
 *
 * Tests for the isolated plugin execution environment:
 * - Resource limit enforcement
 * - Timeout management
 * - Execution cancellation
 * - Health metrics tracking
 */

import { PluginSandboxSPI } from '../PluginSandbox';

describe('PluginSandboxSPI', () => {
  let sandbox: PluginSandboxSPI;

  beforeEach(() => {
    sandbox = new PluginSandboxSPI({
      timeout: 5000,
      memoryLimit: 1024 * 1024 * 1024,
      cpuCores: 2,
      maxConcurrent: 5,
    });
  });

  afterEach(() => {
    sandbox.shutdown();
  });

  describe('execute', () => {
    it('should execute a function successfully', async () => {
      const result = await sandbox.execute('test-plugin', async () => {
        return { value: 42 };
      });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ value: 42 });
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should pass abort signal to the function', async () => {
      let receivedSignal: AbortSignal | undefined;

      await sandbox.execute('test-plugin', async (signal) => {
        receivedSignal = signal;
        return { ok: true };
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should return error result when function throws', async () => {
      const result = await sandbox.execute('test-plugin', async () => {
        throw new Error('Test error');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.exitCode).toBe(1);
    });

    it('should handle timeout', async () => {
      const shortSandbox = new PluginSandboxSPI({
        timeout: 50,
        maxConcurrent: 5,
        memoryLimit: 1024 * 1024 * 1024,
        cpuCores: 1,
      });

      const result = await shortSandbox.execute('test-plugin', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { ok: true };
      });

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('TIMEOUT');
      expect(result.exitCode).toBe(124);

      shortSandbox.shutdown();
    });

    it('should respect custom timeout override', async () => {
      const result = await sandbox.execute(
        'test-plugin',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { ok: true };
        },
        { timeout: 100 }
      );

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('TIMEOUT');
    });

    it('should track execution history', async () => {
      await sandbox.execute('test-plugin', async () => ({ ok: true }));
      await sandbox.execute('test-plugin', async () => {
        throw new Error('fail');
      });

      const health = sandbox.getPluginHealth('test-plugin');
      expect(health.totalExecutions).toBe(2);
      expect(health.successCount).toBe(1);
      expect(health.failureCount).toBe(1);
    });
  });

  describe('executeWithTimeout', () => {
    it('should execute with explicit timeout', async () => {
      const result = await sandbox.executeWithTimeout(
        'test-plugin',
        async () => ({ ok: true }),
        1000
      );

      expect(result.success).toBe(true);
    });

    it('should timeout with short timeout', async () => {
      const result = await sandbox.executeWithTimeout(
        'test-plugin',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return { ok: true };
        },
        50
      );

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
    });
  });

  describe('cancelExecution', () => {
    it('should cancel a running execution', async () => {
      let cancelled = false;

      const promise = sandbox.execute('test-plugin', async (signal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ ok: true }), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            cancelled = true;
            reject(new Error('Cancelled'));
          });
        });
      });

      // Wait a bit then cancel
      await new Promise((r) => setTimeout(r, 10));
      const result = sandbox.cancelExecution('test-plugin', 'Test cancellation');

      expect(result).toBe(true);

      try {
        await promise;
      } catch {
        // expected
      }

      expect(cancelled).toBe(true);
    });

    it('should return false for non-existent execution', () => {
      const result = sandbox.cancelExecution('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAllExecutions', () => {
    it('should cancel all running executions', async () => {
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 3; i++) {
        const promise = sandbox.execute(`plugin-${i}`, async (signal) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ ok: true }), 5000);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Cancelled'));
            });
          });
        });
        promises.push(promise);
      }

      // Cancel all
      const count = sandbox.cancelAllExecutions('Test');
      expect(count).toBe(3);

      // Wait for all promises to settle
      await Promise.allSettled(promises);
    });
  });

  describe('getActiveExecutionCount', () => {
    it('should return 0 when no executions', () => {
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });

    it('should return count for specific plugin', async () => {
      // Start both executions concurrently (don't await individually)
      const promises = [
        sandbox.execute('plugin-a', async (signal) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ ok: true }), 2000);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Cancelled'));
            });
          });
        }),
        sandbox.execute('plugin-a', async (signal) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ ok: true }), 2000);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Cancelled'));
            });
          });
        }),
      ];

      // Give the executions a moment to start
      await new Promise((r) => setTimeout(r, 10));

      expect(sandbox.getActiveExecutionCount('plugin-a')).toBe(2);
      expect(sandbox.getActiveExecutionCount('plugin-b')).toBe(0);

      sandbox.cancelAllExecutions();
      await Promise.allSettled(promises);
    });
  });

  describe('getPluginHealth', () => {
    it('should return health metrics', async () => {
      await sandbox.execute('test-plugin', async () => ({ ok: true }));
      await sandbox.execute('test-plugin', async () => ({ ok: true }));
      await sandbox.execute('test-plugin', async () => {
        throw new Error('fail');
      });

      const health = sandbox.getPluginHealth('test-plugin');

      expect(health.pluginId).toBe('test-plugin');
      expect(health.totalExecutions).toBe(3);
      expect(health.successCount).toBe(2);
      expect(health.failureCount).toBe(1);
      expect(health.successRate).toBeCloseTo(2 / 3, 1);
      expect(health.failureCount).toBe(1);
      expect(health.avgDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return not found for unknown plugin', () => {
      const health = sandbox.getPluginHealth('unknown');
      expect(health.pluginId).toBe('unknown');
      expect(health.totalExecutions).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update sandbox configuration', () => {
      sandbox.updateConfig({ timeout: 30000 });
      const config = sandbox.getConfig();
      expect(config.timeout).toBe(30000);
    });

    it('should merge with existing config', () => {
      sandbox.updateConfig({ cpuCores: 4 });
      const config = sandbox.getConfig();
      expect(config.cpuCores).toBe(4);
      expect(config.timeout).toBe(5000); // Original value preserved
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = sandbox.getConfig();
      expect(config.timeout).toBe(5000);
      expect(config.maxConcurrent).toBe(5);
    });

    it('should return a copy (immutable)', () => {
      const config = sandbox.getConfig();
      (config as any).timeout = 99999;
      expect(sandbox.getConfig().timeout).toBe(5000);
    });
  });

  describe('enforceLimits', () => {
    it('should reject when max concurrent is reached', async () => {
      const limitedSandbox = new PluginSandboxSPI({
        timeout: 10000,
        maxConcurrent: 2,
        memoryLimit: 1024 * 1024 * 1024,
        cpuCores: 1,
      });

      // Start 2 executions concurrently
      const runningPromises = [
        limitedSandbox.execute('plugin-a', async (signal) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ ok: true }), 5000);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Cancelled'));
            });
          });
        }),
        limitedSandbox.execute('plugin-a', async (signal) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ ok: true }), 5000);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Cancelled'));
            });
          });
        }),
      ];

      // Wait a moment for executions to start
      await new Promise((r) => setTimeout(r, 10));

      // The 3rd execution should be rejected due to max concurrent
      const result = await limitedSandbox.execute('plugin-a', async () => ({ ok: true }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum concurrent executions');

      limitedSandbox.cancelAllExecutions();
      await Promise.allSettled(runningPromises);
      limitedSandbox.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should cancel all executions', async () => {
      const promise = sandbox.execute('test-plugin', async (signal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ ok: true }), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Cancelled'));
          });
        });
      });

      sandbox.shutdown();

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });
  });
});
