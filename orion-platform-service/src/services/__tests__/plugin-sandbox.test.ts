/**
 * Plugin Sandbox Tests
 */

import { PluginSandbox } from '../plugin/PluginSandbox';
import { PluginResourceManager } from '../plugin/PluginResourceManager';
import { PluginAuditLogger } from '../plugin/PluginAuditLogger';
import { ExecutionContext, DEFAULT_QUOTA } from '../plugin/types';

describe.skip('PluginSandbox', () => {
  let sandbox: PluginSandbox;
  let resourceManager: PluginResourceManager;
  let auditLogger: PluginAuditLogger;

  const createMockContext = (taskId: string = 'task-1', pluginId: string = 'plugin-1'): ExecutionContext => ({
    taskId,
    pluginId,
    pipelineRunId: 'pipeline-1',
    stageId: 'stage-1',
    startedAt: new Date(),
    quota: { ...DEFAULT_QUOTA }, // 使用副本避免修改影响其他测试
  });

  beforeEach(async () => {
    resourceManager = new PluginResourceManager();
    auditLogger = new PluginAuditLogger();
    sandbox = new PluginSandbox({
      resourceManager,
      auditLogger,
    });
  });

  afterEach(async () => {
    sandbox.shutdown();
    auditLogger.shutdown();
    resourceManager.releaseAll();
  });

  describe('Input Validation', () => {
    it('should validate normal input', async () => {
      const input = { param: 'value' };
      const result = sandbox.validateInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect command injection patterns', async () => {
      const input = { command: 'ls; rm -rf /' };
      const result = sandbox.validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect path traversal patterns', async () => {
      const input = { path: '../../../etc/passwd' };
      const result = sandbox.validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect dangerous environment variables', async () => {
      const input = { env: { PATH: '/malicious/path' } };
      const result = sandbox.validateInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'env.PATH')).toBe(true);
    });

    it('should reject large input', async () => {
      const largeInput = 'x'.repeat(20 * 1024 * 1024); // 20MB
      const result = sandbox.validateInput(largeInput);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('size limit'))).toBe(true);
    });
  });

  describe('Sandbox Execution', () => {
    it('should execute function successfully', async () => {
      const context = createMockContext();

      const result = await sandbox.executeInSandbox(context, async () => {
        return { output: 'success' };
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.outputs?.output).toBe('success');
    });

    it('should track active executions', async () => {
      const context = createMockContext('task-1');

      const executionPromise = sandbox.executeInSandbox(context, async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { result: 'done' };
      });

      // 检查活跃执行
      expect(sandbox.getActiveExecutionCount()).toBe(1);
      expect(sandbox.getActiveExecutions()).toContain('task-1');

      await executionPromise;

      // 执行完成后应该没有活跃执行
      expect(sandbox.getActiveExecutionCount()).toBe(0);
    });

    it('should enforce timeout', async () => {
      const context = createMockContext('task-timeout');
      context.quota.timeoutMs = 100; // 100ms timeout

      const result = await sandbox.executeInSandbox(context, async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { result: 'late' };
      });

      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
      expect(result.killReason).toBe('TIMEOUT');
      expect(result.exitCode).toBe(124);
    });

    it('should allow AbortSignal usage', async () => {
      const context = createMockContext();

      const result = await sandbox.executeInSandbox(context, async (signal) => {
        expect(signal).toBeDefined();
        expect(signal.aborted).toBe(false);
        return { result: 'success' };
      });

      expect(result.success).toBe(true);
    });

    it('should handle execution errors', async () => {
      const context = createMockContext();

      const result = await sandbox.executeInSandbox(context, async () => {
        throw new Error('Execution failed');
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toContain('Execution failed');
    });
  });

  describe('Execution Cancellation', () => {
    it('should cancel execution', async () => {
      const context = createMockContext('task-cancel');

      const executionPromise = sandbox.executeInSandbox(context, async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Aborted'));
          });
        });
        return { result: 'done' };
      });

      // 等一小会儿然后取消
      await new Promise(resolve => setTimeout(resolve, 50));
      const cancelled = sandbox.cancelExecution('task-cancel', 'Manual cancellation');

      expect(cancelled).toBe(true);

      const result = await executionPromise;
      expect(result.success).toBe(false);
      expect(result.killed).toBe(true);
    });

    it('should cancel all executions', async () => {
      const contexts = [
        createMockContext('task-1'),
        createMockContext('task-2'),
        createMockContext('task-3'),
      ];

      const promises = contexts.map(ctx =>
        sandbox.executeInSandbox(ctx, async (signal) => {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, 5000);
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Aborted'));
            });
          });
          return { result: 'done' };
        })
      );

      // 等待执行开始
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(sandbox.getActiveExecutionCount()).toBe(3);

      const count = sandbox.cancelAllExecutions('Bulk cancellation');
      expect(count).toBe(3);

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.killed).toBe(true);
      });
    });

    it('should return false when cancelling non-existent execution', async () => {
      const result = sandbox.cancelExecution('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('DLP Detection', () => {
    it('should detect sensitive output data', async () => {
      const context = createMockContext();

      const result = await sandbox.executeInSandbox(context, async () => {
        return { email: 'sensitive@example.com' };
      });

      expect(result.success).toBe(true);

      // 检查是否记录了安全事件
      const events = auditLogger.getSecurityEvents({
        taskId: context.taskId,
        type: 'SENSITIVE_DATA_DETECTED',
      });

      expect(events.length).toBe(1);
    });

    it('should detect credit card in output', async () => {
      const output = { cardNumber: '4111-1111-1111-1111' };
      const result = sandbox.detectSensitiveOutput(output);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns.some(p => p.type === 'CREDIT_CARD')).toBe(true);
    });
  });

  describe('Events', () => {
    it('should emit execution:complete event', async () => {
      const handler = jest.fn();
      sandbox.on('execution:complete', handler);

      const context = createMockContext();
      await sandbox.executeInSandbox(context, async () => ({ result: 'done' }));

      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution:timeout event', async () => {
      const handler = jest.fn();
      sandbox.on('execution:timeout', handler);

      const context = createMockContext('task-timeout');
      context.quota.timeoutMs = 50;

      await sandbox.executeInSandbox(context, async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {};
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution:cancelled event', async () => {
      const handler = jest.fn();
      sandbox.on('execution:cancelled', handler);

      const context = createMockContext('task-cancel');

      const promise = sandbox.executeInSandbox(context, async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Aborted'));
          });
        });
        return {};
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      sandbox.cancelExecution('task-cancel');

      await promise;
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should cancel all executions on shutdown', async () => {
      const contexts = [
        createMockContext('task-1'),
        createMockContext('task-2'),
      ];

      const promises = contexts.map(ctx =>
        sandbox.executeInSandbox(ctx, async (signal) => {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, 5000);
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Aborted'));
            });
          });
          return {};
        })
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(sandbox.getActiveExecutionCount()).toBe(2);

      sandbox.shutdown();

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.success).toBe(false);
      });
    });
  });
});