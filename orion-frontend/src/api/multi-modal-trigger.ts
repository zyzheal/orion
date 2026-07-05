/**
 * MultiModalTrigger API Service
 * Auto-generated from backend multi-modal-trigger-routes.ts
 * Prefix: /api/v1/triggers
 */
import { api } from './client';

export interface MultiModalTrigger {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createMultiModalTrigger = async (data?: Partial<MultiModalTrigger>): Promise<MultiModalTrigger> => {
  const response = await api.post<MultiModalTrigger>('/api/v1/triggers/', data);
  return response.data;
};

export const listMultiModalTrigger = async (params?: Record<string, unknown>): Promise<{ data: MultiModalTrigger[]; total: number }> => {
  const response = await api.get<{ data: MultiModalTrigger[]; total: number }>('/api/v1/triggers/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createMultiModalTriggerEvaluate = async (id: string, data?: Partial<MultiModalTrigger>): Promise<MultiModalTrigger> => {
  const response = await api.post<MultiModalTrigger>('/api/v1/triggers/' + id + '/evaluate', data);
  return response.data;
};

export const createMultiModalTriggerExecute = async (id: string, data?: Partial<MultiModalTrigger>): Promise<MultiModalTrigger> => {
  const response = await api.post<MultiModalTrigger>('/api/v1/triggers/' + id + '/execute', data);
  return response.data;
};

export const createMultiModalTriggerWebhook = async (data?: Partial<MultiModalTrigger>): Promise<MultiModalTrigger> => {
  const response = await api.post<MultiModalTrigger>('/api/v1/triggers/webhook', data);
  return response.data;
};

export const createMultiModalTriggerWebhookProcess = async (data?: Partial<MultiModalTrigger>): Promise<MultiModalTrigger> => {
  const response = await api.post<MultiModalTrigger>('/api/v1/triggers/webhook/process', data);
  return response.data;
};

export const createMultiModalTriggerChat = async (data?: Partial<MultiModalTrigger>): Promise<MultiModalTrigger> => {
  const response = await api.post<MultiModalTrigger>('/api/v1/triggers/chat', data);
  return response.data;
};
