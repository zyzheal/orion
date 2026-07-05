/**
 * Sprint API Service
 * Auto-generated from backend sprint-routes.ts
 * Prefix: /api/v1/sprints
 */
import { api } from './client';

export interface Sprint {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listSprint = async (params?: Record<string, unknown>): Promise<{ data: Sprint[]; total: number }> => {
  const response = await api.get<{ data: Sprint[]; total: number }>('/api/v1/sprints/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createSprint = async (data?: Partial<Sprint>): Promise<Sprint> => {
  const response = await api.post<Sprint>('/api/v1/sprints/', data);
  return response.data;
};

export const getSprint = async (id: string): Promise<Sprint> => {
  const response = await api.get<Sprint>('/api/v1/sprints/' + id);
  return response.data;
};

export const updateSprint = async (id: string, data: Partial<Sprint>): Promise<Sprint> => {
  const response = await api.put<Sprint>('/api/v1/sprints/' + id, data);
  return response.data;
};

export const deleteSprint = async (id: string): Promise<void> => {
  await api.delete('/api/v1/sprints/' + id);
};

export const createSprintTickets = async (id: string, data?: Partial<Sprint>): Promise<Sprint> => {
  const response = await api.post<Sprint>('/api/v1/sprints/' + id + '/tickets', data);
  return response.data;
};
