/**
 * Code Management API Service
 * Repository, Branch, Pull Request, Branch Policy, CODEOWNERS, and Webhook operations
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface CodeRepo {
  id: string;
  name: string;
  adapterId: string;
  url: string;
  branchCount: number;
  pullRequestCount: number;
  createdAt: string;
}

export interface Branch {
  name: string;
  commitSha: string;
  lastCommitDate: string;
  isProtected: boolean;
}

export interface PullRequest {
  id: string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  createdAt: string;
  reviewCount: number;
}

export interface BranchPolicy {
  id: string;
  repoId: string;
  branchPattern: string;
  minApprovals: number;
  requireBuildPass: boolean;
  requireTestPass: boolean;
  enabled: boolean;
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  repoType: string;
  repoName: string;
  payload: Record<string, any>;
  receivedAt: string;
  status: 'processed' | 'failed';
}

// ============================================================================
// List / Query Params
// ============================================================================

export interface RepoListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PullRequestListParams {
  state?: string;
  author?: string;
  page?: number;
  pageSize?: number;
}

export interface BranchPolicyParams {
  repoId?: string;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface WebhookLogParams {
  eventType?: string;
  status?: string;
  repoName?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Request Payloads
// ============================================================================

export interface CreateBranchInput {
  name: string;
  sourceBranch?: string;
}

export interface CreatePullRequestInput {
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface MergePullRequestInput {
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  commitTitle?: string;
}

export interface AddReviewInput {
  state: 'approved' | 'changes_requested' | 'commented';
  comment?: string;
}

export interface CreateBranchPolicyInput {
  repoId: string;
  branchPattern: string;
  minApprovals: number;
  requireBuildPass: boolean;
  requireTestPass: boolean;
  enabled: boolean;
}

export interface UpdateBranchPolicyInput {
  branchPattern?: string;
  minApprovals?: number;
  requireBuildPass?: boolean;
  requireTestPass?: boolean;
  enabled?: boolean;
}

export interface CheckMergePolicyInput {
  repoId: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface RegisterCodeOwnersInput {
  repoId: string;
  content: string;
}

export interface ValidateCodeOwnersInput {
  content: string;
}

export interface RecommendApproversInput {
  repoId: string;
  filePaths: string[];
}

// ============================================================================
// Repository API
// ============================================================================

export function getCodeRepoAdapters() {
  return api.get('/api/v1/code-repo/adapters');
}

export function getCodeRepos(adapterId: string, params?: RepoListParams) {
  return api.get(`/api/v1/code-repo/${adapterId}/repos`, { params });
}

export function getCodeRepoBranches(adapterId: string, repoId: string) {
  return api.get(`/api/v1/code-repo/${adapterId}/repos/${repoId}/branches`);
}

export function createCodeRepoBranch(adapterId: string, repoId: string, data: CreateBranchInput) {
  return api.post(`/api/v1/code-repo/${adapterId}/repos/${repoId}/branches`, data);
}

export function deleteCodeRepoBranch(adapterId: string, repoId: string, branchName: string) {
  return api.delete(`/api/v1/code-repo/${adapterId}/repos/${repoId}/branches/${branchName}`);
}

export function getPullRequests(adapterId: string, repoId: string, params?: PullRequestListParams) {
  return api.get(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls`, { params });
}

export function getPullRequest(adapterId: string, repoId: string, prId: string) {
  return api.get(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls/${prId}`);
}

export function createPullRequest(adapterId: string, repoId: string, data: CreatePullRequestInput) {
  return api.post(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls`, data);
}

export function mergePullRequest(
  adapterId: string,
  repoId: string,
  prId: string,
  data?: MergePullRequestInput
) {
  return api.post(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls/${prId}/merge`, data);
}

export function closePullRequest(adapterId: string, repoId: string, prId: string) {
  return api.post(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls/${prId}/close`);
}

export function addPullRequestReview(
  adapterId: string,
  repoId: string,
  prId: string,
  data: AddReviewInput
) {
  return api.post(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls/${prId}/reviews`, data);
}

export function getPullRequestReviews(adapterId: string, repoId: string, prId: string) {
  return api.get(`/api/v1/code-repo/${adapterId}/repos/${repoId}/pulls/${prId}/reviews`);
}

// ============================================================================
// Branch Policy API
// ============================================================================

export function getBranchPolicies(params?: BranchPolicyParams) {
  return api.get('/api/v1/code-repo/branch-policies', { params });
}

export function createBranchPolicy(data: CreateBranchPolicyInput) {
  return api.post('/api/v1/code-repo/branch-policies', data);
}

export function updateBranchPolicy(id: string, data: UpdateBranchPolicyInput) {
  return api.put(`/api/v1/code-repo/branch-policies/${id}`, data);
}

export function deleteBranchPolicy(id: string) {
  return api.delete(`/api/v1/code-repo/branch-policies/${id}`);
}

export function checkMergePolicy(data: CheckMergePolicyInput) {
  return api.post('/api/v1/code-repo/branch-policies/check-merge', data);
}

// ============================================================================
// CODEOWNERS API
// ============================================================================

export function getCodeOwners(repoId: string) {
  return api.get('/api/v1/code-repo/code-owners', { params: { repoId } });
}

export function registerCodeOwners(data: RegisterCodeOwnersInput) {
  return api.post('/api/v1/code-repo/code-owners', data);
}

export function deleteCodeOwners(repoId: string) {
  return api.delete(`/api/v1/code-repo/code-owners/${repoId}`);
}

export function validateCodeOwners(content: string) {
  return api.post('/api/v1/code-repo/code-owners/validate', { content });
}

export function recommendCodeOwnersApprovers(repoId: string, filePaths: string[]) {
  return api.post('/api/v1/code-repo/code-owners/recommend', { repoId, filePaths });
}

// ============================================================================
// Webhook API
// ============================================================================

export function getWebhookLogs(params?: WebhookLogParams) {
  return api.get('/api/v1/code-repo/webhooks/logs', { params });
}
