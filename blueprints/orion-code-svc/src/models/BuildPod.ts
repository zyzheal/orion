/**
 * Build Pod Models - K8s 构建 Pod 数据模型
 */

export enum BuildPodStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  TERMINATED = 'terminated',
  UNKNOWN = 'unknown',
}

export interface BuildContainer {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
}

export interface CacheMount {
  name: string;
  cacheKey: string;
  mountPath: string;
  readOnly?: boolean;
  subPath?: string;
}

export interface BuildPod {
  id: string;
  name: string;
  namespace: string;
  runId?: string;
  stageId?: string;
  taskId?: string;
  status: BuildPodStatus;
  containers: BuildContainer[];
  cacheMounts?: CacheMount[];
  nodeName?: string;
  podIp?: string;
  exitCode?: number;
  reason?: string;
  message?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface BuildPodCreateInput {
  name?: string;
  namespace?: string;
  runId?: string;
  stageId?: string;
  taskId?: string;
  containers: BuildContainer[];
  cacheMounts?: CacheMount[];
}

export function createBuildPod(input: BuildPodCreateInput): BuildPod {
  const now = new Date();
  return {
    id: `pod-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: input.name || `build-pod-${Date.now()}`,
    namespace: input.namespace || 'default',
    runId: input.runId,
    stageId: input.stageId,
    taskId: input.taskId,
    status: BuildPodStatus.PENDING,
    containers: input.containers,
    cacheMounts: input.cacheMounts,
    createdAt: now,
  };
}

export function updatePodStatus(
  pod: BuildPod,
  status: BuildPodStatus,
  options?: { message?: string; reason?: string; exitCode?: number }
): BuildPod {
  const updated: BuildPod = {
    ...pod,
    status,
    message: options?.message ?? pod.message,
    reason: options?.reason ?? pod.reason,
    exitCode: options?.exitCode ?? pod.exitCode,
  };

  if (status === BuildPodStatus.RUNNING && !pod.startedAt) {
    updated.startedAt = new Date();
  }

  const terminalStatuses = [
    BuildPodStatus.SUCCEEDED,
    BuildPodStatus.FAILED,
    BuildPodStatus.TERMINATED,
  ];
  if (terminalStatuses.includes(status) && !pod.completedAt) {
    updated.completedAt = new Date();
  }

  return updated;
}

export function isPodTerminal(status: BuildPodStatus): boolean {
  return (
    status === BuildPodStatus.SUCCEEDED ||
    status === BuildPodStatus.FAILED ||
    status === BuildPodStatus.TERMINATED
  );
}

export function isPodSuccessful(status: BuildPodStatus): boolean {
  return status === BuildPodStatus.SUCCEEDED;
}
