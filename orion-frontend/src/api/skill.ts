/**
 * Skill API Service
 * Auto-generated from backend skill-routes.ts
 * Prefix: /api/v1/skills
 */
import { api } from './client';

export interface Skill {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listSkill = async (params?: Record<string, unknown>): Promise<{ data: Skill[]; total: number }> => {
  const response = await api.get<{ data: Skill[]; total: number }>('/api/v1/skills/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getSkill = async (id: string): Promise<Skill> => {
  const response = await api.get<Skill>('/api/v1/skills/' + id);
  return response.data;
};

export const createSkill = async (data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/', data);
  return response.data;
};

export const updateSkill = async (id: string, data: Partial<Skill>): Promise<Skill> => {
  const response = await api.put<Skill>('/api/v1/skills/' + id, data);
  return response.data;
};

export const deleteSkill = async (id: string): Promise<void> => {
  await api.delete('/api/v1/skills/' + id);
};

export const createSkillVersions = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/versions', data);
  return response.data;
};

export const createSkillInstall = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/install', data);
  return response.data;
};

export const createSkillUninstall = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/uninstall', data);
  return response.data;
};

export const createSkillRate = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/rate', data);
  return response.data;
};

export const createSkillInstances = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/instances', data);
  return response.data;
};

export const createSkillExecute = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/execute', data);
  return response.data;
};

export const createSkillSubmit = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/submit', data);
  return response.data;
};

export const createSkillApprove = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/approve', data);
  return response.data;
};

export const createSkillReject = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/reject', data);
  return response.data;
};

export const createSkillArchive = async (id: string, data?: Partial<Skill>): Promise<Skill> => {
  const response = await api.post<Skill>('/api/v1/skills/' + id + '/archive', data);
  return response.data;
};
