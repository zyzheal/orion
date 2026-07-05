/**
 * Channel API Service
 * Auto-generated from backend channel-routes.ts
 * Prefix: /api/v1/channels
 */
import { api } from './client';

export interface Channel {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listChannel = async (params?: Record<string, unknown>): Promise<{ data: Channel[]; total: number }> => {
  const response = await api.get<{ data: Channel[]; total: number }>('/api/v1/channels/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createChannel = async (data?: Partial<Channel>): Promise<Channel> => {
  const response = await api.post<Channel>('/api/v1/channels/', data);
  return response.data;
};
