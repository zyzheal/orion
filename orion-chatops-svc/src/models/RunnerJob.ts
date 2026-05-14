/** RunnerJob model */

export type RunnerJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunnerJob {
  id: string;
  runnerId: string;
  taskId: string;
  stageId?: string;
  runId?: string;
  tenantId: string;
  status: RunnerJobStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RunnerJobCreateInput {
  runnerId: string;
  taskId: string;
  stageId?: string;
  runId?: string;
  tenantId: string;
}
