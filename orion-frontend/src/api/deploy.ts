/**
 * Deploy API Service
 * Auto-generated from backend deploy-routes.ts
 * Prefix: /api/deploy
 */
import { api } from './client';

export interface Deploy {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// ==================== Deployment CRUD ====================

export const createDeployDeploy = async (data?: Partial<Deploy>): Promise<Deploy> => {
  const response = await api.post<Deploy>('/api/deploy/deploy', data);
  return response.data;
};

export const getDeploy = async (id: string): Promise<Deploy> => {
  const response = await api.get<Deploy>('/api/deploy/deploy/' + id);
  return response.data;
};

export const listDeploy = async (params?: Record<string, unknown>): Promise<{ data: Deploy[]; total: number }> => {
  const response = await api.get<{ data: Deploy[]; total: number }>('/api/deploy/deploy/history', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createDeployDeployRollback = async (id: string, data?: Partial<Deploy>): Promise<Deploy> => {
  const response = await api.post<Deploy>('/api/deploy/deploy/' + id + '/rollback', data);
  return response.data;
};

export const createDeployDeployCancel = async (id: string, data?: Partial<Deploy>): Promise<Deploy> => {
  const response = await api.post<Deploy>('/api/deploy/deploy/' + id + '/cancel', data);
  return response.data;
};

// ==================== Release Notes ====================

export interface ReleaseNotesChange {
  type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'config' | 'docs' | 'refactor' | 'test' | 'chore';
  description: string;
  commit: string;
  author: string;
  issueId?: string;
  prNumber?: string;
  prUrl?: string;
}

export interface ReleaseNotes {
  id: string;
  deploymentId: string;
  tenantId: string;
  version: string;
  environment: string;
  generatedAt: string;
  summary: string;
  changes: ReleaseNotesChange[];
  metrics: {
    totalCommits: number;
    totalChanges: number;
    breakingChanges: number;
    features: number;
    fixes: number;
    improvements: number;
  };
  notes?: string;
  updatedAt?: string;
}

/**
 * GET /deploy/:id/release-notes - 获取部署的版本说明
 */
export const getReleaseNotes = async (deploymentId: string): Promise<ReleaseNotes | null> => {
  const response = await api.get<ReleaseNotes>('/api/deploy/' + deploymentId + '/release-notes');
  return response.data;
};

/**
 * POST /deploy/:id/release-notes/generate - 从 Git 历史生成版本说明
 * @param deploymentId - 部署 ID
 * @param options - 生成选项
 * @param options.fromCommit - 起始 commit
 * @param options.toCommit - 结束 commit（默认使用部署的 commitSha）
 * @param options.repoPath - Git 仓库路径（默认使用当前工作目录）
 */
export const generateReleaseNotes = async (
  deploymentId: string,
  options?: {
    fromCommit?: string;
    toCommit?: string;
    repoPath?: string;
  }
): Promise<ReleaseNotes> => {
  const response = await api.post<ReleaseNotes>('/api/deploy/' + deploymentId + '/release-notes/generate', options);
  return response.data;
};

/**
 * GET /deploy/release-notes/tenant/:tenantId - 获取租户下所有版本说明
 */
export const getReleaseNotesByTenant = async (
  tenantId: string,
  limit: number = 50
): Promise<{ data: ReleaseNotes[]; total: number; limit: number }> => {
  const response = await api.get<{ data: ReleaseNotes[]; total: number; limit: number }>(
    '/api/deploy/release-notes/tenant/' + tenantId,
    { params: { limit: String(limit) } }
  );
  return response.data;
};
