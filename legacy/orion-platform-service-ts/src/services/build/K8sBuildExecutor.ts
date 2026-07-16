/**
 * K8s Build Executor - Kubernetes 构建执行服务
 *
 * 职责：
 * - 在 Kubernetes 中创建 Build Pod
 * - 配置资源限制
 * - 挂载构建缓存
 * - 监控 Pod 状态
 * - 清理完成 Pod
 */

import {
  BuildPod,
  BuildPodStatus,
  BuildPodCreateInput,
  BuildContainer,
  CacheMount,
  createBuildPod,
  updatePodStatus,
  isPodTerminal,
  isPodSuccessful,
} from '../../models/BuildPod';
import { BuildLog, createBuildLog, appendLogEntry } from '../../models/BuildLog';
import { BuildCacheService } from './BuildCacheService';
import { BuilderImageService } from './BuilderImageService';
import { OrionError, ErrorCode } from '../../errors';

/**
 * K8s 客户端接口
 *
 * 生产环境应使用 @kubernetes/client-node 实现
 * 此处使用模拟实现
 */
export interface K8sClient {
  /** 创建 Pod */
  createPod(namespace: string, spec: K8sPodSpec): Promise<K8sPodStatus>;
  /** 获取 Pod 状态 */
  getPodStatus(namespace: string, name: string): Promise<K8sPodStatus>;
  /** 删除 Pod */
  deletePod(namespace: string, name: string): Promise<boolean>;
  /** 获取 Pod 日志 */
  getPodLogs(namespace: string, name: string, container?: string): Promise<string>;
  /** 监控 Pod 状态变化 */
  watchPod(namespace: string, name: string, callback: (status: K8sPodStatus) => void): void;
}

/**
 * K8s Pod 规格
 */
export interface K8sPodSpec {
  name: string;
  namespace: string;
  containers: Array<{
    name: string;
    image: string;
    command?: string[];
    args?: string[];
    env?: Array<{ name: string; value: string }>;
    resources?: {
      requests?: { cpu?: string; memory?: string; 'nvidia.com/gpu'?: string };
      limits?: { cpu?: string; memory?: string; 'nvidia.com/gpu'?: string };
    };
    volumeMounts?: Array<{
      name: string;
      mountPath: string;
      readOnly?: boolean;
      subPath?: string;
    }>;
  }>;
  volumes?: Array<{
    name: string;
    type: string;
    path?: string;
    claimName?: string;
  }>;
}

/**
 * K8s Pod 状态
 */
export interface K8sPodStatus {
  phase: string;
  nodeName?: string;
  podIp?: string;
  message?: string;
  reason?: string;
  containerStatuses?: Array<{
    name: string;
    ready: boolean;
    state?: {
      waiting?: { reason: string; message?: string };
      running?: { startedAt: string };
      terminated?: { exitCode: number; reason: string; finishedAt: string };
    };
  }>;
}

/**
 * 模拟 K8s 客户端实现
 */
class MockK8sClient implements K8sClient {
  private pods = new Map<string, K8sPodStatus>();
  private logs = new Map<string, string>();
  private watchers = new Map<string, Array<(status: K8sPodStatus) => void>>();

  async createPod(namespace: string, spec: K8sPodSpec): Promise<K8sPodStatus> {
    const key = `${namespace}/${spec.name}`;
    const status: K8sPodStatus = {
      phase: 'Pending',
      message: 'Pod created',
    };
    this.pods.set(key, status);
    this.logs.set(key, `[INFO] Pod ${spec.name} created in namespace ${namespace}\n`);

    // 模拟 Pod 启动
    setTimeout(() => {
      const running: K8sPodStatus = {
        phase: 'Running',
        nodeName: 'mock-node-1',
        podIp: '10.0.0.1',
        message: 'Pod is running',
        containerStatuses: spec.containers.map(c => ({
          name: c.name,
          ready: true,
          state: {
            running: { startedAt: new Date().toISOString() },
          },
        })),
      };
      this.pods.set(key, running);
      this.logs.set(
        key,
        this.logs.get(key) + `[INFO] Pod ${spec.name} is now running\n`
      );
      this.notifyWatchers(key, running);
    }, 500);

    // 模拟 Pod 完成
    setTimeout(() => {
      const completed: K8sPodStatus = {
        phase: 'Succeeded',
        nodeName: 'mock-node-1',
        podIp: '10.0.0.1',
        message: 'Pod completed successfully',
        containerStatuses: spec.containers.map(c => ({
          name: c.name,
          ready: false,
          state: {
            terminated: {
              exitCode: 0,
              reason: 'Completed',
              finishedAt: new Date().toISOString(),
            },
          },
        })),
      };
      this.pods.set(key, completed);
      this.logs.set(
        key,
        this.logs.get(key) +
          `[INFO] Container ${spec.containers[0]?.name || 'main'} completed\n` +
          `[INFO] Build completed successfully\n`
      );
      this.notifyWatchers(key, completed);
    }, 2000);

    return status;
  }

