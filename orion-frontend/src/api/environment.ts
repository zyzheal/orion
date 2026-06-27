/**
 * Environment API Service
 * Auto-generated from backend environment-routes.ts
 * Prefix: /v1/environments
 */
import { api } from './client';

export interface Environment {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createEnvironmentEnvironments = async (data?: Partial<Environment>): Promise<Environment> => {
  const response = await api.post<Environment>('/v1/environments/environments', data);
  return response.data;
};

export const listEnvironment = async (params?: Record<string, unknown>): Promise<{ data: Environment[]; total: number }> => {
  const response = await api.get<{ data: Environment[]; total: number }>('/v1/environments/environments', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getEnvironment = async (id: string): Promise<Environment> => {
  const response = await api.get<Environment>('/v1/environments/environments/' + id);
  return response.data;
};

export const updateEnvironment = async (id: string, data: Partial<Environment>): Promise<Environment> => {
  const response = await api.put<Environment>('/v1/environments/environments/' + id, data);
  return response.data;
};

export const deleteEnvironment = async (id: string): Promise<void> => {
  await api.delete('/v1/environments/environments/' + id);
};

export const createEnvironmentEnvironmentsStatus = async (id: string, data?: Partial<Environment>): Promise<Environment> => {
  const response = await api.post<Environment>('/v1/environments/environments/' + id + '/status', data);
  return response.data;
};

export const createEnvironmentEnvironmentsLock = async (id: string, data?: Partial<Environment>): Promise<Environment> => {
  const response = await api.post<Environment>('/v1/environments/environments/' + id + '/lock', data);
  return response.data;
};

export const createEnvironmentEnvironmentsUnlock = async (id: string, data?: Partial<Environment>): Promise<Environment> => {
  const response = await api.post<Environment>('/v1/environments/environments/' + id + '/unlock', data);
  return response.data;
};
