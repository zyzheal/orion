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

export async function triggerReview(data: TriggerReviewInput) {
  const res = await api.post('/v1/ai-review/review', data);
  const body = res.data as { success: boolean; data: AIReviewResult };
  return { data: { data: body.data } };
}

export async function reviewDiff(data: ReviewDiffInput) {
  const res = await api.post('/v1/ai-review/review-diff', data);
  const body = res.data as { success: boolean; data: AIReviewResult };
  return { data: { data: body.data } };
}

// ==================== Review History ====================

export async function getReviewHistory(params?: ReviewHistoryParams) {
  const res = await api.get('/v1/ai-review/history', { params });
  const body = res.data as { success: boolean; data: { items: AIReviewResult[]; total: number } };
  return { data: { data: body.data } };
}

export async function getReviewDetail(reviewId: string) {
  const res = await api.get(`/v1/ai-review/history/${reviewId}`);
  const body = res.data as { success: boolean; data: AIReviewResult };
  return { data: { data: body.data } };
}

// ==================== Review Rules ====================

export async function getReviewRules() {
  const res = await api.get('/v1/ai-review/rules');
  const body = res.data as { success: boolean; data: { items: AIReviewRule[] } };
  return { data: { data: body.data } };
}

export async function getEnabledRules() {
  const res = await api.get('/v1/ai-review/rules/enabled');
  const body = res.data as { success: boolean; data: { items: AIReviewRule[] } };
  return { data: { data: body.data } };
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

export async function getReviewConfig() {
  const res = await api.get('/v1/ai-review/config');
  const body = res.data as { success: boolean; data: AIReviewConfig };
  return { data: { data: body.data } };
}

export async function updateReviewConfig(data: AIReviewConfig) {
  const res = await api.put('/v1/ai-review/config', data);
  const body = res.data as { success: boolean; data: AIReviewConfig };
  return { data: { data: body.data } };
}
