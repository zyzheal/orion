/**
 * MaintenanceWindow API Service
 * Auto-generated from backend maintenance-window-routes.ts
 * Prefix: /api/v1/maintenance-windows
 */
import { api } from './client';

export interface MaintenanceWindow {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createMaintenanceWindowMaintenanceWindows = async (data?: Partial<MaintenanceWindow>): Promise<MaintenanceWindow> => {
  const response = await api.post<MaintenanceWindow>('/api/v1/maintenance-windows/maintenance-windows', data);
  return response.data;
};

export const listMaintenanceWindow = async (params?: Record<string, unknown>): Promise<{ data: MaintenanceWindow[]; total: number }> => {
  const response = await api.get<{ data: MaintenanceWindow[]; total: number }>('/api/v1/maintenance-windows/maintenance-windows', { params });
  return { data: response.data.data, total: response.data.total };
};

export const deleteMaintenanceWindow = async (id: string): Promise<void> => {
  await api.delete('/api/v1/maintenance-windows/maintenance-windows/' + id);
};

export const getMaintenanceWindow = async (serviceName: string): Promise<MaintenanceWindow> => {
  const response = await api.get<MaintenanceWindow>('/api/v1/maintenance-windows/maintenance-windows/check/' + serviceName);
  return response.data;
};
