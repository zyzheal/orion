/**
 * CacheCleanup API Service
 * Auto-generated from backend cache-cleanup-routes.ts
 * Prefix: /api/v1/cache-cleanup
 */
import { api } from './client';

export interface CacheCleanup {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listCacheCleanup = async (params?: Record<string, unknown>): Promise<{ data: CacheCleanup[]; total: number }> => {
  const response = await api.get<{ data: CacheCleanup[]; total: number }>('/api/v1/cache-cleanup/status', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createCacheCleanupRun = async (data?: Partial<CacheCleanup>): Promise<CacheCleanup> => {
  const response = await api.post<CacheCleanup>('/api/v1/cache-cleanup/run', data);
  return response.data;
};
