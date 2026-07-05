/**
 * FinopsV2 API Service
 * Auto-generated from backend finops-v2-routes.ts
 * Prefix: /api/v1/finops
 */
import { api } from './client';

export interface FinopsV2 {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createFinopsV2FinopsTrackProject = async (data?: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.post<FinopsV2>('/api/v1/finops/finops/track/project', data);
  return response.data;
};

export const createFinopsV2FinopsTrackTenant = async (data?: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.post<FinopsV2>('/api/v1/finops/finops/track/tenant', data);
  return response.data;
};

export const createFinopsV2FinopsTrackTeam = async (data?: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.post<FinopsV2>('/api/v1/finops/finops/track/team', data);
  return response.data;
};

export const getFinopsV2 = async (entityType: string, entityId: string): Promise<FinopsV2> => {
  const response = await api.get<FinopsV2>('/api/v1/finops/finops/track/' + entityType + '/' + entityId);
  return response.data;
};

export const getFinopsV2FinopsTrackTrend = async (entityType: string, entityId: string): Promise<FinopsV2> => {
  const response = await api.get<FinopsV2>('/api/v1/finops/finops/track/' + entityType + '/' + entityId + '/trend');
  return response.data;
};

export const listFinopsV2 = async (params?: Record<string, unknown>): Promise<{ data: FinopsV2[]; total: number }> => {
  const response = await api.get<{ data: FinopsV2[]; total: number }>('/api/v1/finops/finops/cost-overview', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createFinopsV2FinopsBudgets = async (data?: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.post<FinopsV2>('/api/v1/finops/finops/budgets', data);
  return response.data;
};

export const updateFinopsV2 = async (id: string, data: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.put<FinopsV2>('/api/v1/finops/finops/budgets/' + id, data);
  return response.data;
};

export const deleteFinopsV2 = async (id: string): Promise<void> => {
  await api.delete('/api/v1/finops/finops/budgets/' + id);
};

export const getFinopsV2FinopsBudgetsStatus = async (id: string): Promise<FinopsV2> => {
  const response = await api.get<FinopsV2>('/api/v1/finops/finops/budgets/' + id + '/status');
  return response.data;
};

export const getFinopsV2FinopsBudgetsForecast = async (id: string): Promise<FinopsV2> => {
  const response = await api.get<FinopsV2>('/api/v1/finops/finops/budgets/' + id + '/forecast');
  return response.data;
};

export const createFinopsV2FinopsBudgetsCheckAlerts = async (data?: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.post<FinopsV2>('/api/v1/finops/finops/budgets/check-alerts', data);
  return response.data;
};

export const patchFinopsV2Recommendations = async (id: string, data?: Partial<FinopsV2>): Promise<FinopsV2> => {
  const response = await api.patch<FinopsV2>('/api/v1/finops/finops/recommendations/' + id, data);
  return response.data;
};
