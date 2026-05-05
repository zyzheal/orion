/**
 * AI Models API
 * Phase 2 - Model version management
 */

import apiClient from './client';

export interface AIModelVersion {
  id: string;
  tenant_id: string | null;
  name: string;
  model_type: string;
  version: string;
  status: 'registered' | 'testing' | 'active' | 'archived';
  features: string[];
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  created_at: string;
}

export const aiModelsApi = {
  list: async (params?: { type?: string; status?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get('/api/v1/ai/models', { params });
    return response.data;
  },

  get: async (modelId: string) => {
    const response = await apiClient.get(`/api/v1/ai/models/${modelId}`);
    return response.data as AIModelVersion;
  },

  register: async (data: { name: string; model_type: string; version: string; features?: string[] }) => {
    const response = await apiClient.post('/api/v1/ai/models', data);
    return response.data as AIModelVersion;
  },

  activate: async (modelId: string) => {
    const response = await apiClient.post(`/api/v1/ai/models/${modelId}/activate`);
    return response.data;
  },

  configureABTest: async (modelId: string, data: { traffic_percent: number; compare_to_id: string }) => {
    const response = await apiClient.post(`/api/v1/ai/models/${modelId}/ab-test`, data);
    return response.data;
  },

  archive: async (modelId: string) => {
    const response = await apiClient.delete(`/api/v1/ai/models/${modelId}`);
    return response.data;
  },

  compare: async (modelId1: string, modelId2: string) => {
    const response = await apiClient.get(`/api/v1/ai/models/${modelId1}/compare/${modelId2}`);
    return response.data;
  },
};

export default aiModelsApi;