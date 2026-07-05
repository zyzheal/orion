/**
 * EphemeralEnv API Service
 * Auto-generated from backend ephemeral-env-routes.ts
 * Prefix: /api/v1/ephemeral-envs
 */
import { api } from './client';

export interface EphemeralEnv {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listEphemeralEnv = async (params?: Record<string, unknown>): Promise<{ data: EphemeralEnv[]; total: number }> => {
  const response = await api.get<{ data: EphemeralEnv[]; total: number }>('/api/v1/ephemeral-envs/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getEphemeralEnv = async (id: string): Promise<EphemeralEnv> => {
  const response = await api.get<EphemeralEnv>('/api/v1/ephemeral-envs/' + id);
  return response.data;
};

export const createEphemeralEnv = async (data?: Partial<EphemeralEnv>): Promise<EphemeralEnv> => {
  const response = await api.post<EphemeralEnv>('/api/v1/ephemeral-envs/', data);
  return response.data;
};

export const createEphemeralEnvWake = async (id: string, data?: Partial<EphemeralEnv>): Promise<EphemeralEnv> => {
  const response = await api.post<EphemeralEnv>('/api/v1/ephemeral-envs/' + id + '/wake', data);
  return response.data;
};

export const createEphemeralEnvTeardown = async (id: string, data?: Partial<EphemeralEnv>): Promise<EphemeralEnv> => {
  const response = await api.post<EphemeralEnv>('/api/v1/ephemeral-envs/' + id + '/teardown', data);
  return response.data;
};
