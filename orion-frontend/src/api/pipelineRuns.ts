/**
 * Pipeline Runs API Service
 * Global pipeline run listing and retry operations
 */
import { api } from './client';

/** Summary type for pipeline run list view */
export interface PipelineRunSummary {
  id: string;
  pipelineId: string;
  pipelineVersion?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  triggerType: 'manual' | 'push' | 'schedule' | 'api';
  triggerBy?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number | string; // 后端返回字符串，前端需兼容
  createdAt: string;
}

export interface PipelineRunListResponse {
  data: PipelineRunSummary[];
  total: number;
}

export interface GetAllPipelineRunsParams {
  pipelineId?: string;
  status?: string;
  triggerType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all pipeline runs (across all pipelines)
 * Maps to GET /v1/pipeline-runs
 */
export function getAllPipelineRuns(params?: GetAllPipelineRunsParams) {
  return api.get<PipelineRunListResponse>('/v1/pipeline-runs', { params });
}

/**
 * Retry a pipeline run
 * Maps to POST /v1/pipeline-runs/:id/retry
 */
export function retryPipelineRun(
  runId: string,
  options?: { fromStage?: string; onlyFailed?: boolean }
) {
  return api.post(`/v1/pipeline-runs/${runId}/retry`, null, { params: options });
}

/**
 * Cancel a pipeline run
 * Maps to POST /v1/pipeline-runs/:id/cancel
 */
export function cancelPipelineRun(runId: string) {
  return api.post(`/v1/pipeline-runs/${runId}/cancel`);
}

/**
 * Get pipeline run detail with stages and tasks
 * Maps to GET /v1/pipeline-runs/:id
 */
export function getPipelineRunDetail(runId: string) {
  return api.get(`/v1/pipeline-runs/${runId}`);
}

/**
 * Retry a pipeline run from a specific stage (retry-from-stage)
 * Maps to POST /v1/pipeline-runs/:id/retry?fromStage=stageId
 */
export function retryFromStage(runId: string, stageId: string) {
  return api.post(`/v1/pipeline-runs/${runId}/retry`, null, {
    params: { fromStage: stageId },
  });
}

/**
 * Get stages for a pipeline run
 * Maps to GET /v1/pipeline-runs/:id/stages
 */
export function getPipelineRunStages(runId: string) {
  return api.get(`/v1/pipeline-runs/${runId}/stages`);
}
