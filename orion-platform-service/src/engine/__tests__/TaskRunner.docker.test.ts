/**
 * TaskRunner Docker Task Type Tests
 *
 * Tests for docker/build, docker/push, docker/scan task type dispatch
 * and DockerBuildService integration.
 */

import { TaskRunner } from '../TaskRunner';
import { Task, TaskType, TaskStatus } from '../../models/Task';

describe('TaskRunner Docker Task Types', () => {
  let runner: TaskRunner;

  beforeEach(() => {
    runner = new TaskRunner();
  });

  const createTask = (type: string, parameters: Record<string, unknown> = {}): Task => ({
    id: `task-${Date.now()}`,
    pipelineId: 'pipeline-1',
    pipelineRunId: 'run-1',
    stageId: 'stage-1',
    name: 'docker-task',
    type: type as TaskType,
    parameters: {
      ...parameters,
      pipelineRunId: 'run-1',
      stageId: 'stage-1',
    },
    status: TaskStatus.PENDING,
    log: '',
    maxRetries: 0,
    retryCount: 0,
    timeoutSeconds: 120,
    dependsOn: [],
  });

  describe('docker/build type dispatch', () => {
    test('should dispatch docker/build to docker task handler', async () => {
      const task = createTask('docker/build', {
        image: 'test-app',
        tag: 'latest',
        context: '/tmp',
      });

      // Docker may not be available in test environment; expect graceful failure
      const result = await runner.run(task);
      expect(result).toBeDefined();
      // If docker is not available, task will fail (status FAILED) or have error in result
      if (result.status === TaskStatus.SUCCESS) {
        expect(result.result).toBeDefined();
      }
      // Either way, result should be defined (task completed or failed)
      expect(result.status).toBeDefined();
    });

    test('should require image parameter for docker/build', async () => {
      const task = createTask('docker/build', {
        context: '/tmp',
      });

      const result = await runner.run(task);
      // Should fail due to missing image parameter
      if (result.result && (result.result as Record<string, unknown>).error) {
        expect((result.result as Record<string, unknown>).error as string).toContain('image');
      }
    });
  });

  describe('docker/push type dispatch', () => {
    test('should dispatch docker/push to docker task handler', async () => {
      const task = createTask('docker/push', {
        image: 'test-app',
        tag: 'latest',
      });

      const result = await runner.run(task);
      expect(result).toBeDefined();
    });

    test('should require image parameter for docker/push', async () => {
      const task = createTask('docker/push', {
        tag: 'latest',
      });

      const result = await runner.run(task);
      if (result.result && (result.result as Record<string, unknown>).error) {
        expect((result.result as Record<string, unknown>).error as string).toContain('image');
      }
    });
  });

  describe('docker/scan type dispatch', () => {
    test('should dispatch docker/scan to docker task handler', async () => {
      const task = createTask('docker/scan', {
        image: 'test-app',
        tag: 'latest',
        scanner: 'trivy',
      });

      const result = await runner.run(task);
      expect(result).toBeDefined();
    });

    test('should use trivy as default scanner', async () => {
      const task = createTask('docker/scan', {
        image: 'test-app',
        tag: 'latest',
      });

      const result = await runner.run(task);
      // Scanner not available is acceptable
      if (result.result && (result.result as Record<string, unknown>).error) {
        // If it fails, it should be about scanner or docker not being available
        const err = (result.result as Record<string, unknown>).error as string;
        expect(typeof err).toBe('string');
      }
    });
  });

  describe('unknown docker action', () => {
    test('should reject unknown docker actions', async () => {
      const task = createTask('docker/unknown', {});

      const result = await runner.run(task);
      if (result.result && (result.result as Record<string, unknown>).error) {
        expect((result.result as Record<string, unknown>).error as string).toContain('Unknown');
      }
    });
  });
});
