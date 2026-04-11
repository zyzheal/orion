/**
 * PipelineRunService 单元测试
 */

import { PipelineRunService } from '@/services/pipeline/PipelineRunService';
import { PipelineRunStatus, TriggerType } from '@/models/PipelineRun';
import { StageStatus } from '@/models/Stage';
import { createStage } from '@/models/Stage';
import { createTask, TaskStatus } from '@/models/Task';
import { PipelineEventPublisher } from '@/events/PipelineEventPublisher';

describe('PipelineRunService', () => {
  let service: PipelineRunService;
  let mockEventPublisher: PipelineEventPublisher;

  beforeEach(() => {
    mockEventPublisher = {
      publishRunCreated: jest.fn().mockResolvedValue(undefined),
      publishRunStarted: jest.fn().mockResolvedValue(undefined),
      publishRunCompleted: jest.fn().mockResolvedValue(undefined),
      publishRunFailed: jest.fn().mockResolvedValue(undefined),
      publishRunCancelled: jest.fn().mockResolvedValue(undefined),
      publishStageStarted: jest.fn().mockResolvedValue(undefined),
      publishStageCompleted: jest.fn().mockResolvedValue(undefined),
      publishStageFailed: jest.fn().mockResolvedValue(undefined),
      publishStageSkipped: jest.fn().mockResolvedValue(undefined),
      publishTaskStarted: jest.fn().mockResolvedValue(undefined),
      publishTaskCompleted: jest.fn().mockResolvedValue(undefined),
      publishTaskFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as PipelineEventPublisher;

    service = new PipelineRunService(mockEventPublisher);
  });

  describe('createRun', () => {
    it('should create a new pipeline run', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-123',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
        triggerBy: 'test-user',
      });

      expect(run.id).toBeDefined();
      expect(run.pipelineId).toBe('pipeline-123');
      expect(run.status).toBe(PipelineRunStatus.PENDING);
      expect(mockEventPublisher.publishRunCreated).toHaveBeenCalled();
    });
  });

  describe('startRun', () => {
    it('should start a pending run', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-456',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.API,
      });

      const started = await service.startRun(run.id);

      expect(started?.status).toBe(PipelineRunStatus.RUNNING);
      expect(started?.startedAt).toBeDefined();
      expect(mockEventPublisher.publishRunStarted).toHaveBeenCalled();
    });
  });

  describe('completeRun', () => {
    it('should complete run with success', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-789',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      await service.startRun(run.id);

      const completed = await service.completeRun(run.id, PipelineRunStatus.SUCCESS);

      expect(completed?.status).toBe(PipelineRunStatus.SUCCESS);
      expect(completed?.completedAt).toBeDefined();
      expect(completed?.durationMs).toBeDefined();
      expect(mockEventPublisher.publishRunCompleted).toHaveBeenCalled();
    });

    it('should complete run with failure', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-fail',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      await service.startRun(run.id);

      const completed = await service.completeRun(run.id, PipelineRunStatus.FAILED);

      expect(completed?.status).toBe(PipelineRunStatus.FAILED);
      expect(mockEventPublisher.publishRunFailed).toHaveBeenCalled();
    });
  });

  describe('cancelRun', () => {
    it('should cancel a running run', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-cancel',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      await service.startRun(run.id);

      const cancelled = await service.cancelRun(run.id);

      expect(cancelled?.status).toBe(PipelineRunStatus.CANCELLED);
      expect(cancelled?.completedAt).toBeDefined();
      expect(mockEventPublisher.publishRunCancelled).toHaveBeenCalled();
    });

    it('should not cancel a non-running run', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-not-running',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      // Run is still pending, cannot cancel
      const cancelled = await service.cancelRun(run.id);

      expect(cancelled).toBeNull();
    });
  });

  describe('stage management', () => {
    it('should add and get stages', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-stages',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      const stage1 = createStage({
        runId: run.id,
        name: 'build',
        sequence: 0,
      });

      const stage2 = createStage({
        runId: run.id,
        name: 'test',
        sequence: 1,
        dependsOn: ['build'],
      });

      await service.addStage(run.id, stage1);
      await service.addStage(run.id, stage2);

      const stages = await service.getStages(run.id);

      expect(stages.length).toBe(2);
      expect(stages.map( (s: any) => s.name)).toEqual(['build', 'test']);
    });

    it('should update stage', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-update',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      const stage = createStage({
        runId: run.id,
        name: 'build',
        sequence: 0,
      });

      await service.addStage(run.id, stage);

      // Update stage status
      const updatedStage = { ...stage, status: StageStatus.RUNNING };
      await service.updateStage(updatedStage);

      const retrieved = await service.getStage(stage.id);
      expect(retrieved?.status).toBe(StageStatus.RUNNING);
    });
  });

  describe('task management', () => {
    it('should add and get tasks', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-tasks',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      const stage = createStage({
        runId: run.id,
        name: 'build',
        sequence: 0,
      });

      await service.addStage(run.id, stage);

      const task1 = createTask({
        stageId: stage.id,
        name: 'checkout',
        type: 'git/checkout',
        sequence: 0,
      });

      const task2 = createTask({
        stageId: stage.id,
        name: 'compile',
        type: 'npm/run',
        sequence: 1,
      });

      await service.addTask(stage.id, task1);
      await service.addTask(stage.id, task2);

      const tasks = await service.getTasks(stage.id);

      expect(tasks.length).toBe(2);
    });

    it('should update task', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-task-update',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      const stage = createStage({
        runId: run.id,
        name: 'build',
        sequence: 0,
      });

      await service.addStage(run.id, stage);

      const task = createTask({
        stageId: stage.id,
        name: 'checkout',
        type: 'git/checkout',
        sequence: 0,
      });

      await service.addTask(stage.id, task);

      // Update task status
      const updatedTask = { ...task, status: TaskStatus.SUCCESS, result: { commit: 'abc123' } };
      await service.updateTask(updatedTask as any);

      const retrieved = await service.getTask(task.id);
      expect(retrieved?.status).toBe('success');
    });
  });

  describe('getRunDetail', () => {
    it('should get run with stages and tasks', async () => {
      const run = await service.createRun({
        pipelineId: 'pipeline-detail',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      const stage = createStage({
        runId: run.id,
        name: 'build',
        sequence: 0,
      });

      await service.addStage(run.id, stage);

      const task = createTask({
        stageId: stage.id,
        name: 'checkout',
        type: 'git/checkout',
        sequence: 0,
      });

      await service.addTask(stage.id, task);

      const detail = await service.getRunDetail(run.id);

      expect(detail).not.toBeNull();
      expect(detail?.run!.id).toBe(run.id);
      expect(detail?.stages.length).toBe(1);
      expect(detail?.tasks.length).toBe(1);
    });
  });
});
