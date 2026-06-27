/**
 * Deploy API Service
 * Auto-generated from backend deploy-routes.ts
 * Prefix: /v1/deploy
 */
import { api } from './client';

export interface Deploy {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createDeployDeploy = async (data?: Partial<Deploy>): Promise<Deploy> => {
  const response = await api.post<Deploy>('/v1/deploy/deploy', data);
  return response.data;
};

export const getDeploy = async (id: string): Promise<Deploy> => {
  const response = await api.get<Deploy>('/v1/deploy/deploy/' + id);
  return response.data;
};

export const listDeploy = async (params?: Record<string, unknown>): Promise<{ data: Deploy[]; total: number }> => {
  const response = await api.get<{ data: Deploy[]; total: number }>('/v1/deploy/deploy/history', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createDeployDeployRollback = async (id: string, data?: Partial<Deploy>): Promise<Deploy> => {
  const response = await api.post<Deploy>('/v1/deploy/deploy/' + id + '/rollback', data);
  return response.data;
};

export const createDeployDeployCancel = async (id: string, data?: Partial<Deploy>): Promise<Deploy> => {
  const response = await api.post<Deploy>('/v1/deploy/deploy/' + id + '/cancel', data);
  return response.data;
};
