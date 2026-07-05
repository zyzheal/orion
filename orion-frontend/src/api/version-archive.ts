/**
 * VersionArchive API Service
 * Auto-generated from backend version-archive-routes.ts
 * Prefix: /api/v1/version-archives
 */
import { api } from './client';

export interface VersionArchive {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createVersionArchive = async (data?: Partial<VersionArchive>): Promise<VersionArchive> => {
  const response = await api.post<VersionArchive>('/api/v1/version-archives/', data);
  return response.data;
};

export const listVersionArchive = async (params?: Record<string, unknown>): Promise<{ data: VersionArchive[]; total: number }> => {
  const response = await api.get<{ data: VersionArchive[]; total: number }>('/api/v1/version-archives/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getVersionArchive = async (id: string): Promise<VersionArchive> => {
  const response = await api.get<VersionArchive>('/api/v1/version-archives/' + id);
  return response.data;
};

export const createVersionArchiveRestore = async (id: string, data?: Partial<VersionArchive>): Promise<VersionArchive> => {
  const response = await api.post<VersionArchive>('/api/v1/version-archives/' + id + '/restore', data);
  return response.data;
};

export const deleteVersionArchive = async (id: string): Promise<void> => {
  await api.delete('/api/v1/version-archives/' + id);
};
