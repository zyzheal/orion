/**
 * AI Review API Service
 * AI-powered code review, rule management, and configuration
 */
import { api } from './client';

export interface AIReviewResult {
  id: string;
  prId: string;
  repoId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  passRate: number;
  createdAt: string;
  completedAt?: string;
}

export interface AIReviewRule {
  id: string;
  name: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  pattern: string;
  description: string;
  suggestion?: string;
  enabled: boolean;
  fileExtensions?: string[];
}

export interface AIReviewConfig {
  model: string;
  promptTemplate: string;
  reviewScope: string;
}

export interface ReviewHistoryParams {
  status?: string;
  repoId?: string;
  page?: number;
  pageSize?: number;
}

export interface TriggerReviewInput {
  prId: string;
  repoId: string;
  ruleIds?: string[];
}

export interface ReviewDiffInput {
  prId: string;
  repoId: string;
  baseBranch?: string;
  targetBranch?: string;
}

// ==================== Review Execution ====================

export function triggerReview(data: TriggerReviewInput) {
  return api.post<AIReviewResult>('/v1/ai-review/review', data);
}

export function reviewDiff(data: ReviewDiffInput) {
  return api.post<AIReviewResult>('/v1/ai-review/review-diff', data);
}

// ==================== Review History ====================

export function getReviewHistory(params?: ReviewHistoryParams) {
  return api.get<{ items: AIReviewResult[]; total: number }>('/v1/ai-review/history', { params });
}

export function getReviewDetail(reviewId: string) {
  return api.get<AIReviewResult>(`/v1/ai-review/history/${reviewId}`);
}

// ==================== Review Rules ====================

export function getReviewRules() {
  return api.get<{ items: AIReviewRule[] }>('/v1/ai-review/rules');
}

export function getEnabledRules() {
  return api.get<{ items: AIReviewRule[] }>('/v1/ai-review/rules/enabled');
}

export function getReviewRule(ruleId: string) {
  return api.get<AIReviewRule>(`/v1/ai-review/rules/${ruleId}`);
}

export function createReviewRule(data: Omit<AIReviewRule, 'id'>) {
  return api.post<AIReviewRule>('/v1/ai-review/rules', data);
}

export function updateReviewRule(ruleId: string, data: Partial<AIReviewRule>) {
  return api.put<AIReviewRule>(`/v1/ai-review/rules/${ruleId}`, data);
}

export function deleteReviewRule(ruleId: string) {
  return api.delete(`/v1/ai-review/rules/${ruleId}`);
}

export function toggleReviewRule(ruleId: string) {
  return api.patch(`/v1/ai-review/rules/${ruleId}/toggle`);
}

// ==================== Review Config ====================

export function getReviewConfig() {
  return api.get<AIReviewConfig>('/v1/ai-review/config');
}

export function updateReviewConfig(data: AIReviewConfig) {
  return api.put<AIReviewConfig>('/v1/ai-review/config', data);
}
