/**
 * ChangeRequest API Service
 * Auto-generated from backend change-request-routes.ts
 * Prefix: /v1/change-requests
 */
import { api } from './client';

export interface ChangeRequest {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listChangeRequest = async (params?: Record<string, unknown>): Promise<{ data: ChangeRequest[]; total: number }> => {
  const response = await api.get<{ data: ChangeRequest[]; total: number }>('/v1/change-requests/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createChangeRequest = async (data?: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.post<ChangeRequest>('/v1/change-requests/', data);
  return response.data;
};

export const getChangeRequest = async (id: string): Promise<ChangeRequest> => {
  const response = await api.get<ChangeRequest>('/v1/change-requests/' + id);
  return response.data;
};

export const updateChangeRequest = async (id: string, data: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.put<ChangeRequest>('/v1/change-requests/' + id, data);
  return response.data;
};

export const deleteChangeRequest = async (id: string): Promise<void> => {
  await api.delete('/v1/change-requests/' + id);
};

export const createChangeRequestSubmit = async (id: string, data?: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.post<ChangeRequest>('/v1/change-requests/' + id + '/submit', data);
  return response.data;
};

export const createChangeRequestApprovalsApprove = async (id: string, approvalId: string, data?: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.post<ChangeRequest>('/v1/change-requests/' + id + '/approvals/' + approvalId + '/approve', data);
  return response.data;
};

export const createChangeRequestApprovalsReject = async (id: string, approvalId: string, data?: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.post<ChangeRequest>('/v1/change-requests/' + id + '/approvals/' + approvalId + '/reject', data);
  return response.data;
};

export const createChangeRequestExecutionStart = async (id: string, data?: Partial<ChangeRequest>): Promise<ChangeRequest> => {
  const response = await api.post<ChangeRequest>('/v1/change-requests/' + id + '/execution/start', data);
  return response.data;
};
