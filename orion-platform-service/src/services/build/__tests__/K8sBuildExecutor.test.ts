/**
 * K8sBuildExecutor 单元测试
 */

import { K8sBuildExecutor } from '../K8sBuildExecutor';
import {
  BuildPodStatus,
  BuildPodCreateInput,
} from '../../../models/BuildPod';

// Mock K8s client for controlled testing
class TestK8sClient {
  private statusMap = new Map<string, string>();

  async createPod(namespace: string, spec: any): Promise<any> {
    const key = `${namespace}/${spec.name}`;
    this.statusMap.set(key, 'Pending');
    return { phase: 'Pending' };
  }

  async getPodStatus(namespace: string, name: string): Promise<any> {
    const key = `${namespace}/${name}`;
    const phase = this.statusMap.get(key) || 'Unknown';
    return { phase };
  }

  async deletePod(namespace: string, name: string): Promise<boolean> {
    const key = `${namespace}/${name}`;
    return this.statusMap.delete(key);
  }

  async getPodLogs(namespace: string, name: string): Promise<string> {
    return `[INFO] Pod ${name} log output\n`;
  }

  watchPod(namespace: string, name: string, callback: (status: any) => void): void {
    // No-op for testing
  }

  // Helper to update pod status for testing
  setPodStatus(namespace: string, name: string, phase: string): void {
    const key = `${namespace}/${name}`;
    this.statusMap.set(key, phase);
  }
}

describe('K8sBuildExecutor', () => {
  let mockK8sClient: TestK8sClient;
  let executor: K8sBuildExecutor;

  beforeEach(() => {
    mockK8sClient = new TestK8sClient();
    executor = new K8sBuildExecutor(mockK8sClient as any);
  });

  describe('createBuildPod', () => {
    it('should create a build pod', async () => {
      const input: BuildPodCreateInput = {
        containers: [
          {
            name: 'build',
            image: 'node:20-slim',
            command: ['npm', 'run', 'build'],
          },
        ],
      };

      const pod = await executor.createBuildPod(input);

      expect(pod).toBeDefined();
      expect(pod.name).toBeDefined();
      expect(pod.namespace).toBe('orion-builds');
      expect(pod.status).toBe(BuildPodStatus.PENDING);
      expect(pod.containers.length).toBe(1);
      expect(pod.containers[0].image).toBe('node:20-slim');
    });

    it('should use custom namespace', async () => {
      const input: BuildPodCreateInput = {
        namespace: 'custom-namespace',
        containers: [
          {
            name: 'build',
            image: 'node:20-slim',
          },
        ],
      };

      const pod = await executor.createBuildPod(input);
      expect(pod.namespace).toBe('custom-namespace');
    });

    it('should associate with run/stage/task', async () => {
      const input: BuildPodCreateInput = {
        runId: 'run-123',
        stageId: 'stage-456',
        taskId: 'task-789',
        containers: [
          {
            name: 'build',
            image: 'node:20-slim',
          },
        ],
      };

      const pod = await executor.createBuildPod(input);
      expect(pod.runId).toBe('run-123');
      expect(pod.stageId).toBe('stage-456');
      expect(pod.taskId).toBe('task-789');
    });

    it('should apply default resource limits', async () => {
      const input: BuildPodCreateInput = {
        containers: [
          {
            name: 'build',
            image: 'node:20-slim',
          },
        ],
      };

      const pod = await executor.createBuildPod(input);
      expect(pod.containers[0].resources).toBeDefined();
      expect(pod.containers[0].resources?.limits).toBeDefined();
      expect(pod.containers[0].resources?.requests).toBeDefined();
    });
  });

  describe('getPodStatus', () => {
    it('should return pod status', async () => {
      const input: BuildPodCreateInput = {
        containers: [{ name: 'build', image: 'node:20-slim' }],
      };

      const pod = await executor.createBuildPod(input);
      const status = await executor.getPodStatus(pod.id);

      expect(status).toBeDefined();
    });

    it('should return null for non-existent pod', async () => {
      const status = await executor.getPodStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('getPodLogs', () => {
    it('should return pod logs', async () => {
      const input: BuildPodCreateInput = {
        containers: [{ name: 'build', image: 'node:20-slim' }],
      };

      const pod = await executor.createBuildPod(input);
      const logs = await executor.getPodLogs(pod.id);

      expect(logs).toBeDefined();
      expect(logs).toContain('Pod');
    });

    it('should throw error for non-existent pod', async () => {
      await expect(executor.getPodLogs('non-existent')).rejects.toThrow(
        "Pod 'non-existent' not found"
      );
    });
  });

  describe('cancelBuild', () => {
    it('should cancel a running build', async () => {
      const input: BuildPodCreateInput = {
        containers: [{ name: 'build', image: 'node:20-slim' }],
      };

      const pod = await executor.createBuildPod(input);
      const cancelled = await executor.cancelBuild(pod.id);

      expect(cancelled).toBe(true);
    });

    it('should return false for non-existent pod', async () => {
      const cancelled = await executor.cancelBuild('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('listPods', () => {
    it('should list all pods', async () => {
      await executor.createBuildPod({
        containers: [{ name: 'build1', image: 'node:20-slim' }],
      });
      await executor.createBuildPod({
        containers: [{ name: 'build2', image: 'python:3.12' }],
      });

      const pods = await executor.listPods();
      expect(pods.length).toBe(2);
    });

    it('should filter by runId', async () => {
      await executor.createBuildPod({
        runId: 'run-1',
        containers: [{ name: 'build1', image: 'node:20-slim' }],
      });
      await executor.createBuildPod({
        runId: 'run-2',
        containers: [{ name: 'build2', image: 'python:3.12' }],
      });

      const pods = await executor.listPods({ runId: 'run-1' });
      expect(pods.length).toBe(1);
      expect(pods[0].runId).toBe('run-1');
    });

    it('should filter by status', async () => {
      await executor.createBuildPod({
        containers: [{ name: 'build', image: 'node:20-slim' }],
      });

      const pending = await executor.listPods({ status: BuildPodStatus.PENDING });
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination', async () => {
      await executor.createBuildPod({
        containers: [{ name: 'build1', image: 'node:20-slim' }],
      });
      await executor.createBuildPod({
        containers: [{ name: 'build2', image: 'node:20-slim' }],
      });

      const pods = await executor.listPods({ limit: 1 });
      expect(pods.length).toBeLessThanOrEqual(1);
    });
  });

  describe('cache mounts', () => {
    it('should create pod with cache mounts', async () => {
      const input: BuildPodCreateInput = {
        containers: [{ name: 'build', image: 'node:20-slim' }],
        cacheMounts: [
          {
            name: 'node-modules',
            cacheKey: 'cache-abc123',
            mountPath: '/app/node_modules',
          },
        ],
      };

      const pod = await executor.createBuildPod(input);
      expect(pod.cacheMounts).toBeDefined();
      expect(pod.cacheMounts?.length).toBe(1);
      expect(pod.cacheMounts?.[0].mountPath).toBe('/app/node_modules');
    });
  });
});
