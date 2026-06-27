/**
 * CrossDomain API Service
 * Auto-generated from backend cross-domain-routes.ts
 * Prefix: /v1/orchestration
 */
import { api } from './client';

export interface CrossDomain {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createCrossDomainV1Orchestration = async (data?: Partial<CrossDomain>): Promise<CrossDomain> => {
  const response = await api.post<CrossDomain>('/v1/orchestration/v1/orchestration', data);
  return response.data;
};

export const listCrossDomain = async (params?: Record<string, unknown>): Promise<{ data: CrossDomain[]; total: number }> => {
  const response = await api.get<{ data: CrossDomain[]; total: number }>('/v1/orchestration/v1/orchestration', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getCrossDomain = async (id: string): Promise<CrossDomain> => {
  const response = await api.get<CrossDomain>('/v1/orchestration/v1/orchestration/' + id);
  return response.data;
};

export const createCrossDomainV1OrchestrationExecute = async (id: string, data?: Partial<CrossDomain>): Promise<CrossDomain> => {
  const response = await api.post<CrossDomain>('/v1/orchestration/v1/orchestration/' + id + '/execute', data);
  return response.data;
};

export const createCrossDomainV1OrchestrationPause = async (id: string, data?: Partial<CrossDomain>): Promise<CrossDomain> => {
  const response = await api.post<CrossDomain>('/v1/orchestration/v1/orchestration/' + id + '/pause', data);
  return response.data;
};

export const createCrossDomainV1OrchestrationResume = async (id: string, data?: Partial<CrossDomain>): Promise<CrossDomain> => {
  const response = await api.post<CrossDomain>('/v1/orchestration/v1/orchestration/' + id + '/resume', data);
  return response.data;
};

export const createCrossDomainV1OrchestrationAbort = async (id: string, data?: Partial<CrossDomain>): Promise<CrossDomain> => {
  const response = await api.post<CrossDomain>('/v1/orchestration/v1/orchestration/' + id + '/abort', data);
  return response.data;
};