  async getPodStatus(namespace: string, name: string): Promise<K8sPodStatus> {
    const key = `${namespace}/${name}`;
    return (
      this.pods.get(key) || {
        phase: 'Unknown',
        message: 'Pod not found',
      }
    );
  }

  async deletePod(namespace: string, name: string): Promise<boolean> {
    const key = `${namespace}/${name}`;
    const deleted = this.pods.delete(key);
    this.logs.delete(key);
    this.watchers.delete(key);
    return deleted;
  }

  async getPodLogs(
    namespace: string,
    name: string,
    container?: string
  ): Promise<string> {
    const key = `${namespace}/${name}`;
    return this.logs.get(key) || '';
  }

  watchPod(
    namespace: string,
    name: string,
    callback: (status: K8sPodStatus) => void
  ): void {
    const key = `${namespace}/${name}`;
    const watchers = this.watchers.get(key) || [];
    watchers.push(callback);
    this.watchers.set(key, watchers);
  }

  private notifyWatchers(key: string, status: K8sPodStatus): void {
    const watchers = this.watchers.get(key) || [];
    for (const cb of watchers) {
      cb(status);
    }
  }
}

/**
 * K8s 构建执行服务
 */
export class K8sBuildExecutor {
  private k8sClient: K8sClient;
  private cacheService?: BuildCacheService;
  private imageService: BuilderImageService;
  private pods: Map<string, BuildPod>;

  constructor(
    k8sClient?: K8sClient,
    cacheService?: BuildCacheService,
    imageService?: BuilderImageService
  ) {
    this.k8sClient = k8sClient || new MockK8sClient();
    this.cacheService = cacheService; // Optional, caller must provide if needed
    this.imageService = imageService || new BuilderImageService();
    this.pods = new Map();
  }

  /**
   * 创建并启动构建 Pod
   */
  async createBuildPod(input: BuildPodCreateInput): Promise<BuildPod> {
    const pod = createBuildPod(input);

    // 构建 K8s Pod 规格
    const k8sSpec = this.buildK8sPodSpec(pod);

    // 创建 K8s Pod
    await this.k8sClient.createPod(pod.namespace, k8sSpec);

    // 设置 watcher
    this.k8sClient.watchPod(pod.namespace, pod.name, async (k8sStatus) => {
      await this.updatePodFromK8s(pod.id, k8sStatus);
    });

    // 保存 Pod 记录
    this.pods.set(pod.id, pod);

    return pod;
  }

  /**
   * 构建 K8s Pod 规格
   */
  private buildK8sPodSpec(pod: BuildPod): K8sPodSpec {
    const volumes: K8sPodSpec['volumes'] = [];
    const volumeMounts: NonNullable<K8sPodSpec['containers'][0]['volumeMounts']> = [];

    // 处理缓存挂载
    if (pod.cacheMounts) {
      for (const mount of pod.cacheMounts) {
        volumes.push({
          name: `cache-${mount.name}`,
          type: 'persistentVolumeClaim',
          claimName: `cache-${mount.cacheKey}`,
        });
        volumeMounts.push({
          name: `cache-${mount.name}`,
          mountPath: mount.mountPath,
          readOnly: mount.readOnly,
          subPath: mount.subPath,
        });
      }
    }

    return {
      name: pod.name,
      namespace: pod.namespace,
      containers: pod.containers.map(container => ({
        name: container.name,
        image: container.image,
        command: container.command,
        args: container.args,
        env: container.env
          ? Object.entries(container.env).map(([k, v]) => ({ name: k, value: v }))
          : undefined,
        resources: container.resources,
        volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined,
      })),
      volumes: volumes.length > 0 ? volumes : undefined,
    };
  }

