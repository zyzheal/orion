/**
 * Slo API Service
 * Auto-generated from backend slo-routes.ts
 * Prefix: /v1/slo
 */
import { api } from './client';

export interface Slo {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createSloDefinitions = async (data?: Partial<Slo>): Promise<Slo> => {
  const response = await api.post<Slo>('/v1/slo/definitions', data);
  return response.data;
};

export const listSlo = async (params?: Record<string, unknown>): Promise<{ data: Slo[]; total: number }> => {
  const response = await api.get<{ data: Slo[]; total: number }>('/v1/slo/definitions', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getSlo = async (id: string): Promise<Slo> => {
  const response = await api.get<Slo>('/v1/slo/definitions/' + id);
  return response.data;
};

export const updateSlo = async (id: string, data: Partial<Slo>): Promise<Slo> => {
  const response = await api.put<Slo>('/v1/slo/definitions/' + id, data);
  return response.data;
};

export const deleteSlo = async (id: string): Promise<void> => {
  await api.delete('/v1/slo/definitions/' + id);
};

export const createSloMeasurements = async (id: string, data?: Partial<Slo>): Promise<Slo> => {
  const response = await api.post<Slo>('/v1/slo/' + id + '/measurements', data);
  return response.data;
};
