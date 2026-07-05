/**
 * NotificationPolicy API Service
 * Auto-generated from backend notification-policy-routes.ts
 * Prefix: /api/v1/notification-policies
 */
import { api } from './client';

export interface NotificationPolicy {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createNotificationPolicy = async (data?: Partial<NotificationPolicy>): Promise<NotificationPolicy> => {
  const response = await api.post<NotificationPolicy>('/api/v1/notification-policies/', data);
  return response.data;
};

export const listNotificationPolicy = async (params?: Record<string, unknown>): Promise<{ data: NotificationPolicy[]; total: number }> => {
  const response = await api.get<{ data: NotificationPolicy[]; total: number }>('/api/v1/notification-policies/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getNotificationPolicy = async (id: string): Promise<NotificationPolicy> => {
  const response = await api.get<NotificationPolicy>('/api/v1/notification-policies/' + id);
  return response.data;
};

export const updateNotificationPolicy = async (id: string, data: Partial<NotificationPolicy>): Promise<NotificationPolicy> => {
  const response = await api.put<NotificationPolicy>('/api/v1/notification-policies/' + id, data);
  return response.data;
};

export const deleteNotificationPolicy = async (id: string): Promise<void> => {
  await api.delete('/api/v1/notification-policies/' + id);
};

export const createNotificationPolicyEvaluate = async (data?: Partial<NotificationPolicy>): Promise<NotificationPolicy> => {
  const response = await api.post<NotificationPolicy>('/api/v1/notification-policies/evaluate', data);
  return response.data;
};

export const createNotificationPolicyWorkflows = async (data?: Partial<NotificationPolicy>): Promise<NotificationPolicy> => {
  const response = await api.post<NotificationPolicy>('/api/v1/notification-policies/workflows', data);
  return response.data;
};
