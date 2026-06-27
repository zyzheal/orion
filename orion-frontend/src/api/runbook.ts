/**
 * Runbook API Service
 * Auto-generated from backend runbook-routes.ts
 * Prefix: /v1/runbooks
 */
import { api } from './client';

export interface Runbook {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createRunbook = async (data?: Partial<Runbook>): Promise<Runbook> => {
  const response = await api.post<Runbook>('/v1/runbooks/', data);
  return response.data;
};

export const listRunbook = async (params?: Record<string, unknown>): Promise<{ data: Runbook[]; total: number }> => {
  const response = await api.get<{ data: Runbook[]; total: number }>('/v1/runbooks/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getRunbook = async (id: string): Promise<Runbook> => {
  const response = await api.get<Runbook>('/v1/runbooks/' + id);
  return response.data;
};

export const updateRunbook = async (id: string, data: Partial<Runbook>): Promise<Runbook> => {
  const response = await api.put<Runbook>('/v1/runbooks/' + id, data);
  return response.data;
};

export const deleteRunbook = async (id: string): Promise<void> => {
  await api.delete('/v1/runbooks/' + id);
};

export const createRunbookExecute = async (id: string, data?: Partial<Runbook>): Promise<Runbook> => {
  const response = await api.post<Runbook>('/v1/runbooks/' + id + '/execute', data);
  return response.data;
};
