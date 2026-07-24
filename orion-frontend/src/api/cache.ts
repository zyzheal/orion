/**
 * Cache API Service
 * Auto-generated from backend cache-routes.ts
 * Prefix: /api/v1/cache
 */
import { api } from './client';

export interface Cache {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listCache = async (params?: Record<string, unknown>): Promise<{ data: Cache[]; total: number }> => {
  const response = await api.get<{ data: Cache[]; total: number }>('/api/v1/cache/stats', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createCacheWarmup = async (data?: Partial<Cache>): Promise<Cache> => {
  const response = await api.post<Cache>('/api/v1/cache/warmup', data);
  return response.data;
};

export const createCacheWarmupWithLoader = async (data?: Partial<Cache>): Promise<Cache> => {
  const response = await api.post<Cache>('/api/v1/cache/warmup-with-loader', data);
  return response.data;
};

export const createCacheInvalidate = async (data?: Partial<Cache>): Promise<Cache> => {
  const response = await api.post<Cache>('/api/v1/cache/invalidate', data);
  return response.data;
};

export const createCacheInvalidatePattern = async (data?: Partial<Cache>): Promise<Cache> => {
  const response = await api.post<Cache>('/api/v1/cache/invalidate-pattern', data);
  return response.data;
};

export const createCacheCleanup = async (data?: Partial<Cache>): Promise<Cache> => {
  const response = await api.post<Cache>('/api/v1/cache/cleanup', data);
  return response.data;
};

export const getCache = async (key: string): Promise<Cache> => {
  const response = await api.get<Cache>('/api/v1/cache/' + key);
  return response.data;
};

export const deleteCache = async (key: string): Promise<void> => {
  await api.delete('/api/v1/cache/' + key);
};
