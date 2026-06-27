/**
 * AlertBreaker API Service
 * Auto-generated from backend alert-breaker-routes.ts
 * Prefix: /v1/alert-breakers
 */
import { api } from './client';

export interface AlertBreaker {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createAlertBreakerRules = async (data?: Partial<AlertBreaker>): Promise<AlertBreaker> => {
  const response = await api.post<AlertBreaker>('/v1/alert-breakers/rules', data);
  return response.data;
};

export const listAlertBreaker = async (params?: Record<string, unknown>): Promise<{ data: AlertBreaker[]; total: number }> => {
  const response = await api.get<{ data: AlertBreaker[]; total: number }>('/v1/alert-breakers/rules', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getAlertBreaker = async (id: string): Promise<AlertBreaker> => {
  const response = await api.get<AlertBreaker>('/v1/alert-breakers/rules/' + id);
  return response.data;
};

export const updateAlertBreaker = async (id: string, data: Partial<AlertBreaker>): Promise<AlertBreaker> => {
  const response = await api.put<AlertBreaker>('/v1/alert-breakers/rules/' + id, data);
  return response.data;
};

export const deleteAlertBreaker = async (id: string): Promise<void> => {
  await api.delete('/v1/alert-breakers/rules/' + id);
};

export const createAlertBreakerEvaluate = async (data?: Partial<AlertBreaker>): Promise<AlertBreaker> => {
  const response = await api.post<AlertBreaker>('/v1/alert-breakers/evaluate', data);
  return response.data;
};
