/**
 * Feature Flags API Client
 *
 * Note: Backend API not yet implemented. This module defines
 * the expected interface for when the backend is available.
 *
 * Expected backend routes:
 * - GET /api/feature-flags - list all feature flags
 * - POST /api/feature-flags - create feature flag
 * - PUT /api/feature-flags/:id - update feature flag
 * - DELETE /api/feature-flags/:id - delete feature flag
 * - POST /api/feature-flags/:id/evaluate - evaluate flag for tenant/user
 * - POST /api/feature-flags/:id/toggle - enable/disable flag
 */

import { api } from './client';

export type FlagType = 'boolean' | 'percentage' | 'string' | 'number';
export type FlagStrategy = 'default' | 'tenant' | 'user-group' | 'percentage';

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  type: FlagType;
  defaultValue: string;
  strategy: FlagStrategy;
  enabled: boolean;
  tenantId?: string;
  userGroups?: string[];
  percentage?: number;
  evaluationCount: number;
  lastEvaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlagEvaluationResult {
  flagId: string;
  flagKey: string;
  result: string | boolean;
  reason: string;
  tenantId?: string;
  userId?: string;
  evaluatedAt: string;
}

export interface FeatureFlagStats {
  totalFlags: number;
  enabledFlags: number;
  totalEvaluations: number;
  tenantScopedFlags: number;
}

export async function getFeatureFlags(params?: { tenantId?: string; enabled?: boolean }) {
  return api.get<FeatureFlag[]>('/api/feature-flags', { params });
}

export async function createFeatureFlag(
  data: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt' | 'evaluationCount'>
) {
  return api.post<FeatureFlag>('/api/feature-flags', data);
}

export async function updateFeatureFlag(id: string, data: Partial<FeatureFlag>) {
  return api.put<FeatureFlag>(`/api/feature-flags/${id}`, data);
}

export async function deleteFeatureFlag(id: string) {
  return api.delete<void>(`/api/feature-flags/${id}`);
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  return api.post<FeatureFlag>(`/api/feature-flags/${id}/toggle`, { enabled });
}

export async function evaluateFeatureFlag(
  id: string,
  context: { tenantId?: string; userId?: string; userGroups?: string[] }
) {
  return api.post<FlagEvaluationResult>(`/api/feature-flags/${id}/evaluate`, context);
}

export async function getFeatureFlagStats() {
  return api.get<FeatureFlagStats>('/api/feature-flags/stats');
}
