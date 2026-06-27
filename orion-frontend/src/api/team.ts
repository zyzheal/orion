/**
 * Team API Service
 * Auto-generated from backend team-routes.ts
 * Prefix: /v1/teams
 */
import { api } from './client';

export interface Team {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listTeam = async (params?: Record<string, unknown>): Promise<{ data: Team[]; total: number }> => {
  const response = await api.get<{ data: Team[]; total: number }>('/v1/teams/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createTeam = async (data?: Partial<Team>): Promise<Team> => {
  const response = await api.post<Team>('/v1/teams/', data);
  return response.data;
};

export const getTeam = async (id: string): Promise<Team> => {
  const response = await api.get<Team>('/v1/teams/' + id);
  return response.data;
};

export const updateTeam = async (id: string, data: Partial<Team>): Promise<Team> => {
  const response = await api.put<Team>('/v1/teams/' + id, data);
  return response.data;
};

export const deleteTeam = async (id: string): Promise<void> => {
  await api.delete('/v1/teams/' + id);
};

export const createTeamMembers = async (id: string, data?: Partial<Team>): Promise<Team> => {
  const response = await api.post<Team>('/v1/teams/' + id + '/members', data);
  return response.data;
};

export const createTeamRoles = async (id: string, data?: Partial<Team>): Promise<Team> => {
  const response = await api.post<Team>('/v1/teams/' + id + '/roles', data);
  return response.data;
};
