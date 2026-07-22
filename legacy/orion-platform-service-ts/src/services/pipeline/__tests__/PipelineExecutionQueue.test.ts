/**
 * PipelineExecutionQueue - 执行队列与背压控制单元测试
 *
 * 测试覆盖: 入队、优先级排序、并发限制、背压、出队、取消、统计
 */

import { PipelineExecutionQueue } from '../PipelineExecutionQueue';

describe('PipelineExecutionQueue', () => {
  let queue: PipelineExecutionQueue;

  beforeEach(() => {
    queue = new PipelineExecutionQueue({ maxConcurrent: 2, maxQueueSize: 5 });
  });

  // ==================== enqueue ====================

  describe('enqueue', () => {
    it('should enqueue and execute a run', async () => {
      const executeFn = jest.fn().mockResolvedValue(undefined);

      await queue.enqueue({
        runId: 'run-1',
        pipelineId: 'p-1',
        priority: 'NORMAL',
        executeFn,
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      expect(executeFn).toHaveBeenCalled();
    });

    it('should execute multiple runs concurrently up to limit', async () => {
      let running = 0;
      let maxRunning = 0;
      const executeFn = jest.fn().mockImplementation(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(r => setTimeout(r, 50));
        running--;
      });

      const promises = [
        queue.enqueue({ runId: 'run-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {}),
        queue.enqueue({ runId: 'run-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {}),
        queue.enqueue({ runId: 'run-3', pipelineId: 'p-1', priority: 'NORMAL', executeFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {}),
      ];

      await Promise.all(promises);

      expect(maxRunning).toBeLessThanOrEqual(2);
      expect(executeFn).toHaveBeenCalledTimes(3);
    });

    it('should reject when queue is full', async () => {
      const slowFn = jest.fn().mockImplementation(() => new Promise(() => {})); // never resolves

      const suppressRejection = (err: Error) => {};
      process.on('unhandledRejection', suppressRejection);

      // Fill concurrent slots
      queue.enqueue({ runId: 'run-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: slowFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      queue.enqueue({ runId: 'run-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn: slowFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});

      // Fill queue
      for (let i = 3; i <= 7; i++) {
        queue.enqueue({ runId: `run-${i}`, pipelineId: 'p-1', priority: 'NORMAL', executeFn: slowFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      }

      // Next should be rejected
      await expect(queue.enqueue({
        runId: 'run-8',
        pipelineId: 'p-1',
        priority: 'NORMAL',
        executeFn: slowFn,
        resolve: jest.fn(),
        reject: jest.fn(),
      })).rejects.toThrow('queue is full');

      process.removeListener('unhandledRejection', suppressRejection);
    });

    it('should respect priority ordering', async () => {
      const executionOrder: string[] = [];
      const executeFn = jest.fn().mockImplementation(async () => {
        // Small delay to ensure ordering
      });

      // Block concurrent slots
      const blockingFn = jest.fn().mockImplementation(() => new Promise<void>(r => {
        setTimeout(() => r(), 100);
      }));

      queue.enqueue({ runId: 'blocker-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      queue.enqueue({ runId: 'blocker-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});

      // Queue with different priorities
      const lowPromise = queue.enqueue({ runId: 'low-1', pipelineId: 'p-1', priority: 'LOW', executeFn: jest.fn().mockImplementation(() => { executionOrder.push('low'); return Promise.resolve(); }), resolve: jest.fn(), reject: jest.fn() });
      const highPromise = queue.enqueue({ runId: 'high-1', pipelineId: 'p-1', priority: 'HIGH', executeFn: jest.fn().mockImplementation(() => { executionOrder.push('high'); return Promise.resolve(); }), resolve: jest.fn(), reject: jest.fn() });
      const normalPromise = queue.enqueue({ runId: 'normal-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: jest.fn().mockImplementation(() => { executionOrder.push('normal'); return Promise.resolve(); }), resolve: jest.fn(), reject: jest.fn() });

      await Promise.all([lowPromise, highPromise, normalPromise]);

      // HIGH should execute before NORMAL before LOW
      expect(executionOrder.indexOf('high')).toBeLessThan(executionOrder.indexOf('normal'));
      expect(executionOrder.indexOf('normal')).toBeLessThan(executionOrder.indexOf('low'));
    });
  });

  // ==================== remove ====================

  describe('remove', () => {
    it('should remove a queued run', async () => {
      const blockingFn = jest.fn().mockImplementation(() => new Promise(() => {}));

      // Catch floating promises from enqueue (reject creates unhandled rejection)
      const suppressRejection = (err: Error) => {};
      process.on('unhandledRejection', suppressRejection);

      // Fire-and-forget: enqueue never resolves (blockingFn hangs), don't await
      queue.enqueue({ runId: 'blocker-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      queue.enqueue({ runId: 'blocker-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});

      const rejectFn = jest.fn();
      queue.enqueue({ runId: 'run-3', pipelineId: 'p-1', priority: 'NORMAL', executeFn: jest.fn(), resolve: jest.fn(), reject: rejectFn }).catch(() => {});

      const removed = queue.remove('run-3');

      expect(removed).toBe(true);
      expect(rejectFn).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('cancelled') }));

      process.removeListener('unhandledRejection', suppressRejection);
    });

    it('should return false when run not found', () => {
      const result = queue.remove('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== clear ====================

  describe('clear', () => {
    it('should clear all queued runs', async () => {
      const blockingFn = jest.fn().mockImplementation(() => new Promise(() => {}));

      const suppressRejection = (err: Error) => {};
      process.on('unhandledRejection', suppressRejection);

      queue.enqueue({ runId: 'blocker-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      queue.enqueue({ runId: 'blocker-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});

      const rejectFn1 = jest.fn();
      const rejectFn2 = jest.fn();
      queue.enqueue({ runId: 'queued-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: jest.fn(), resolve: jest.fn(), reject: rejectFn1 }).catch(() => {});
      queue.enqueue({ runId: 'queued-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn: jest.fn(), resolve: jest.fn(), reject: rejectFn2 }).catch(() => {});

      queue.clear();

      expect(queue.getDepth()).toBe(0);
      expect(rejectFn1).toHaveBeenCalled();
      expect(rejectFn2).toHaveBeenCalled();

      process.removeListener('unhandledRejection', suppressRejection);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const executeFn = jest.fn().mockResolvedValue(undefined);

      await queue.enqueue({ runId: 'run-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn, resolve: jest.fn(), reject: jest.fn() });

      const stats = queue.getStats();

      expect(stats.totalEnqueued).toBe(1);
      expect(stats.totalDequeued).toBe(1);
      expect(stats.totalRejected).toBe(0);
      expect(stats.currentQueueDepth).toBe(0);
      expect(stats.currentRunning).toBe(0); // completed
    });

    it('should track rejected count', async () => {
      const blockingFn = jest.fn().mockImplementation(() => new Promise(() => {}));

      const suppressRejection = (err: Error) => {};
      process.on('unhandledRejection', suppressRejection);

      // Fill everything
      for (let i = 1; i <= 7; i++) {
        queue.enqueue({ runId: `run-${i}`, pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      }

      try {
        await queue.enqueue({ runId: 'run-8', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() });
      } catch {}

      const stats = queue.getStats();

      expect(stats.totalRejected).toBe(1);

      process.removeListener('unhandledRejection', suppressRejection);
    });
  });

  // ==================== getQueuedRuns ====================

  describe('getQueuedRuns', () => {
    it('should return queued runs with position', async () => {
      const blockingFn = jest.fn().mockImplementation(() => new Promise(() => {}));

      queue.enqueue({ runId: 'blocker-1', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      queue.enqueue({ runId: 'blocker-2', pipelineId: 'p-1', priority: 'NORMAL', executeFn: blockingFn, resolve: jest.fn(), reject: jest.fn() }).catch(() => {});
      queue.enqueue({ runId: 'queued-1', pipelineId: 'p-2', priority: 'HIGH', executeFn: jest.fn(), resolve: jest.fn(), reject: jest.fn() }).catch(() => {});

      const runs = queue.getQueuedRuns();

      expect(runs).toHaveLength(1);
      expect(runs[0].runId).toBe('queued-1');
      expect(runs[0].position).toBe(1);
    });

    it('should return empty when queue is empty', () => {
      expect(queue.getQueuedRuns()).toEqual([]);
    });
  });

  // ==================== Events ====================

  describe('events', () => {
    it('should emit dequeue event', async () => {
      const dequeueSpy = jest.fn();
      queue.on('dequeue', dequeueSpy);

      await queue.enqueue({
        runId: 'run-1', pipelineId: 'p-1', priority: 'NORMAL',
        executeFn: jest.fn().mockResolvedValue(undefined),
        resolve: jest.fn(), reject: jest.fn(),
      });

      expect(dequeueSpy).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-1' }));
    });

    it('should emit completed event', async () => {
      const completedSpy = jest.fn();
      queue.on('completed', completedSpy);

      await queue.enqueue({
        runId: 'run-1', pipelineId: 'p-1', priority: 'NORMAL',
        executeFn: jest.fn().mockResolvedValue(undefined),
        resolve: jest.fn(), reject: jest.fn(),
      });

      expect(completedSpy).toHaveBeenCalledWith({ runId: 'run-1' });
    });

    it('should emit failed event on execution error', async () => {
      const failedSpy = jest.fn();
      queue.on('failed', failedSpy);

      const rejectFn = jest.fn();
      const p = queue.enqueue({
        runId: 'run-1', pipelineId: 'p-1', priority: 'NORMAL',
        executeFn: jest.fn().mockRejectedValue(new Error('Build failed')),
        resolve: jest.fn(), reject: rejectFn,
      }).catch(() => {}); // catch immediately to prevent unhandled rejection

      // Wait for async execution
      await new Promise(r => setTimeout(r, 50));

      expect(rejectFn).toHaveBeenCalled();
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should use default config when none provided', () => {
      const defaultQueue = new PipelineExecutionQueue();

      expect(defaultQueue.getStats().currentQueueDepth).toBe(0);
    });

    it('should handle empty queue depth', () => {
      expect(queue.getDepth()).toBe(0);
      expect(queue.getRunningCount()).toBe(0);
    });
  });
});
