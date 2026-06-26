/**
 * Alert Breaker API
 * Phase 1 - Circuit breaker rules for alert suppression and evaluation
 */
import apiClient from './client';

export interface BreakerConfig {
  dedupWindowMinutes?: number;
  suppressStart?: string;
  suppressEnd?: string;
  suppressTimezone?: string;
  throttleMaxCount?: number;
  throttleIntervalMinutes?: number;
}

export interface AlertBreakerRule {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  ruleType: 'dedup' | 'suppress' | 'throttle';
  matchConditions: Record<string, unknown>;
  config: BreakerConfig;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBreakerRuleInput {
  name: string;
  description?: string;
  ruleType: 'dedup' | 'suppress' | 'throttle';
  matchConditions: Record<string, unknown>;
  config: BreakerConfig;
  enabled?: boolean;
}

export interface UpdateBreakerRuleInput {
  name?: string;
  description?: string;
  ruleType?: 'dedup' | 'suppress' | 'throttle';
  matchConditions?: Record<string, unknown>;
  config?: BreakerConfig;
  enabled?: boolean;
}

export interface AlertEvaluationResult {
  allowed: boolean;
  reason?: string;
  matchedRuleId?: string;
}

export const listBreakerRules = (params?: { ruleType?: string }) =>
  apiClient.get<AlertBreakerRule[]>('/alert-breakers/rules', { params });

export const getBreakerRule = (id: string) =>
  apiClient.get<AlertBreakerRule>(`/alert-breakers/rules/${id}`);

export const createBreakerRule = (data: CreateBreakerRuleInput) =>
  apiClient.post<AlertBreakerRule>('/alert-breakers/rules', data);

export const updateBreakerRule = (id: string, data: UpdateBreakerRuleInput) =>
  apiClient.put<AlertBreakerRule>(`/alert-breakers/rules/${id}`, data);

export const deleteBreakerRule = (id: string) =>
  apiClient.delete(`/alert-breakers/rules/${id}`);

export const evaluateAlert = (alert: { fingerprint: string; labels: Record<string, string>; severity: string; timestamp: string }) =>
  apiClient.post<AlertEvaluationResult>('/alert-breakers/evaluate', { alert });
