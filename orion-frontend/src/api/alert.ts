/**
 * Alert API Service
 * Auto-generated from backend alert-routes.ts
 * Prefix: /v1/alert
 */
import { api } from './client';

export interface Alert {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createAlert = async (data?: Partial<Alert>): Promise<Alert> => {
  const response = await api.post<Alert>('/v1/alert/ingest', data);
  return response.data;
};

export const createAlertCorrelate = async (data?: Partial<Alert>): Promise<Alert> => {
  const response = await api.post<Alert>('/v1/alert/correlate', data);
  return response.data;
};

export const listAlert = async (params?: Record<string, unknown>): Promise<{ data: Alert[]; total: number }> => {
  const response = await api.get<{ data: Alert[]; total: number }>('/v1/alert/topology', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createAlertTopology = async (data?: Partial<Alert>): Promise<Alert> => {
  const response = await api.post<Alert>('/v1/alert/topology', data);
  return response.data;
};

export const createAlertSuppressionMaintenanceWindows = async (data?: Partial<Alert>): Promise<Alert> => {
  const response = await api.post<Alert>('/v1/alert/suppression/maintenance-windows', data);
  return response.data;
};

export const createAlertSuppressionKnownIssues = async (data?: Partial<Alert>): Promise<Alert> => {
  const response = await api.post<Alert>('/v1/alert/suppression/known-issues', data);
  return response.data;
};

export const getAlert = async (id: string): Promise<Alert> => {
  const response = await api.get<Alert>('/v1/alert/' + id);
  return response.data;
};
