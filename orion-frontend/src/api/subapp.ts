/**
 * Subapp API Service
 * Auto-generated from backend subapp-routes.ts
 * Prefix: /api/v1/subapps
 */
import { api } from './client';

export interface Subapp {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listSubapp = async (params?: Record<string, unknown>): Promise<{ data: Subapp[]; total: number }> => {
  const response = await api.get<{ data: Subapp[]; total: number }>('/api/v1/subapps/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getSubapp = async (key: string): Promise<Subapp> => {
  const response = await api.get<Subapp>('/api/v1/subapps/' + key);
  return response.data;
};

export const createSubapp = async (data?: Partial<Subapp>): Promise<Subapp> => {
  const response = await api.post<Subapp>('/api/v1/subapps/', data);
  return response.data;
};

export const updateSubapp = async (key: string, data: Partial<Subapp>): Promise<Subapp> => {
  const response = await api.put<Subapp>('/api/v1/subapps/' + key, data);
  return response.data;
};

export const deleteSubapp = async (key: string): Promise<void> => {
  await api.delete('/api/v1/subapps/' + key);
};
