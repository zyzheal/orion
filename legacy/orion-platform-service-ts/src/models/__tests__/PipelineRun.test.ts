/**
 * PipelineRun 模型测试
 */
import {
  createPipelineRun,
  startPipelineRun,
  completePipelineRun,
  cancelPipelineRun,
  PipelineRunStatus,
  TriggerType,
} from '../PipelineRun';

describe('PipelineRun', () => {
  describe('enums', () => {
    it('PipelineRunStatus should have correct values', () => {
      expect(PipelineRunStatus.PENDING).toBe('pending');
      expect(PipelineRunStatus.RUNNING).toBe('running');
      expect(PipelineRunStatus.SUCCESS).toBe('success');
      expect(PipelineRunStatus.FAILED).toBe('failed');
      expect(PipelineRunStatus.CANCELLED).toBe('cancelled');
    });

    it('TriggerType should have correct values', () => {
      expect(TriggerType.MANUAL).toBe('manual');
      expect(TriggerType.API).toBe('api');
      expect(TriggerType.EVENT).toBe('event');
      expect(TriggerType.SCHEDULE).toBe('schedule');
    });
  });

  describe('createPipelineRun', () => {
    it('should create run with defaults', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0.0',
        triggerType: TriggerType.MANUAL,
      });

      expect(run.id).toBeDefined();
      expect(run.pipelineId).toBe('p1');
      expect(run.pipelineVersion).toBe('1.0.0');
      expect(run.triggerType).toBe(TriggerType.MANUAL);
      expect(run.status).toBe(PipelineRunStatus.PENDING);
      expect(run.context).toEqual({});
      expect(run.createdAt).toBeInstanceOf(Date);
      expect(run.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0',
        triggerType: TriggerType.API,
        triggerBy: 'user1',
        environment: 'staging',
        context: { git: { ref: 'main' } },
      });

      expect(run.triggerBy).toBe('user1');
      expect(run.environment).toBe('staging');
      expect(run.context.git?.ref).toBe('main');
    });
  });

  describe('startPipelineRun', () => {
    it('should set status to running', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0',
        triggerType: TriggerType.MANUAL,
      });
      const started = startPipelineRun(run);

      expect(started.status).toBe(PipelineRunStatus.RUNNING);
      expect(started.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('completePipelineRun', () => {
    it('should complete with success', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0',
        triggerType: TriggerType.MANUAL,
      });
      const started = startPipelineRun(run);
      const completed = completePipelineRun(started, PipelineRunStatus.SUCCESS);

      expect(completed.status).toBe(PipelineRunStatus.SUCCESS);
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should complete with failure', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0',
        triggerType: TriggerType.MANUAL,
      });
      const completed = completePipelineRun(run, PipelineRunStatus.FAILED);

      expect(completed.status).toBe(PipelineRunStatus.FAILED);
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cancelPipelineRun', () => {
    it('should cancel run', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0',
        triggerType: TriggerType.MANUAL,
      });
      const started = startPipelineRun(run);
      const cancelled = cancelPipelineRun(started);

      expect(cancelled.status).toBe(PipelineRunStatus.CANCELLED);
      expect(cancelled.completedAt).toBeInstanceOf(Date);
    });

    it('should handle cancel without startedAt', () => {
      const run = createPipelineRun({
        pipelineId: 'p1',
        pipelineVersion: '1.0',
        triggerType: TriggerType.MANUAL,
      });
      const cancelled = cancelPipelineRun(run);

      expect(cancelled.status).toBe(PipelineRunStatus.CANCELLED);
      expect(cancelled.durationMs).toBe(0);
    });
  });
});
