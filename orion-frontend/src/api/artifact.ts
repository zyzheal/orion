/**
 * Artifact API Service
 * Auto-generated from backend artifact-routes.ts
 * Prefix: /artifacts
 */
import { api } from './client';

export interface Artifact {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createArtifactArtifacts = async (data?: Partial<Artifact>): Promise<Artifact> => {
  const response = await api.post<Artifact>('/artifacts/artifacts', data);
  return response.data;
};

export const listArtifact = async (
  params?: Record<string, unknown>
): Promise<{ data: Artifact[]; total: number }> => {
  const response = await api.get<{ data: Artifact[]; total: number }>(
    '/artifacts/artifacts',
    { params }
  );
  return { data: response.data.data, total: response.data.total };
};

export const getArtifact = async (id: string): Promise<Artifact> => {
  const response = await api.get<Artifact>('/artifacts/artifacts/' + id);
  return response.data;
};

export const updateArtifact = async (id: string, data: Partial<Artifact>): Promise<Artifact> => {
  const response = await api.put<Artifact>('/artifacts/artifacts/' + id, data);
  return response.data;
};

export const deleteArtifact = async (id: string): Promise<void> => {
  await api.delete('/artifacts/artifacts/' + id);
};

export const createArtifactArtifactsTags = async (
  id: string,
  data?: Partial<Artifact>
): Promise<Artifact> => {
  const response = await api.post<Artifact>('/artifacts/artifacts/' + id + '/tags', data);
  return response.data;
};

export const createArtifactArtifactsPromote = async (
  id: string,
  data?: Partial<Artifact>
): Promise<Artifact> => {
  const response = await api.post<Artifact>('/artifacts/artifacts/' + id + '/promote', data);
  return response.data;
};

export const createArtifactArtifactsDeprecate = async (
  id: string,
  data?: Partial<Artifact>
): Promise<Artifact> => {
  const response = await api.post<Artifact>(
    '/artifacts/artifacts/' + id + '/deprecate',
    data
  );
  return response.data;
};

export const createArtifactArtifactsQuarantine = async (
  id: string,
  data?: Partial<Artifact>
): Promise<Artifact> => {
  const response = await api.post<Artifact>(
    '/artifacts/artifacts/' + id + '/quarantine',
    data
  );
  return response.data;
};
