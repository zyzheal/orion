/**
 * RunnerJob 模型测试
 */
import {
  createRunnerJob,
  startRunnerJob,
  completeRunnerJob,
  failRunnerJob,
} from '../RunnerJob';

describe('RunnerJob', () => {
  describe('createRunnerJob', () => {
    it('should create job with defaults', () => {
      const job = createRunnerJob({
        runnerId: 'runner-1',
        taskId: 'task-1',
        tenantId: 't1',
      });

      expect(job.id).toBeDefined();
      expect(job.runnerId).toBe('runner-1');
      expect(job.taskId).toBe('task-1');
      expect(job.tenantId).toBe('t1');
      expect(job.status).toBe('pending');
      expect(job.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const job = createRunnerJob({
        runnerId: 'r1',
        taskId: 't1',
        tenantId: 't1',
        stageId: 's1',
        runId: 'run1',
      });

      expect(job.stageId).toBe('s1');
      expect(job.runId).toBe('run1');
    });
  });

  describe('startRunnerJob', () => {
    it('should set status to running', () => {
      const job = createRunnerJob({
        runnerId: 'r1', taskId: 't1', tenantId: 't1',
      });
      const started = startRunnerJob(job);

      expect(started.status).toBe('running');
      expect(started.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('completeRunnerJob', () => {
    it('should mark as completed', () => {
      const job = createRunnerJob({
        runnerId: 'r1', taskId: 't1', tenantId: 't1',
      });
      const started = startRunnerJob(job);
      const completed = completeRunnerJob(started, { output: 'ok' });

      expect(completed.status).toBe('completed');
      expect(completed.result).toEqual({ output: 'ok' });
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('should work without result', () => {
      const job = createRunnerJob({
        runnerId: 'r1', taskId: 't1', tenantId: 't1',
      });
      const completed = completeRunnerJob(job);

      expect(completed.status).toBe('completed');
      expect(completed.result).toBeUndefined();
    });
  });

  describe('failRunnerJob', () => {
    it('should mark as failed', () => {
      const job = createRunnerJob({
        runnerId: 'r1', taskId: 't1', tenantId: 't1',
      });
      const failed = failRunnerJob(job, 'OOM killed');

      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('OOM killed');
      expect(failed.completedAt).toBeInstanceOf(Date);
    });
  });
});
