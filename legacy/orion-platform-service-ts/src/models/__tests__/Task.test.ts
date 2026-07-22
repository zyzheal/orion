/**
 * Task 模型测试
 */
import {
  createTask,
  startTask,
  completeTask,
  failTask,
  appendTaskLog,
  canRetryTask,
  incrementTaskRetry,
  TaskStatus,
} from '../Task';

describe('Task', () => {
  describe('TaskStatus enum', () => {
    it('should have correct values', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.RUNNING).toBe('running');
      expect(TaskStatus.SUCCESS).toBe('success');
      expect(TaskStatus.FAILED).toBe('failed');
      expect(TaskStatus.SKIPPED).toBe('skipped');
    });
  });

  describe('createTask', () => {
    it('should create task with defaults', () => {
      const task = createTask({
        stageId: 'stage-1',
        name: 'npm-install',
        type: 'npm/install',
        sequence: 1,
      });

      expect(task.id).toBeDefined();
      expect(task.stageId).toBe('stage-1');
      expect(task.name).toBe('npm-install');
      expect(task.type).toBe('npm/install');
      expect(task.sequence).toBe(1);
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.config).toEqual({});
      expect(task.parameters).toEqual({});
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(0);
      expect(task.timeoutSeconds).toBe(600);
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const task = createTask({
        stageId: 's1',
        name: 'build',
        type: 'shell/run',
        sequence: 2,
        config: { command: 'npm run build' },
        parameters: { env: 'production' },
        resourceQuota: { cpu: '2', memory: '4Gi', timeout: 300 },
        maxRetries: 3,
        timeoutSeconds: 1200,
      });

      expect(task.config).toEqual({ command: 'npm run build' });
      expect(task.parameters).toEqual({ env: 'production' });
      expect(task.resourceQuota).toEqual({ cpu: '2', memory: '4Gi', timeout: 300 });
      expect(task.maxRetries).toBe(3);
      expect(task.timeoutSeconds).toBe(1200);
    });
  });

  describe('startTask', () => {
    it('should set status to running', () => {
      const task = createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 });
      const started = startTask(task);

      expect(started.status).toBe(TaskStatus.RUNNING);
      expect(started.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('completeTask', () => {
    it('should complete with result', () => {
      const task = createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 });
      const started = startTask(task);
      const completed = completeTask(started, { output: 'ok' });

      expect(completed.status).toBe(TaskStatus.SUCCESS);
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
      expect(completed.result).toEqual({ output: 'ok' });
    });
  });

  describe('failTask', () => {
    it('should set status to failed', () => {
      const task = createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 });
      const failed = failTask(task, 'Test failed', 'stack trace here');

      expect(failed.status).toBe(TaskStatus.FAILED);
      expect(failed.error).toBe('Test failed');
      expect(failed.log).toBe('stack trace here');
      expect(failed.completedAt).toBeInstanceOf(Date);
    });

    it('should preserve existing log when no new log provided', () => {
      const task = {
        ...createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 }),
        log: 'existing log',
      };
      const failed = failTask(task, 'error');

      expect(failed.log).toBe('existing log');
    });
  });

  describe('appendTaskLog', () => {
    it('should append to empty log', () => {
      const task = createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 });
      const updated = appendTaskLog(task, 'first line');

      expect(updated.log).toBe('first line');
    });

    it('should append to existing log', () => {
      const task = {
        ...createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 }),
        log: 'line 1',
      };
      const updated = appendTaskLog(task, 'line 2');

      expect(updated.log).toBe('line 1\nline 2');
    });
  });

  describe('canRetryTask', () => {
    it('should return true for failed task with retries', () => {
      const task = {
        ...createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1, maxRetries: 3 }),
        status: TaskStatus.FAILED,
      };
      expect(canRetryTask(task)).toBe(true);
    });

    it('should return false for failed task without retries', () => {
      const task = {
        ...createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1 }),
        status: TaskStatus.FAILED,
      };
      expect(canRetryTask(task)).toBe(false);
    });

    it('should return false for non-failed task', () => {
      const task = createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1, maxRetries: 3 });
      expect(canRetryTask(task)).toBe(false);
    });
  });

  describe('incrementTaskRetry', () => {
    it('should increment retry count and reset state', () => {
      const task = {
        ...createTask({ stageId: 's1', name: 't1', type: 'test', sequence: 1, maxRetries: 3 }),
        status: TaskStatus.FAILED as TaskStatus,
        retryCount: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 500,
        error: 'failed',
      };

      const retried = incrementTaskRetry(task);

      expect(retried.retryCount).toBe(2);
      expect(retried.status).toBe(TaskStatus.PENDING);
      expect(retried.startedAt).toBeUndefined();
      expect(retried.completedAt).toBeUndefined();
      expect(retried.durationMs).toBeUndefined();
      expect(retried.error).toBeUndefined();
      expect(retried.updatedAt).toBeInstanceOf(Date);
    });
  });
});
