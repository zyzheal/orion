/**
 * PipelineExecutionControl API Service
 * Auto-generated from backend pipeline-execution-control-routes.ts
 * Prefix: /api/v1/pipelines
 */
import { api } from './client';

export interface PipelineExecutionControl {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createPipelineExecutionControlPipelinesRunsPause = async (runId: string, data?: Partial<PipelineExecutionControl>): Promise<PipelineExecutionControl> => {
  const response = await api.post<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/pause', data);
  return response.data;
};

export const createPipelineExecutionControlPipelinesRunsResume = async (runId: string, data?: Partial<PipelineExecutionControl>): Promise<PipelineExecutionControl> => {
  const response = await api.post<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/resume', data);
  return response.data;
};

export const createPipelineExecutionControlPipelinesRunsAbort = async (runId: string, data?: Partial<PipelineExecutionControl>): Promise<PipelineExecutionControl> => {
  const response = await api.post<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/abort', data);
  return response.data;
};

export const createPipelineExecutionControlPipelinesRunsRetry = async (runId: string, data?: Partial<PipelineExecutionControl>): Promise<PipelineExecutionControl> => {
  const response = await api.post<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/retry', data);
  return response.data;
};

export const createPipelineExecutionControlPipelinesRunsRestart = async (runId: string, data?: Partial<PipelineExecutionControl>): Promise<PipelineExecutionControl> => {
  const response = await api.post<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/restart', data);
  return response.data;
};

export const getPipelineExecutionControlPipelinesRunsCheckpoints = async (runId: string): Promise<PipelineExecutionControl> => {
  const response = await api.get<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/checkpoints');
  return response.data;
};

export const getPipelineExecutionControlPipelinesRunsControlLogs = async (runId: string): Promise<PipelineExecutionControl> => {
  const response = await api.get<PipelineExecutionControl>('/api/v1/pipelines/pipelines/runs/' + runId + '/control-logs');
  return response.data;
};
