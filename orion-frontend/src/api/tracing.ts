/**
 * Tracing API Service
 * Auto-generated from backend tracing-routes.ts
 * Prefix: /v1/tracing
 */
import { api } from './client';

export interface Tracing {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listTracing = async (params?: Record<string, unknown>): Promise<{ data: Tracing[]; total: number }> => {
  const response = await api.get<{ data: Tracing[]; total: number }>('/v1/tracing/traces', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getTracing = async (traceId: string): Promise<Tracing> => {
  const response = await api.get<Tracing>('/v1/tracing/traces/' + traceId);
  return response.data;
};

export const createTracingTracesSearch = async (data?: Partial<Tracing>): Promise<Tracing> => {
  const response = await api.post<Tracing>('/v1/tracing/traces/search', data);
  return response.data;
};

export const updateTracingConfig = async (data: Partial<Tracing>): Promise<Tracing> => {
  const response = await api.put<Tracing>('/v1/tracing/config', data);
  return response.data;
};

export const createTracingOtelConfigs = async (data?: Partial<Tracing>): Promise<Tracing> => {
  const response = await api.post<Tracing>('/v1/tracing/otel/configs', data);
  return response.data;
};

export const updateTracing = async (id: string, data: Partial<Tracing>): Promise<Tracing> => {
  const response = await api.put<Tracing>('/v1/tracing/otel/configs/' + id, data);
  return response.data;
};

export const deleteTracing = async (id: string): Promise<void> => {
  await api.delete('/v1/tracing/otel/configs/' + id);
};