  /**
   * 从 K8s 状态更新 Pod
   */
  private async updatePodFromK8s(podId: string, k8sStatus: K8sPodStatus): Promise<void> {
    const pod = this.pods.get(podId);
    if (!pod) return;

    let newStatus: BuildPodStatus;
    switch (k8sStatus.phase) {
      case 'Pending':
        newStatus = BuildPodStatus.PENDING;
        break;
      case 'Running':
        newStatus = BuildPodStatus.RUNNING;
        break;
      case 'Succeeded':
        newStatus = BuildPodStatus.SUCCEEDED;
        break;
      case 'Failed':
        newStatus = BuildPodStatus.FAILED;
        break;
      case 'Unknown':
      default:
        newStatus = BuildPodStatus.UNKNOWN;
        break;
    }

    const exitCode = k8sStatus.containerStatuses?.[0]?.state?.terminated?.exitCode;
    const reason = k8sStatus.containerStatuses?.[0]?.state?.terminated?.reason;

    const updated = updatePodStatus(pod, newStatus, {
      message: k8sStatus.message,
      reason,
      exitCode,
    });

    updated.nodeName = k8sStatus.nodeName;
    updated.podIp = k8sStatus.podIp;

    this.pods.set(podId, updated);
  }

  /**
   * 获取 Pod 状态
   */
  async getPodStatus(podId: string): Promise<BuildPod | null> {
    const pod = this.pods.get(podId);
    if (!pod) return null;

    // 从 K8s 获取最新状态
    try {
      const k8sStatus = await this.k8sClient.getPodStatus(pod.namespace, pod.name);
      await this.updatePodFromK8s(podId, k8sStatus);
      return this.pods.get(podId) || null;
    } catch {
      return pod;
    }
  }

  /**
   * 获取 Pod 日志
   */
  async getPodLogs(podId: string, containerName?: string): Promise<string> {
    const pod = this.pods.get(podId);
    if (!pod) {
      throw new OrionError(`Pod '${podId}' not found`, ErrorCode.NOT_FOUND);
    }

    return this.k8sClient.getPodLogs(pod.namespace, pod.name, containerName);
  }

  /**
   * 取消构建（终止 Pod）
   */
  async cancelBuild(podId: string): Promise<boolean> {
    const pod = this.pods.get(podId);
    if (!pod) return false;

    if (isPodTerminal(pod.status)) {
      return false;
    }

    await this.k8sClient.deletePod(pod.namespace, pod.name);

    const updated = updatePodStatus(pod, BuildPodStatus.TERMINATED, {
      message: 'Build cancelled by user',
      reason: 'Cancelled',
    });
    this.pods.set(podId, updated);
    return true;
  }

  /**
   * 清理完成的 Pod
   *
   * @param olderThan 清理多久之前完成的 Pod（毫秒）
   * @returns 清理的数量
   */
  async cleanupCompletedPods(olderThanMs: number = 3600000): Promise<number> {
    const now = Date.now();
    let count = 0;

    for (const [id, pod] of this.pods.entries()) {
      if (isPodTerminal(pod.status) && pod.completedAt) {
        const age = now - pod.completedAt.getTime();
        if (age > olderThanMs) {
          try {
            await this.k8sClient.deletePod(pod.namespace, pod.name);
            this.pods.delete(id);
            count++;
          } catch {
            // 忽略删除失败
          }
        }
      }
    }

    return count;
  }

  /**
   * 查询构建 Pod 列表
   */
  async listPods(options?: {
    runId?: string;
    stageId?: string;
    taskId?: string;
    status?: BuildPodStatus;
    limit?: number;
    offset?: number;
  }): Promise<BuildPod[]> {
    let result = Array.from(this.pods.values());

    if (options?.runId) {
      result = result.filter(p => p.runId === options.runId);
    }
    if (options?.stageId) {
      result = result.filter(p => p.stageId === options.stageId);
    }
    if (options?.taskId) {
      result = result.filter(p => p.taskId === options.taskId);
    }
    if (options?.status) {
      result = result.filter(p => p.status === options.status);
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }
}

export const k8sBuildExecutor = new K8sBuildExecutor();
