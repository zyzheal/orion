/**
 * PR/MR Trigger API Service
 * Pull Request / Merge Request trigger configuration and status callback
 */
import { api } from './client';

export interface PRTriggerRule {
  id?: string;
  pipelineId: string;
  provider: 'github' | 'gitlab' | 'both';
  repository: string;
  enabled: boolean;
  prActions: string[];
  branchFilter: {
    targetBranches: string[];
    sourceBranches?: string[];
  };
  pathFilter: {
    includePaths: string[];
    excludePaths: string[];
  };
  labelFilter: {
    requiredLabels: string[];
    excludedLabels: string[];
  };
  draftPolicy: 'skip' | 'run';
  securityLevel: 'safe' | 'trusted' | 'full';
  statusCheckName?: string;
  autoComment: boolean;
  commentTemplate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PRWebhookPayload {
  provider: 'github' | 'gitlab';
  action: string;
  repository: string;
  pullRequest: {
    number: number;
    title: string;
    sourceBranch: string;
    targetBranch: string;
    author: string;
    isDraft: boolean;
    labels: string[];
    changedFiles: string[];
  };
}

export interface PRCheckStatus {
  name: string;
  status: 'pending' | 'success' | 'failure' | 'error';
  detailsUrl: string;
  description?: string;
}

/**
 * List PR trigger rules for a pipeline
 */
export function getPRTriggerRules(pipelineId: string) {
  return api.get<PRTriggerRule[]>(`/v1/pipelines/${pipelineId}/pr-triggers`);
}

/**
 * Create a PR trigger rule
 */
export function createPRTrigger(pipelineId: string, rule: Omit<PRTriggerRule, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<PRTriggerRule>(`/v1/pipelines/${pipelineId}/pr-triggers`, rule);
}

/**
 * Update a PR trigger rule
 */
export function updatePRTrigger(pipelineId: string, ruleId: string, rule: Partial<PRTriggerRule>) {
  return api.put<PRTriggerRule>(`/v1/pipelines/${pipelineId}/pr-triggers/${ruleId}`, rule);
}

/**
 * Delete a PR trigger rule
 */
export function deletePRTrigger(pipelineId: string, ruleId: string) {
  return api.delete(`/v1/pipelines/${pipelineId}/pr-triggers/${ruleId}`);
}

/**
 * Toggle PR trigger enabled state
 */
export function togglePRTrigger(pipelineId: string, ruleId: string, enabled: boolean) {
  return api.patch(`/v1/pipelines/${pipelineId}/pr-triggers/${ruleId}`, { enabled });
}

/**
 * Receive GitHub PR webhook
 */
export function handleGitHubPR(payload: PRWebhookPayload) {
  return api.post('/v1/scm/webhooks/pull-request', payload);
}

/**
 * Receive GitLab MR webhook
 */
export function handleGitLabMR(payload: PRWebhookPayload) {
  return api.post('/v1/scm/webhooks/merge-request', payload);
}

/**
 * Update PR check status
 */
export function updatePRCheckStatus(params: {
  provider: 'github' | 'gitlab';
  repository: string;
  sha: string;
  check: PRCheckStatus;
}) {
  return api.post('/v1/scm/pull-requests/check-status', params);
}

/**
 * Post comment to PR
 */
export function postPRComment(params: {
  provider: 'github' | 'gitlab';
  repository: string;
  prNumber: number;
  comment: string;
}) {
  return api.post('/v1/scm/pull-requests/comment', params);
}

/**
 * Get PR check status summary
 */
export function getPRCheckStatus(repository: string, prNumber: number) {
  return api.get(`/v1/scm/pull-requests/${repository}/${prNumber}/checks`);
}
