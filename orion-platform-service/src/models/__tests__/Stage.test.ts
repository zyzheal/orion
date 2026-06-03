/**
 * Stage 模型测试
 */
import {
  createStage,
  startStage,
  completeStage,
  failStage,
  skipStage,
  canRetryStage,
  incrementStageRetry,
  StageStatus,
} from '../Stage';

describe('Stage', () => {
  describe('StageStatus enum', () => {
    it('should have correct values', () => {
      expect(StageStatus.PENDING).toBe('pending');
      expect(StageStatus.RUNNING).toBe('running');
      expect(StageStatus.SUCCESS).toBe('success');
      expect(StageStatus.FAILED).toBe('failed');
      expect(StageStatus.SKIPPED).toBe('skipped');
    });
  });

  describe('createStage', () => {
    it('should create stage with defaults', () => {
      const stage = createStage({
        runId: 'run-1',
        name: 'build',
        sequence: 1,
      });

      expect(stage.id).toBeDefined();
      expect(stage.runId).toBe('run-1');
      expect(stage.name).toBe('build');
      expect(stage.sequence).toBe(1);
      expect(stage.status).toBe(StageStatus.PENDING);
      expect(stage.dependsOn).toEqual([]);
      expect(stage.timeoutSeconds).toBe(3600);
      expect(stage.retryCount).toBe(0);
      expect(stage.maxRetries).toBe(0);
      expect(stage.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const stage = createStage({
        runId: 'run-1',
        name: 'deploy',
        sequence: 3,
        dependsOn: ['build', 'test'],
        condition: '${stages.test.result} == "success"',
        timeoutSeconds: 600,
        maxRetries: 3,
      });

      expect(stage.dependsOn).toEqual(['build', 'test']);
      expect(stage.condition).toContain('test.result');
      expect(stage.timeoutSeconds).toBe(600);
      expect(stage.maxRetries).toBe(3);
    });
  });

  describe('startStage', () => {
    it('should set status to running', () => {
      const stage = createStage({ runId: 'r1', name: 'build', sequence: 1 });
      const started = startStage(stage);

      expect(started.status).toBe(StageStatus.RUNNING);
      expect(started.startedAt).toBeInstanceOf(Date);
      expect(started.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('completeStage', () => {
    it('should complete with success', () => {
      const stage = createStage({ runId: 'r1', name: 'build', sequence: 1 });
      const started = startStage(stage);
      const completed = completeStage(started, { artifact: 'app.jar' });

      expect(completed.status).toBe(StageStatus.SUCCESS);
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
      expect(completed.result).toEqual({ artifact: 'app.jar' });
    });

    it('should work without result', () => {
      const stage = createStage({ runId: 'r1', name: 'build', sequence: 1 });
      const completed = completeStage(stage);

      expect(completed.status).toBe(StageStatus.SUCCESS);
      expect(completed.result).toBeUndefined();
    });
  });

  describe('failStage', () => {
    it('should set status to failed', () => {
      const stage = createStage({ runId: 'r1', name: 'build', sequence: 1 });
      const failed = failStage(stage, 'Build failed');

      expect(failed.status).toBe(StageStatus.FAILED);
      expect(failed.error).toBe('Build failed');
      expect(failed.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('skipStage', () => {
    it('should set status to skipped', () => {
      const stage = createStage({ runId: 'r1', name: 'deploy', sequence: 2 });
      const skipped = skipStage(stage);

      expect(skipped.status).toBe(StageStatus.SKIPPED);
      expect(skipped.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('canRetryStage', () => {
    it('should return true for failed stage with retries remaining', () => {
      const stage = {
        ...createStage({ runId: 'r1', name: 'build', sequence: 1, maxRetries: 3 }),
        status: StageStatus.FAILED,
      };
      expect(canRetryStage(stage)).toBe(true);
    });

    it('should return false for failed stage with no retries', () => {
      const stage = {
        ...createStage({ runId: 'r1', name: 'build', sequence: 1 }),
        status: StageStatus.FAILED,
      };
      expect(canRetryStage(stage)).toBe(false);
    });

    it('should return false for non-failed stage', () => {
      const stage = createStage({ runId: 'r1', name: 'build', sequence: 1, maxRetries: 3 });
      expect(canRetryStage(stage)).toBe(false);
    });
  });

  describe('incrementStageRetry', () => {
    it('should increment retry count and reset state', () => {
      const stage = {
        ...createStage({ runId: 'r1', name: 'build', sequence: 1, maxRetries: 3 }),
        status: StageStatus.FAILED as StageStatus,
        retryCount: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 1000,
        error: 'failed',
      };

      const retried = incrementStageRetry(stage);

      expect(retried.retryCount).toBe(2);
      expect(retried.status).toBe(StageStatus.PENDING);
      expect(retried.startedAt).toBeUndefined();
      expect(retried.completedAt).toBeUndefined();
      expect(retried.durationMs).toBeUndefined();
      expect(retried.error).toBeUndefined();
      expect(retried.updatedAt).toBeInstanceOf(Date);
    });
  });
});
