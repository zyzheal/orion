/**
 * BiDashboard API Service
 * Auto-generated from backend bi-dashboard-routes.ts
 * Prefix: /api/v1/tickets/bi
 */
import { api } from './client';

export interface BiDashboard {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listBiDashboard = async (params?: Record<string, unknown>): Promise<{ data: BiDashboard[]; total: number }> => {
  const response = await api.get<{ data: BiDashboard[]; total: number }>('/api/v1/tickets/bi/tickets/bi/dashboard/executive', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getBiDashboardTicketsBiDashboardEngineer = async (engineerId: string): Promise<BiDashboard> => {
  const response = await api.get<BiDashboard>('/api/v1/tickets/bi/tickets/bi/dashboard/engineer/' + engineerId);
  return response.data;
};
