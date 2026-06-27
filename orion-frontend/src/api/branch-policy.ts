/**
 * BranchPolicy API Service
 * Auto-generated from backend branch-policy-routes.ts
 * Prefix: /v1/code-repo/branch-policies
 */
import { api } from './client';

export interface BranchPolicy {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createBranchPolicy = async (data?: Partial<BranchPolicy>): Promise<BranchPolicy> => {
  const response = await api.post<BranchPolicy>('/v1/code-repo/branch-policies/', data);
  return response.data;
};

export const getBranchPolicy = async (id: string): Promise<BranchPolicy> => {
  const response = await api.get<BranchPolicy>('/v1/code-repo/branch-policies/' + id);
  return response.data;
};

export const listBranchPolicy = async (params?: Record<string, unknown>): Promise<{ data: BranchPolicy[]; total: number }> => {
  const response = await api.get<{ data: BranchPolicy[]; total: number }>('/v1/code-repo/branch-policies/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const updateBranchPolicy = async (id: string, data: Partial<BranchPolicy>): Promise<BranchPolicy> => {
  const response = await api.put<BranchPolicy>('/v1/code-repo/branch-policies/' + id, data);
  return response.data;
};

export const deleteBranchPolicy = async (id: string): Promise<void> => {
  await api.delete('/v1/code-repo/branch-policies/' + id);
};

export const createBranchPolicyCheckMerge = async (data?: Partial<BranchPolicy>): Promise<BranchPolicy> => {
  const response = await api.post<BranchPolicy>('/v1/code-repo/branch-policies/check-merge', data);
  return response.data;
};

export const createBranchPolicyDefaults = async (repoId: string, data?: Partial<BranchPolicy>): Promise<BranchPolicy> => {
  const response = await api.post<BranchPolicy>('/v1/code-repo/branch-policies/defaults/' + repoId, data);
  return response.data;
};
