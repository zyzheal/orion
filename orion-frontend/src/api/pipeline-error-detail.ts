/**
 * PipelineErrorDetail API Service
 * Auto-generated from backend pipeline-error-detail-routes.ts
 * Prefix: /api/v1/pipelines
 */
import { api } from './client';

export interface PipelineErrorDetail {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const getPipelineErrorDetail = async (runId: string): Promise<PipelineErrorDetail> => {
  const response = await api.get<PipelineErrorDetail>('/api/v1/pipelines/' + runId + '/error-detail');
  return response.data;
};
