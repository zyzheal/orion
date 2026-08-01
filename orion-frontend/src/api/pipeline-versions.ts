/**
 * Pipeline Version Control API
 * Phase 1 - Version management, diff, rollback
 */

import { api } from './client';

export interface PipelineVersion {
  id: string;
  pipeline_id: string;
  version: number;
  yaml_definition: string;
  spec: Record<string, unknown>;
  change_summary: string | null;
  tags: string[];
  is_baseline: boolean;
  parent_version_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VersionDiff {
  additions: DiffItem[];
  deletions: DiffItem[];
  modifications: DiffItem[];
  summary: string;
}

export interface DiffItem {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'stage' | 'config' | 'parameter';
}

export const pipelineVersionsApi = {
  list: async (pipelineId: string, params?: { page?: number; limit?: number; tag?: string }) => {
    const response = await api.get(`/api/pipelines/${pipelineId}/versions`, { params });
    return response.data;
  },

  get: async (pipelineId: string, versionId: string) => {
    const response = await api.get(`/api/pipelines/${pipelineId}/versions/${versionId}`);
    return response.data as unknown as PipelineVersion;
  },

  diff: async (pipelineId: string, versionId: string, targetVersionId: string) => {
    const response = await api.get(
      `/api/pipelines/${pipelineId}/versions/${versionId}/diff`,
      { params: { target: targetVersionId } }
    );
    return response.data as unknown as VersionDiff;
  },

  rollback: async (pipelineId: string, versionId: string, reason?: string) => {
    const response = await api.post(
      `/api/pipelines/${pipelineId}/versions/${versionId}/rollback`,
      { reason }
    );
    return response.data as unknown as PipelineVersion;
  },

  addTag: async (pipelineId: string, versionId: string, tag: string) => {
    const response = await api.post(
      `/api/pipelines/${pipelineId}/versions/${versionId}/tag`,
      { tag }
    );
    return response.data;
  },

  removeTag: async (pipelineId: string, versionId: string, tag: string) => {
    const response = await api.delete(
      `/api/pipelines/${pipelineId}/versions/${versionId}/tag/${tag}`
    );
    return response.data;
  },

  setBaseline: async (pipelineId: string, versionId: string, isBaseline: boolean) => {
    const response = await api.post(
      `/api/pipelines/${pipelineId}/versions/${versionId}/baseline`,
      { baseline: isBaseline }
    );
    return response.data;
  },
};

export default pipelineVersionsApi;
