/**
 * Code Repository API Client
 *
 * 后端路由: /api/v1/code-repo/*
 * 模块: code-repo-routes.ts
 */

import { api } from './client';

// ==================== Types ====================

export interface AdapterInfo {
  id: string;
  type: 'github' | 'gitlab' | 'gerrit';
}

export interface RepositoryInfo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  type: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  lastCommitDate?: string;
}

export interface PullRequestInfo {
  id: string;
  title: string;
  description?: string;
  state: 'open' | 'merged' | 'closed';
  sourceBranch: string;
  targetBranch: string;
  author: string;
  createdAt?: string;
  mergedAt?: string;
}

export interface ReviewInfo {
  id: string;
  body?: string;
  state: 'pending' | 'approved' | 'changes_requested';
  author: string;
  createdAt?: string;
}

// ==================== API Methods ====================

/**
 * 列出所有代码仓库适配器
 */
export async function listAdapters(): Promise<AdapterInfo[]> {
  const res = await api.get<AdapterInfo[]>('/api/v1/code-repo/adapters');
  return res.data ?? [];
}

/**
 * 列出指定适配器下的仓库
 */
export async function listRepositories(adapterId: string): Promise<RepositoryInfo[]> {
  const res = await api.get<RepositoryInfo[]>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos`);
  return res.data ?? [];
}

/**
 * 列出仓库分支
 */
export async function listBranches(adapterId: string, repoId: string): Promise<BranchInfo[]> {
  const res = await api.get<BranchInfo[]>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/branches`);
  return res.data ?? [];
}

/**
 * 创建分支
 */
export async function createBranch(adapterId: string, repoId: string, branchName: string, fromBranch?: string): Promise<BranchInfo> {
  const res = await api.post<BranchInfo>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/branches`, {
    name: branchName,
    sourceRef: fromBranch,
  });
  return res.data;
}

/**
 * 删除分支
 */
export async function deleteBranch(adapterId: string, repoId: string, branchName: string): Promise<void> {
  await api.delete(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`);
}

/**
 * 列出 Pull Requests
 */
export async function listPullRequests(adapterId: string, repoId: string): Promise<PullRequestInfo[]> {
  const res = await api.get<PullRequestInfo[]>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/pulls`);
  return res.data ?? [];
}

/**
 * 创建 Pull Request
 */
export async function createPullRequest(adapterId: string, repoId: string, pr: {
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<PullRequestInfo> {
  const res = await api.post<PullRequestInfo>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/pulls`, pr);
  return res.data;
}

/**
 * Merge Pull Request
 */
export async function mergePullRequest(adapterId: string, repoId: string, prId: string): Promise<void> {
  await api.post(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/pulls/${encodeURIComponent(prId)}/merge`);
}

/**
 * Close Pull Request
 */
export async function closePullRequest(adapterId: string, repoId: string, prId: string): Promise<void> {
  await api.post(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/pulls/${encodeURIComponent(prId)}/close`);
}

/**
 * 列出 PR Reviews
 */
export async function listReviews(adapterId: string, repoId: string, prId: string): Promise<ReviewInfo[]> {
  const res = await api.get<ReviewInfo[]>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/pulls/${encodeURIComponent(prId)}/reviews`);
  return res.data ?? [];
}

/**
 * 添加 Review
 */
export async function addReview(adapterId: string, repoId: string, prId: string, review: {
  state: 'approved' | 'changes_requested' | 'commented';
  body?: string;
}): Promise<ReviewInfo> {
  const res = await api.post<ReviewInfo>(`/api/v1/code-repo/${encodeURIComponent(adapterId)}/repos/${encodeURIComponent(repoId)}/pulls/${encodeURIComponent(prId)}/reviews`, review);
  return res.data;
}
