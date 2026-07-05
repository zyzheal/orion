/**
 * CiType API Service
 * Auto-generated from backend ci-type-routes.ts
 * Prefix: /api/v1/ci-types
 */
import { api } from './client';

export interface CiType {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listCiType = async (params?: Record<string, unknown>): Promise<{ data: CiType[]; total: number }> => {
  const response = await api.get<{ data: CiType[]; total: number }>('/api/v1/ci-types/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createCiType = async (data?: Partial<CiType>): Promise<CiType> => {
  const response = await api.post<CiType>('/api/v1/ci-types/', data);
  return response.data;
};

export const getCiType = async (id: string): Promise<CiType> => {
  const response = await api.get<CiType>('/api/v1/ci-types/' + id);
  return response.data;
};

export const updateCiType = async (id: string, data: Partial<CiType>): Promise<CiType> => {
  const response = await api.put<CiType>('/api/v1/ci-types/' + id, data);
  return response.data;
};

export const deleteCiType = async (id: string): Promise<void> => {
  await api.delete('/api/v1/ci-types/' + id);
};

export const createCiTypeValidate = async (id: string, data?: Partial<CiType>): Promise<CiType> => {
  const response = await api.post<CiType>('/api/v1/ci-types/' + id + '/validate', data);
  return response.data;
};

export const createCiTypeVersions = async (id: string, data?: Partial<CiType>): Promise<CiType> => {
  const response = await api.post<CiType>('/api/v1/ci-types/' + id + '/versions', data);
  return response.data;
};

export const createCiTypeVersionsRollback = async (id: string, versionId: string, data?: Partial<CiType>): Promise<CiType> => {
  const response = await api.post<CiType>('/api/v1/ci-types/' + id + '/versions/' + versionId + '/rollback', data);
  return response.data;
};
