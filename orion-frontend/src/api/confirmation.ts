/**
 * Confirmation API Service
 * Auto-generated from backend confirmation-routes.ts
 * Prefix: /confirmations
 */
import { api } from './client';

export interface Confirmation {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listConfirmation = async (
  params?: Record<string, unknown>
): Promise<{ data: Confirmation[]; total: number }> => {
  const response = await api.get<{ data: Confirmation[]; total: number }>(
    '/confirmations/',
    { params }
  );
  return { data: response.data.data, total: response.data.total };
};

export const updateConfirmationSettings = async (
  data: Partial<Confirmation>
): Promise<Confirmation> => {
  const response = await api.put<Confirmation>('/confirmations/settings', data);
  return response.data;
};

export const createConfirmation = async (data?: Partial<Confirmation>): Promise<Confirmation> => {
  const response = await api.post<Confirmation>('/confirmations/', data);
  return response.data;
};

export const createConfirmationBatchApprove = async (
  data?: Partial<Confirmation>
): Promise<Confirmation> => {
  const response = await api.post<Confirmation>('/confirmations/batch-approve', data);
  return response.data;
};

export const getConfirmation = async (id: string): Promise<Confirmation> => {
  const response = await api.get<Confirmation>('/confirmations/' + id);
  return response.data;
};

export const createConfirmationApprove = async (
  id: string,
  data?: Partial<Confirmation>
): Promise<Confirmation> => {
  const response = await api.post<Confirmation>('/confirmations/' + id + '/approve', data);
  return response.data;
};

export const createConfirmationReject = async (
  id: string,
  data?: Partial<Confirmation>
): Promise<Confirmation> => {
  const response = await api.post<Confirmation>('/confirmations/' + id + '/reject', data);
  return response.data;
};
