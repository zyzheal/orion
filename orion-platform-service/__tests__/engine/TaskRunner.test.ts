/**
 * TaskRunner 单元测试
 */

import { TaskRunner } from '@/engine/TaskRunner';
import { createTask, TaskStatus } from '@/models/Task';

describe('TaskRunner', () => {
  let runner: TaskRunner;

  beforeEach(() => {
    runner = new TaskRunner();
  });

  describe('execute git task', () => {
    it('should execute git checkout task', async () => {
      const task = createTask({
        stageId: 'stage-123',
        name: 'checkout',
        type: 'git/checkout',
        sequence: 0,
        parameters: {
          repo: 'https://github.com/test/repo.git',
          branch: 'main',
        },
      });

      const result = await runner.run(task);

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.log).toContain('[GIT] Executing checkout');
      expect(result.result).toBeDefined();
    });
  });

  describe('execute npm task', () => {
    it('should execute npm run task', async () => {
      const task = createTask({
        stageId: 'stage-123',
        name: 'build',
        type: 'npm/run',
        sequence: 0,
        parameters: {
          command: 'build',
        },
      });

      const result = await runner.run(task);

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.log).toContain('[NPM] Running command: build');
      expect(result.result).toEqual(expect.objectContaining({
        command: 'build',
        exitCode: 0,
        output: 'Build completed successfully',
      }));
    });
  });

  describe('execute k8s task', () => {
    it('should execute k8s deploy task', async () => {
      const task = createTask({
        stageId: 'stage-123',
        name: 'deploy',
        type: 'k8s/deploy',
        sequence: 0,
        parameters: {
          name: 'my-app',
          namespace: 'production',
        },
      });

      const result = await runner.run(task);

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.log).toContain('[K8S] deploy deployment my-app');
      expect(result.result).toEqual(expect.objectContaining({
        action: 'deploy',
        namespace: 'production',
        name: 'my-app',
        status: 'completed',
      }));
    });
  });

  describe('execute shell task', () => {
    it('should execute shell script', async () => {
      const task = createTask({
        stageId: 'stage-123',
        name: 'run-script',
        type: 'shell/run',
        sequence: 0,
        parameters: {
          script: 'echo "Hello World"',
        },
      });

      const result = await runner.run(task);

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.log).toContain('[SHELL] Executing: echo "Hello World"');
    });
  });

  describe('execute mock task', () => {
    it('should execute unknown task type as mock', async () => {
      const task = createTask({
        stageId: 'stage-123',
        name: 'custom-task',
        type: 'custom/action',
        sequence: 0,
      });

      const result = await runner.run(task);

      expect(result.status).toBe(TaskStatus.SUCCESS);
      expect(result.result).toEqual(expect.objectContaining({
        simulated: true,
        taskName: 'custom-task',
        taskType: 'custom/action',
      }));
    });
  });

  describe('task logging', () => {
    it('should append logs during execution', async () => {
      const task = createTask({
        stageId: 'stage-123',
        name: 'logged-task',
        type: 'npm/run',
        sequence: 0,
        parameters: {
          command: 'test',
        },
      });

      const result = await runner.run(task);

      expect(result.log).toContain('[INFO] Starting task: logged-task');
      expect(result.log).toContain('[INFO] Task type: npm/run');
      expect(result.log).toContain('[NPM] Running command: test');
    });
  });
});
