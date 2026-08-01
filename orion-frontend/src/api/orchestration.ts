/**
 * Cross-Domain Orchestration API
 * Phase 3 - Cross-domain orchestration flows, execution control
 */
import apiClient from './client';

export interface OrchestrationFlow {
  id: string;
  name: string;
  description: string;
  domains: string[];
  steps: OrchestrationStep[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'aborted' | 'failed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestrationStep {
  id: string;
  name: string;
  domain: string;
  action: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface CreateOrchestrationInput {
  name: string;
  description: string;
  domains: string[];
  steps: { name: string; domain: string; action: string; config: Record<string, unknown>; dependsOn?: string[] }[];
}

export const orchestrationApi = {
  create: async (data: CreateOrchestrationInput) => {
    const response = await apiClient.post('/api/v1/orchestration', data);
    return response.data as OrchestrationFlow;
  },

  list: async (params?: { status?: string; domain?: string }) => {
    const response = await apiClient.get('/api/v1/orchestration', { params });
    return response.data as OrchestrationFlow[];
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/api/v1/orchestration/${id}`);
    return response.data as OrchestrationFlow;
  },

  execute: async (id: string) => {
    const response = await apiClient.post(`/api/v1/orchestration/${id}/execute`);
    return response.data as OrchestrationFlow;
  },

  pause: async (id: string) => {
    const response = await apiClient.post(`/api/v1/orchestration/${id}/pause`);
    return response.data as OrchestrationFlow;
  },

  resume: async (id: string) => {
    const response = await apiClient.post(`/api/v1/orchestration/${id}/resume`);
    return response.data as OrchestrationFlow;
  },

  abort: async (id: string) => {
    const response = await apiClient.post(`/api/v1/orchestration/${id}/abort`);
    return response.data as OrchestrationFlow;
  },
};

export default orchestrationApi;
