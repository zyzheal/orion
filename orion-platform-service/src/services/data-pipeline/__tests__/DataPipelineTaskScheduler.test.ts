/**
 * DataPipelineTaskScheduler Tests
 *
 * Covers: enqueue, dequeue, concurrency control, priority ordering, stats.
 */

import { DataPipelineTaskScheduler, TaskPriority } from '../DataPipelineTaskScheduler';

describe('DataPipelineTaskScheduler', () => {
  let scheduler: DataPipelineTaskScheduler;

  const createTask = (id: string, priority: TaskPriority = 'NORMAL'): {
    id: string;
    pipelineId: string;
    tenantId: string;
    priority: TaskPriority;
    execute: () => Promise<void>;
    enqueuedAt: number;
  } => ({
    id,
    pipelineId: 'pipeline-1',
    tenantId: 'tenant-1',
    priority,
    execute: jest.fn().mockResolvedValue(undefined),
    enqueuedAt: Date.now(),
  });

  beforeEach(() => {
    scheduler = new DataPipelineTaskScheduler({
      maxConcurrent: 2,
      maxQueueSize: 10,
    });
  });

  afterEach(() => {
    scheduler.destroy();
  });

  // ==================== Enqueue ====================

  describe('enqueue', () => {
    it('should enqueue a task successfully', () => {
      const task = createTask('task-1');
      const result = scheduler.enqueue(task);

      expect(result).toBe(true);
      expect(scheduler.getQueueDepth()).toBe(1);
    });

    it('should reject task when queue is full', () => {
      const fullScheduler = new DataPipelineTaskScheduler({
        maxConcurrent: 1,
        maxQueueSize: 1,
      });

      const task1 = createTask('task-1');
      const task2 = createTask('task-2');

      expect(fullScheduler.enqueue(task1)).toBe(true);

      // Queue is full, but maxConcurrent is 1 so first task starts immediately
      // Second task should be rejected
      const result = fullScheduler.enqueue(task2);
      expect(result).toBe(false);

      fullScheduler.destroy();
    });

    it('should emit task:enqueued event', () => {
      const onEnqueued = jest.fn();
      scheduler.on('task:enqueued', onEnqueued);

      const task = createTask('task-1');
      scheduler.enqueue(task);

      expect(onEnqueued).toHaveBeenCalledWith({ taskId: 'task-1', priority: 'NORMAL' });
    });
  });

  // ==================== Cancel ====================

  describe('cancel', () => {
    it('should cancel a pending task', () => {
      const task = createTask('task-1');
      scheduler.enqueue(task);

      const result = scheduler.cancel('task-1');
      expect(result).toBe(true);
      expect(scheduler.getQueueDepth()).toBe(0);
    });

    it('should return false for non-existent task', () => {
      const result = scheduler.cancel('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== Priority Ordering ====================

  describe('priority ordering', () => {
    it('should execute higher priority tasks first', async () => {
      const executionOrder: string[] = [];

      const lowTask = createTask('low', 'LOW');
      lowTask.execute = jest.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 200));
        executionOrder.push('low');
      });

      const highTask = createTask('high', 'HIGH');
      highTask.execute = jest.fn().mockImplementation(async () => {
        executionOrder.push('high');
      });

      scheduler.enqueue(lowTask);
      scheduler.enqueue(highTask);

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(executionOrder[0]).toBe('high');
    });
  });

  // ==================== Concurrency Control ====================

  describe('concurrency control', () => {
    it('should respect max concurrency limit', async () => {
      const scheduler = new DataPipelineTaskScheduler({
        maxConcurrent: 1,
        maxQueueSize: 10,
      });

      const startTimes: number[] = [];
      const task1 = createTask('task-1');
      task1.execute = jest.fn().mockImplementation(async () => {
        startTimes.push(Date.now());
        await new Promise((r) => setTimeout(r, 300));
      });

      const task2 = createTask('task-2');
      task2.execute = jest.fn().mockImplementation(async () => {
        startTimes.push(Date.now());
      });

      scheduler.enqueue(task1);
      scheduler.enqueue(task2);

      await new Promise((resolve) => setTimeout(resolve, 800));

      // task2 should start after task1 completes
      expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(250);

      scheduler.destroy();
    });
  });

  // ==================== Stats ====================

  describe('getStats', () => {
    it('should return scheduler statistics', async () => {
      const task = createTask('task-1');
      scheduler.enqueue(task);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = scheduler.getStats();

      expect(stats.totalEnqueued).toBe(1);
      expect(stats.totalDequeued).toBeGreaterThanOrEqual(1);
    });

    it('should track rejected tasks', () => {
      const fullScheduler = new DataPipelineTaskScheduler({
        maxConcurrent: 1,
        maxQueueSize: 1,
      });

      const task1 = createTask('task-1');
      const task2 = createTask('task-2');

      fullScheduler.enqueue(task1);
      fullScheduler.enqueue(task2);

      const stats = fullScheduler.getStats();
      expect(stats.totalRejected).toBeGreaterThanOrEqual(1);

      fullScheduler.destroy();
    });
  });

  // ==================== Destroy ====================

  describe('destroy', () => {
    it('should clear all state', () => {
      const task = createTask('task-1');
      scheduler.enqueue(task);

      scheduler.destroy();

      expect(scheduler.getQueueDepth()).toBe(0);
      expect(scheduler.getRunningCount()).toBe(0);
      expect(scheduler.getStats().totalEnqueued).toBe(0);
    });
  });
});
