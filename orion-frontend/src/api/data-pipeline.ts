/**
 * Data Pipeline API
 * Phase 4 - Data pipeline creation, execution, scheduling, lineage
 */
import apiClient from './client';

export interface DataPipeline {
  id: string;
  name: string;
  description: string;
  source: { type: string; config: Record<string, unknown> };
  destination: { type: string; config: Record<string, unknown> };
  transforms: string[];
  schedule?: string;
  status: 'active' | 'inactive' | 'running' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStatus {
  pipelineId: string;
  lastRunId?: string;
  lastRunStatus: 'success' | 'failed' | 'running' | 'pending';
  lastRunAt?: string;
  nextRunAt?: string;
  totalRuns: number;
  successRate: number;
}

export interface DataLineage {
  pipelineId: string;
  nodes: { id: string; name: string; type: 'source' | 'transform' | 'destination' }[];
  edges: { from: string; to: string; dataType: string }[];
}

export const dataPipelineApi = {
  createPipeline: async (data: {
    name: string;
    description: string;
    source: { type: string; config: Record<string, unknown> };
    destination: { type: string; config: Record<string, unknown> };
    transforms?: string[];
  }) => {
    const response = await apiClient.post('/api/v1/data-pipelines', data);
    return response.data as DataPipeline;
  },

  listPipelines: async (params?: { status?: string }) => {
    const response = await apiClient.get('/api/v1/data-pipelines', { params });
    return response.data as DataPipeline[];
  },

  executePipeline: async (pipelineId: string) => {
    const response = await apiClient.post(`/api/v1/data-pipelines/${pipelineId}/execute`);
    return response.data;
  },

  schedulePipeline: async (pipelineId: string, data: { schedule: string }) => {
    const response = await apiClient.post(`/api/v1/data-pipelines/${pipelineId}/schedule`, data);
    return response.data;
  },

  getPipelineStatus: async (pipelineId: string) => {
    const response = await apiClient.get(`/api/v1/data-pipelines/${pipelineId}/status`);
    return response.data as PipelineStatus;
  },

  getDataLineage: async (pipelineId: string) => {
    const response = await apiClient.get(`/api/v1/data-pipelines/${pipelineId}/lineage`);
    return response.data as DataLineage;
  },
};

export default dataPipelineApi;
