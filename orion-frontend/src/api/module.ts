/**
 * Module API Service
 * Auto-generated from backend module-routes.ts
 * Prefix: /api/modules
 */
import { api } from './client';

export interface Module {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listModule = async (params?: Record<string, unknown>): Promise<{ data: Module[]; total: number }> => {
  const response = await api.get<{ data: Module[]; total: number }>('/api/modules/', { params });
  return { data: response.data.data, total: response.data.total };
};
