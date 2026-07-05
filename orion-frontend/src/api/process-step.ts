/**
 * ProcessStep API Service
 * Auto-generated from backend process-step-routes.ts
 * Prefix: /api/v1/process-steps
 */
import { api } from './client';

export interface ProcessStep {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listProcessStep = async (params?: Record<string, unknown>): Promise<{ data: ProcessStep[]; total: number }> => {
  const response = await api.get<{ data: ProcessStep[]; total: number }>('/api/v1/process-steps/definitions', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createProcessStepDefinitions = async (data?: Partial<ProcessStep>): Promise<ProcessStep> => {
  const response = await api.post<ProcessStep>('/api/v1/process-steps/definitions', data);
  return response.data;
};

export const createProcessStepInstances = async (data?: Partial<ProcessStep>): Promise<ProcessStep> => {
  const response = await api.post<ProcessStep>('/api/v1/process-steps/instances', data);
  return response.data;
};
