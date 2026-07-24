/**
 * BuildPod 模型测试
 */
import {
  createBuildPod,
  updatePodStatus,
  isPodTerminal,
  isPodSuccessful,
  BuildPodStatus,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_RESOURCE_REQUESTS,
} from '../BuildPod';

describe('BuildPod', () => {
  const minimalInput = {
    containers: [{ name: 'main', image: 'node:20' }],
  };

  describe('createBuildPod', () => {
    it('should create pod with defaults', () => {
      const pod = createBuildPod(minimalInput);

      expect(pod.id).toBeDefined();
      expect(pod.name).toMatch(/^build-/);
      expect(pod.namespace).toBe('orion-builds');
      expect(pod.status).toBe(BuildPodStatus.PENDING);
      expect(pod.containers).toHaveLength(1);
      expect(pod.createdAt).toBeInstanceOf(Date);
    });

    it('should add default resource limits to containers', () => {
      const pod = createBuildPod(minimalInput);
      const resources = pod.containers[0].resources!;

      expect(resources.requests).toEqual(DEFAULT_RESOURCE_REQUESTS);
      expect(resources.limits).toEqual(DEFAULT_RESOURCE_LIMITS);
    });

    it('should preserve existing resource limits', () => {
      const pod = createBuildPod({
        containers: [{
          name: 'main',
          image: 'node:20',
          resources: {
            requests: { cpu: '100m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
        }],
      });

      expect(pod.containers[0].resources!.requests.cpu).toBe('100m');
      expect(pod.containers[0].resources!.limits.cpu).toBe('500m');
    });

    it('should accept custom name and namespace', () => {
      const pod = createBuildPod({
        name: 'my-pod',
        namespace: 'custom-ns',
        containers: [{ name: 'main', image: 'node:20' }],
      });

      expect(pod.name).toBe('my-pod');
      expect(pod.namespace).toBe('custom-ns');
    });

    it('should accept optional fields', () => {
      const pod = createBuildPod({
        ...minimalInput,
        runId: 'run-1',
        stageId: 'stage-1',
        taskId: 'task-1',
        cacheMounts: [{
          name: 'cache',
          cacheKey: 'key1',
          mountPath: '/cache',
        }],
      });

      expect(pod.runId).toBe('run-1');
      expect(pod.stageId).toBe('stage-1');
      expect(pod.taskId).toBe('task-1');
      expect(pod.cacheMounts).toHaveLength(1);
    });
  });

  describe('updatePodStatus', () => {
    it('should update status to running and set startedAt', () => {
      const pod = createBuildPod(minimalInput);
      const updated = updatePodStatus(pod, BuildPodStatus.RUNNING);

      expect(updated.status).toBe(BuildPodStatus.RUNNING);
      expect(updated.startedAt).toBeInstanceOf(Date);
    });

    it('should update status to succeeded and set completedAt', () => {
      const pod = createBuildPod(minimalInput);
      const started = updatePodStatus(pod, BuildPodStatus.RUNNING);
      const completed = updatePodStatus(started, BuildPodStatus.SUCCEEDED);

      expect(completed.status).toBe(BuildPodStatus.SUCCEEDED);
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should update status to failed with message', () => {
      const pod = createBuildPod(minimalInput);
      const updated = updatePodStatus(pod, BuildPodStatus.FAILED, {
        message: 'OOM killed',
        reason: 'Evicted',
        exitCode: 137,
      });

      expect(updated.status).toBe(BuildPodStatus.FAILED);
      expect(updated.message).toBe('OOM killed');
      expect(updated.reason).toBe('Evicted');
      expect(updated.exitCode).toBe(137);
    });

    it('should not overwrite startedAt if already set', () => {
      const pod = createBuildPod(minimalInput);
      const running = updatePodStatus(pod, BuildPodStatus.RUNNING);
      const originalStartedAt = running.startedAt;
      const again = updatePodStatus(running, BuildPodStatus.RUNNING);

      expect(again.startedAt).toBe(originalStartedAt);
    });
  });

  describe('isPodTerminal', () => {
    it('should return true for terminal states', () => {
      expect(isPodTerminal(BuildPodStatus.SUCCEEDED)).toBe(true);
      expect(isPodTerminal(BuildPodStatus.FAILED)).toBe(true);
      expect(isPodTerminal(BuildPodStatus.TERMINATED)).toBe(true);
      expect(isPodTerminal(BuildPodStatus.ERROR)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isPodTerminal(BuildPodStatus.PENDING)).toBe(false);
      expect(isPodTerminal(BuildPodStatus.RUNNING)).toBe(false);
      expect(isPodTerminal(BuildPodStatus.UNKNOWN)).toBe(false);
    });
  });

  describe('isPodSuccessful', () => {
    it('should return true only for SUCCEEDED', () => {
      expect(isPodSuccessful(BuildPodStatus.SUCCEEDED)).toBe(true);
    });

    it('should return false for other states', () => {
      expect(isPodSuccessful(BuildPodStatus.FAILED)).toBe(false);
      expect(isPodSuccessful(BuildPodStatus.RUNNING)).toBe(false);
      expect(isPodSuccessful(BuildPodStatus.PENDING)).toBe(false);
    });
  });

  describe('constants', () => {
    it('DEFAULT_RESOURCE_LIMITS should be correct', () => {
      expect(DEFAULT_RESOURCE_LIMITS.cpu).toBe('2000m');
      expect(DEFAULT_RESOURCE_LIMITS.memory).toBe('4Gi');
    });

    it('DEFAULT_RESOURCE_REQUESTS should be correct', () => {
      expect(DEFAULT_RESOURCE_REQUESTS.cpu).toBe('500m');
      expect(DEFAULT_RESOURCE_REQUESTS.memory).toBe('1Gi');
    });
  });
});
