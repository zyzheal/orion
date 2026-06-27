/**
 * ArtifactVersion API Service
 * Auto-generated from backend artifact-version-routes.ts
 * Prefix: /v1/artifact-versions
 */
import { api } from './client';

export interface ArtifactVersion {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listArtifactVersion = async (params?: Record<string, unknown>): Promise<{ data: ArtifactVersion[]; total: number }> => {
  const response = await api.get<{ data: ArtifactVersion[]; total: number }>('/v1/artifact-versions/', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getArtifactVersion = async (id: string): Promise<ArtifactVersion> => {
  const response = await api.get<ArtifactVersion>('/v1/artifact-versions/' + id);
  return response.data;
};

export const createArtifactVersionTags = async (id: string, data?: Partial<ArtifactVersion>): Promise<ArtifactVersion> => {
  const response = await api.post<ArtifactVersion>('/v1/artifact-versions/' + id + '/tags', data);
  return response.data;
};

export const deleteArtifactVersion = async (id: string, tag: string): Promise<void> => {
  await api.delete('/v1/artifact-versions/' + id + '/tags/' + tag);
};

export const createArtifactVersionPromote = async (id: string, data?: Partial<ArtifactVersion>): Promise<ArtifactVersion> => {
  const response = await api.post<ArtifactVersion>('/v1/artifact-versions/' + id + '/promote', data);
  return response.data;
};
