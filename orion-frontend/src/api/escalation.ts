/**
 * Escalation API Service
 * Auto-generated from backend escalation-routes.ts
 * Prefix: /api/v1/escalation
 */
import { api } from './client';

export interface Escalation {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listEscalation = async (params?: Record<string, unknown>): Promise<{ data: Escalation[]; total: number }> => {
  const response = await api.get<{ data: Escalation[]; total: number }>('/api/v1/escalation/policies', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createEscalationSchedulerStart = async (data?: Partial<Escalation>): Promise<Escalation> => {
  const response = await api.post<Escalation>('/api/v1/escalation/scheduler/start', data);
  return response.data;
};

export const createEscalationSchedulerStop = async (data?: Partial<Escalation>): Promise<Escalation> => {
  const response = await api.post<Escalation>('/api/v1/escalation/scheduler/stop', data);
  return response.data;
};

export const createEscalationInitDefaults = async (data?: Partial<Escalation>): Promise<Escalation> => {
  const response = await api.post<Escalation>('/api/v1/escalation/init-defaults', data);
  return response.data;
};
