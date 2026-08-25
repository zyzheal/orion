/**
 * PipelineTemplate API Service
 * Auto-generated from backend pipeline-template-routes.ts
 * Prefix: /pipeline-templates
 */
import { api } from './client';

export interface PipelineTemplate {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listPipelineTemplate = async (
  params?: Record<string, unknown>
): Promise<{ data: PipelineTemplate[]; total: number }> => {
  const response = await api.get<{ data: PipelineTemplate[]; total: number }>(
    '/pipeline-templates/',
    { params }
  );
  return { data: response.data.data, total: response.data.total };
};

export const getPipelineTemplate = async (templateId: string): Promise<PipelineTemplate> => {
  const response = await api.get<PipelineTemplate>('/pipeline-templates/' + templateId);
  return response.data;
};

export const createPipelineTemplate = async (
  data?: Partial<PipelineTemplate>
): Promise<PipelineTemplate> => {
  const response = await api.post<PipelineTemplate>('/pipeline-templates/', data);
  return response.data;
};

export const updatePipelineTemplate = async (
  templateId: string,
  data: Partial<PipelineTemplate>
): Promise<PipelineTemplate> => {
  const response = await api.put<PipelineTemplate>(
    '/pipeline-templates/' + templateId,
    data
  );
  return response.data;
};

export const deletePipelineTemplate = async (templateId: string): Promise<void> => {
  await api.delete('/pipeline-templates/' + templateId);
};

export const createPipelineTemplateInstantiate = async (
  templateId: string,
  data?: Partial<PipelineTemplate>
): Promise<PipelineTemplate> => {
  const response = await api.post<PipelineTemplate>(
    '/pipeline-templates/' + templateId + '/instantiate',
    data
  );
  return response.data;
};
