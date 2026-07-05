/**
 * Metrics API Service
 * Auto-generated from backend metrics-routes.ts
 * Prefix: /api/v1/metrics
 */
import { api } from './client';

export interface Metrics {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createMetricsRecord = async (data?: Partial<Metrics>): Promise<Metrics> => {
  const response = await api.post<Metrics>('/api/v1/metrics/record', data);
  return response.data;
};

export const createMetricsQuery = async (data?: Partial<Metrics>): Promise<Metrics> => {
  const response = await api.post<Metrics>('/api/v1/metrics/query', data);
  return response.data;
};

export const createMetricsStats = async (data?: Partial<Metrics>): Promise<Metrics> => {
  const response = await api.post<Metrics>('/api/v1/metrics/stats', data);
  return response.data;
};
