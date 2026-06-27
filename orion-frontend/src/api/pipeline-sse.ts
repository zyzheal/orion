/**
 * PipelineSse API Service
 * Auto-generated from backend pipeline-sse-routes.ts
 * Prefix: /v1/pipelines
 */
import { api } from './client';

export interface PipelineSse {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listPipelineSse = async (params?: Record<string, unknown>): Promise<{ data: PipelineSse[]; total: number }> => {
  const response = await api.get<{ data: PipelineSse[]; total: number }>('/v1/pipelines/pipelines/sse/logs', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createPipelineSsePipelinesSsePublishLog = async (data?: Partial<PipelineSse>): Promise<PipelineSse> => {
  const response = await api.post<PipelineSse>('/v1/pipelines/pipelines/sse/publish/log', data);
  return response.data;
};

export const createPipelineSsePipelinesSsePublishStatus = async (data?: Partial<PipelineSse>): Promise<PipelineSse> => {
  const response = await api.post<PipelineSse>('/v1/pipelines/pipelines/sse/publish/status', data);
  return response.data;
};
