/**
 * Notification API Service
 * Auto-generated from backend notification-routes.ts
 * Prefix: /api/v1/notifications
 */
import { api } from './client';

export interface Notification {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listNotification = async (params?: Record<string, unknown>): Promise<{ data: Notification[]; total: number }> => {
  const response = await api.get<{ data: Notification[]; total: number }>('/api/v1/notifications/stats', { params });
  return { data: response.data.data, total: response.data.total };
};
