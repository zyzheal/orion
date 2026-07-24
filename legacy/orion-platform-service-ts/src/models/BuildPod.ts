/**
 * Build Pod 数据模型
 *
 * Kubernetes 中执行构建的 Pod 定义
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Pod 状态
 */
export enum BuildPodStatus {
  PENDING = 'Pending',
  RUNNING = 'Running',
  SUCCEEDED = 'Succeeded',
  FAILED = 'Failed',
  UNKNOWN = 'Unknown',
  TERMINATED = 'Terminated',
  ERROR = 'Error',
}

/**
 * 资源限制
 */
export interface ResourceLimits {
  cpu: string;      // e.g., '1000m'
  memory: string;   // e.g., '2Gi'
}

/**
 * 资源请求
 */
export interface ResourceRequests {
  cpu: string;      // e.g., '500m'
  memory: string;   // e.g., '1Gi'
}

/**
 * 容器定义
 */
export interface BuildContainer {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  workingDir?: string;
  resources?: {
    requests?: ResourceRequests;
    limits?: ResourceLimits;
  };
}

/**
 * 缓存挂载配置
 */
export interface CacheMount {
  name: string;           // 挂载名称
  cacheKey: string;       // 缓存键
  mountPath: string;      // 挂载路径
  readOnly?: boolean;     // 是否只读
  subPath?: string;       // 子路径
}

/**
 * 构建 Pod 定义
 */
export interface BuildPod {
  id: string;
  name: string;                   // Pod 名称
  namespace: string;              // K8s Namespace
  runId?: string;                 // 关联的 PipelineRun ID
  stageId?: string;               // 关联的 Stage ID
  taskId?: string;                // 关联的 Task ID
  containers: BuildContainer[];   // 容器列表
  cacheMounts?: CacheMount[];     // 缓存挂载
  status: BuildPodStatus;         // Pod 状态
  nodeName?: string;              // 调度到的节点
  podIp?: string;                 // Pod IP
  message?: string;               // 状态消息
  reason?: string;                // 状态原因
  exitCode?: number;              // 退出码
  resourceUsage?: {
    cpu?: string;
    memory?: string;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

/**
 * 创建 Build Pod 输入
 */
export interface BuildPodCreateInput {
  name?: string;
  namespace?: string;
  runId?: string;
  stageId?: string;
  taskId?: string;
  containers: BuildContainer[];
  cacheMounts?: CacheMount[];
}

/**
 * 默认资源限制
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  cpu: '2000m',
  memory: '4Gi',
};

export const DEFAULT_RESOURCE_REQUESTS: ResourceRequests = {
  cpu: '500m',
  memory: '1Gi',
};

/**
 * 创建 Build Pod
 */
export function createBuildPod(input: BuildPodCreateInput): BuildPod {
  const now = new Date();
  const podName = input.name || `build-${uuidv4().substring(0, 8)}`;

  // 为没有资源的容器添加默认资源限制
  const containers = input.containers.map(container => ({
    ...container,
    resources: container.resources || {
      requests: { ...DEFAULT_RESOURCE_REQUESTS },
      limits: { ...DEFAULT_RESOURCE_LIMITS },
    },
  }));

  return {
    id: uuidv4(),
    name: podName,
    namespace: input.namespace || 'orion-builds',
    runId: input.runId,
    stageId: input.stageId,
    taskId: input.taskId,
    containers,
    cacheMounts: input.cacheMounts,
    status: BuildPodStatus.PENDING,
    createdAt: now,
  };
}

/**
 * 更新 Pod 状态
 */
export function updatePodStatus(
  pod: BuildPod,
  status: BuildPodStatus,
  options?: { message?: string; reason?: string; exitCode?: number }
): BuildPod {
  const now = new Date();
  const updates: Partial<BuildPod> = {
    status,
    message: options?.message,
    reason: options?.reason,
    exitCode: options?.exitCode,
  };

  if (status === BuildPodStatus.RUNNING && !pod.startedAt) {
    updates.startedAt = now;
  }

  if (
    (status === BuildPodStatus.SUCCEEDED ||
     status === BuildPodStatus.FAILED ||
     status === BuildPodStatus.TERMINATED ||
     status === BuildPodStatus.ERROR) &&
    !pod.completedAt
  ) {
    updates.completedAt = now;
    if (pod.startedAt) {
      updates.durationMs = now.getTime() - pod.startedAt.getTime();
    }
  }

  return {
    ...pod,
    ...updates,
  };
}

/**
 * 检查 Pod 是否处于终态
 */
export function isPodTerminal(status: BuildPodStatus): boolean {
  return [
    BuildPodStatus.SUCCEEDED,
    BuildPodStatus.FAILED,
    BuildPodStatus.TERMINATED,
    BuildPodStatus.ERROR,
  ].includes(status);
}

/**
 * 检查 Pod 是否成功
 */
export function isPodSuccessful(status: BuildPodStatus): boolean {
  return status === BuildPodStatus.SUCCEEDED;
}
