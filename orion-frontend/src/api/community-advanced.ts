/**
 * CommunityAdvanced API Service
 * Auto-generated from backend community-advanced-routes.ts
 * Prefix: /api/v1/community-advanced
 */
import { api } from './client';

export interface CommunityAdvanced {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createCommunityAdvancedBadges = async (data?: Partial<CommunityAdvanced>): Promise<CommunityAdvanced> => {
  const response = await api.post<CommunityAdvanced>('/api/v1/community-advanced/badges', data);
  return response.data;
};

export const getCommunityAdvanced = async (userId: string): Promise<CommunityAdvanced> => {
  const response = await api.get<CommunityAdvanced>('/api/v1/community-advanced/badges/' + userId);
  return response.data;
};

export const listCommunityAdvanced = async (params?: Record<string, unknown>): Promise<{ data: CommunityAdvanced[]; total: number }> => {
  const response = await api.get<{ data: CommunityAdvanced[]; total: number }>('/api/v1/community-advanced/badges/definitions', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createCommunityAdvancedIncentivePrograms = async (data?: Partial<CommunityAdvanced>): Promise<CommunityAdvanced> => {
  const response = await api.post<CommunityAdvanced>('/api/v1/community-advanced/incentive-programs', data);
  return response.data;
};

export const createCommunityAdvancedMentorship = async (data?: Partial<CommunityAdvanced>): Promise<CommunityAdvanced> => {
  const response = await api.post<CommunityAdvanced>('/api/v1/community-advanced/mentorship', data);
  return response.data;
};

export const createCommunityAdvancedBestPractices = async (data?: Partial<CommunityAdvanced>): Promise<CommunityAdvanced> => {
  const response = await api.post<CommunityAdvanced>('/api/v1/community-advanced/best-practices', data);
  return response.data;
};

export const createCommunityAdvancedBestPracticesVote = async (id: string, data?: Partial<CommunityAdvanced>): Promise<CommunityAdvanced> => {
  const response = await api.post<CommunityAdvanced>('/api/v1/community-advanced/best-practices/' + id + '/vote', data);
  return response.data;
};
