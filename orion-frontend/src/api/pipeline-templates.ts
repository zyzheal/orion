/**
 * Pipeline Templates API
 * Phase 1 - Template library management
 */

import apiClient from './client';

export interface PipelineTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  yaml_definition: string;
  version: number;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: string | number | boolean | string[];
  required: boolean;
}

export const pipelineTemplatesApi = {
  list: async (params?: { category?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get('/api/v1/pipeline-templates', { params });
    return response.data;
  },

  get: async (templateId: string) => {
    const response = await apiClient.get(`/api/v1/pipeline-templates/${templateId}`);
    return response.data as PipelineTemplate;
  },

  create: async (data: { name: string; description?: string; category?: string; yaml_definition: string; tags?: string[] }) => {
    const response = await apiClient.post('/api/v1/pipeline-templates', data);
    return response.data as PipelineTemplate;
  },

  update: async (templateId: string, data: Partial<PipelineTemplate>) => {
    const response = await apiClient.put(`/api/v1/pipeline-templates/${templateId}`, data);
    return response.data as PipelineTemplate;
  },

  delete: async (templateId: string) => {
    const response = await apiClient.delete(`/api/v1/pipeline-templates/${templateId}`);
    return response.data;
  },

  instantiate: async (templateId: string, data: { name: string; tenant_id?: string; project_id?: string; params?: Record<string, unknown> }) => {
    const response = await apiClient.post(`/api/v1/pipeline-templates/${templateId}/instantiate`, data);
    return response.data;
  },

  saveFromPipeline: async (pipelineId: string, data: { name: string; description?: string; category?: string }) => {
    const response = await apiClient.post('/api/v1/pipeline-templates', { ...data, pipelineId });
    return response.data as PipelineTemplate;
  },
};

export default pipelineTemplatesApi;