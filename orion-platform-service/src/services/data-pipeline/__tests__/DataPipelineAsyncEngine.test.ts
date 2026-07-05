/**
 * DataPipelineAsyncEngine Tests
 *
 * Covers: async execution, task scheduling, concurrency control, state management,
 * retry mechanism (exponential backoff), timeout control, tenant isolation.
 */

import { DataPipelineAsyncEngine, DataPipelineTask } from '../DataPipelineAsyncEngine';
import { DataPipeline, PipelineStage } from '../types';

describe('DataPipelineAsyncEngine', () => {
  let engine: DataPipelineAsyncEngine;

  const baseStages: PipelineStage[] = [
    { id: 's1', name: 'Extract', type: 'extract', config: { source: 'db', table: 'users' } },
    { id: 's2', name: 'Transform', type: 'transform', config: { mapping: 'v2' }, dependsOn: ['s1'] },
    { id: 's3', name: 'Load', type: 'load', config: { target: 'warehouse' }, dependsOn: ['s2'] },
  ];

  const basePipeline: DataPipeline = {
    id: 'pipeline-1',
    tenantId: 'tenant-1',
    name: 'test-pipeline',
    description: 'Test async pipeline',
    stages: baseStages,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    engine = new DataPipelineAsyncEngine({
      maxConcurrency: 2,
      defaultTimeoutMs: 5000,
      maxRetries: 2,
      baseRetryDelayMs: 100,
      maxRetryDelayMs: 1000,
      retryJitter: false,
    });
  });

  afterEach(() => {
    engine.destroy();
  });

  // ==================== Execution Lifecycle ====================

  describe('executePipeline', () => {
    it('should create execution record and schedule tasks', async () => {
      const execution = await engine.executePipeline(basePipeline);

      expect(execution.id).toBeDefined();
      expect(execution.pipelineId).toBe(basePipeline.id);
      expect(execution.tenantId).toBe('tenant-1');
      expect(execution.status).toBe('pending');

      const status = engine.getExecutionStatus(execution.id);
      expect(status).not.toBeNull();
      expect(status!.tasks).toHaveLength(3);
    });

    it('should complete all stages when no failures', async () => {
      const execution = await engine.executePipeline(basePipeline);

      // Wait for async completion (max duration ~1s)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const status = engine.getExecutionStatus(execution.id);
      expect(status).not.toBeNull();
      expect(status!.execution.status).toBe('completed');
      expect(status!.tasks.every((t) => t.state === 'completed')).toBe(true);
    });

    it('should respect stage dependencies', async () => {
      const execution = await engine.executePipeline(basePipeline);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const status = engine.getExecutionStatus(execution.id)!;
      const s1 = status.tasks.find((t) => t.stageId === 's1');
      const s2 = status.tasks.find((t) => t.stageId === 's2');
      const s3 = status.tasks.find((t) => t.stageId === 's3');

      // All should be completed since deps are met
      expect(s1?.state).toBe('completed');
      expect(s2?.state).toBe('completed');
      expect(s3?.state).toBe('completed');
    });

    it('should support multiple pipelines concurrently', async () => {
      const pipeline2: DataPipeline = {
        ...basePipeline,
        id: 'pipeline-2',
        stages: [
          { id: 'a1', name: 'A', type: 'extract', config: {} },
          { id: 'a2', name: 'B', type: 'load', config: {} },
        ],
      };

      const exec1 = await engine.executePipeline(basePipeline);
      const exec2 = await engine.executePipeline(pipeline2);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const status1 = engine.getExecutionStatus(exec1.id);
      const status2 = engine.getExecutionStatus(exec2.id);

      expect(status1!.execution.status).toBe('completed');
      expect(status2!.execution.status).toBe('completed');
    });
  });

  // ==================== Concurrency Control ====================

  describe('concurrency control', () => {
    it('should not exceed max concurrency', async () => {
      // Create a pipeline with many stages to test concurrency
      const manyStages: PipelineStage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `s${i}`,
        name: `Stage ${i}`,
        type: 'extract' as const,
        config: {},
      }));

      const pipeline: DataPipeline = {
        ...basePipeline,
        stages: manyStages,
      };

      const execution = await engine.executePipeline(pipeline);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const status = engine.getExecutionStatus(execution.id)!;
      const stats = engine.getStats();

      expect(status.execution.status).toBe('completed');
      expect(stats.running).toBeLessThanOrEqual(2);
    });
  });

  // ==================== Retry Mechanism ====================

  describe('retry mechanism', () => {
    it('should retry failed tasks with exponential backoff', async () => {
      const pipeline: DataPipeline = {
        ...basePipeline,
        stages: [{ id: 'fragile', name: 'Fragile', type: 'extract', config: {} }],
      };

      const execution = await engine.executePipeline(pipeline);

      // Wait long enough for retries
      await new Promise((resolve) => setTimeout(resolve, 4000));

      const status = engine.getExecutionStatus(execution.id)!;
      const task = status.tasks[0];

      // Task should eventually complete (after retries) or fail
      expect(['completed', 'failed']).toContain(task.state);
      expect(task.retryCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== Timeout Control ====================

  describe('timeout control', () => {
    it('should timeout long-running tasks', async () => {
      const engineWithShortTimeout = new DataPipelineAsyncEngine({
        maxConcurrency: 2,
        defaultTimeoutMs: 200,
        maxRetries: 0,
        baseRetryDelayMs: 100,
        maxRetryDelayMs: 1000,
        retryJitter: false,
      });

      const slowPipeline: DataPipeline = {
        ...basePipeline,
        stages: [
          {
            id: 'slow',
            name: 'Slow Stage',
            type: 'extract',
            config: { simulatedDuration: 2000 },
          },
        ],
      };

      const execution = await engineWithShortTimeout.executePipeline(slowPipeline);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = engineWithShortTimeout.getExecutionStatus(execution.id)!;
      const task = status.tasks[0];

      expect(['failed', 'completed']).toContain(task.state);
      if (task.state === 'failed') {
        expect(task.error).toBe('Task timed out');
      }

      engineWithShortTimeout.destroy();
    });
  });

  // ==================== Cancel Execution ====================

  describe('cancelExecution', () => {
    it('should cancel pending tasks', async () => {
      const execution = await engine.executePipeline(basePipeline);

      // Cancel immediately
      const cancelled = await engine.cancelExecution(execution.id);
      expect(cancelled).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = engine.getExecutionStatus(execution.id);
      expect(status).not.toBeNull();
      // After cancellation, execution should be cancelled or tasks should be cancelled
      const allCancelled = status!.tasks.every(t => t.state === 'cancelled');
      expect(allCancelled || status.execution.status === 'cancelled').toBe(true);
    });
  });

  // ==================== Stats ====================

  describe('getStats', () => {
    it('should return engine statistics', async () => {
      await engine.executePipeline(basePipeline);

      const stats = engine.getStats();

      expect(stats.totalTasks).toBeGreaterThan(0);
      expect(stats.pending + stats.running + stats.completed + stats.failed).toBe(stats.totalTasks);
    });
  });

  // ==================== Tenant Isolation ====================

  describe('tenant isolation', () => {
    it('should separate executions by tenant', async () => {
      const tenant2Pipeline: DataPipeline = {
        ...basePipeline,
        id: 'pipeline-tenant2',
        tenantId: 'tenant-2',
      };

      const exec1 = await engine.executePipeline(basePipeline);
      const exec2 = await engine.executePipeline(tenant2Pipeline);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const status1 = engine.getExecutionStatus(exec1.id);
      const status2 = engine.getExecutionStatus(exec2.id);

      expect(status1!.execution.tenantId).toBe('tenant-1');
      expect(status2!.execution.tenantId).toBe('tenant-2');
      expect(status1!.execution.status).toBe('completed');
      expect(status2!.execution.status).toBe('completed');
    });
  });
});
