/**
 * PipelineBatch API Service
 * Auto-generated from backend pipeline-batch-routes.ts
 * Prefix: /api/v1/pipeline/phase-groups
 */
import { api } from './client';

export interface PipelineBatch {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createPipelineBatchPipelinePhaseGroups = async (data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups', data);
  return response.data;
};

export const listPipelineBatch = async (params?: Record<string, unknown>): Promise<{ data: PipelineBatch[]; total: number }> => {
  const response = await api.get<{ data: PipelineBatch[]; total: number }>('/api/v1/pipeline/phase-groups/pipeline/phase-groups', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getPipelineBatch = async (id: string): Promise<PipelineBatch> => {
  const response = await api.get<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id);
  return response.data;
};

export const updatePipelineBatch = async (id: string, data: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.put<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id, data);
  return response.data;
};

export const deletePipelineBatch = async (id: string): Promise<void> => {
  await api.delete('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id);
};

export const createPipelineBatchPipelinePhaseGroupsExecute = async (id: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/execute', data);
  return response.data;
};

export const createPipelineBatchPipelinePhaseGroupsPause = async (id: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/pause', data);
  return response.data;
};

export const createPipelineBatchPipelinePhaseGroupsResume = async (id: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/resume', data);
  return response.data;
};

export const createPipelineBatchPipelinePhaseGroupsAdvance = async (id: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/advance', data);
  return response.data;
};

export const createPipelineBatchPipelinePhaseGroupsRollback = async (id: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/rollback', data);
  return response.data;
};

export const getPipelineBatchPipelinePhaseGroupsBatches = async (id: string): Promise<PipelineBatch> => {
  const response = await api.get<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/batches');
  return response.data;
};

export const createPipelineBatchPipelinePhaseGroupsBatchesComplete = async (id: string, batchId: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/batches/' + batchId + '/complete', data);
  return response.data;
};

export const createPipelineBatchPipelinePhaseGroupsBatchesFail = async (id: string, batchId: string, data?: Partial<PipelineBatch>): Promise<PipelineBatch> => {
  const response = await api.post<PipelineBatch>('/api/v1/pipeline/phase-groups/pipeline/phase-groups/' + id + '/batches/' + batchId + '/fail', data);
  return response.data;
};
