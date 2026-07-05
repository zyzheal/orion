/**
 * PipelineVersion API Service
 * Auto-generated from backend pipeline-version-routes.ts
 * Prefix: /api/v1/pipelines/:pipelineId/versions
 */
import { api } from './client';

export interface PipelineVersion {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const getPipelineVersion = async (pipelineId: string, versionId: string): Promise<PipelineVersion> => {
  const response = await api.get<PipelineVersion>('/api/v1/pipelines/:pipelineId/versions/' + pipelineId + '/versions/' + versionId);
  return response.data;
};

export const createPipelineVersionVersionsRollback = async (pipelineId: string, versionId: string, data?: Partial<PipelineVersion>): Promise<PipelineVersion> => {
  const response = await api.post<PipelineVersion>('/api/v1/pipelines/:pipelineId/versions/' + pipelineId + '/versions/' + versionId + '/rollback', data);
  return response.data;
};

export const createPipelineVersionVersionsTag = async (pipelineId: string, versionId: string, data?: Partial<PipelineVersion>): Promise<PipelineVersion> => {
  const response = await api.post<PipelineVersion>('/api/v1/pipelines/:pipelineId/versions/' + pipelineId + '/versions/' + versionId + '/tag', data);
  return response.data;
};

export const deletePipelineVersion = async (pipelineId: string, versionId: string, tag: string): Promise<void> => {
  await api.delete('/api/v1/pipelines/:pipelineId/versions/' + pipelineId + '/versions/' + versionId + '/tag/' + tag);
};

export const createPipelineVersionVersionsBaseline = async (pipelineId: string, versionId: string, data?: Partial<PipelineVersion>): Promise<PipelineVersion> => {
  const response = await api.post<PipelineVersion>('/api/v1/pipelines/:pipelineId/versions/' + pipelineId + '/versions/' + versionId + '/baseline', data);
  return response.data;
};
