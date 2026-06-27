/**
 * UnifiedConfig API Service
 * Auto-generated from backend unified-config-routes.ts
 * Prefix: /v1/config
 */
import { api } from './client';

export interface UnifiedConfig {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listUnifiedConfig = async (params?: Record<string, unknown>): Promise<{ data: UnifiedConfig[]; total: number }> => {
  const response = await api.get<{ data: UnifiedConfig[]; total: number }>('/v1/config/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createUnifiedConfigReset = async (data?: Partial<UnifiedConfig>): Promise<UnifiedConfig> => {
  const response = await api.post<UnifiedConfig>('/v1/config/reset', data);
  return response.data;
};
