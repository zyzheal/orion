/**
 * Project API Service
 * Auto-generated from backend project-routes.ts
 * Prefix: /v1/projects
 */
import { api } from './client';

export interface Project {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listProject = async (params?: Record<string, unknown>): Promise<{ data: Project[]; total: number }> => {
  const response = await api.get<{ data: Project[]; total: number }>('/v1/projects/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await api.get<Project>('/v1/projects/' + id);
  return response.data;
};

export const createProject = async (data?: Partial<Project>): Promise<Project> => {
  const response = await api.post<Project>('/v1/projects/', data);
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await api.delete('/v1/projects/' + id);
};

export const updateProject = async (id: string, data: Partial<Project>): Promise<Project> => {
  const response = await api.put<Project>('/v1/projects/' + id, data);
  return response.data;
};
