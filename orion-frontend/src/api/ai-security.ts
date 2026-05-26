/**
 * AI Security API Client
 *
 * Backend routes: orion-platform-service/src/api/ai-security-routes.ts
 */

import { api } from './client';

export interface SecurityStats {
  policiesActive: number;
  requestsBlocked: number;
  complianceScore: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rule: string;
  action: 'block' | 'warn' | 'log';
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyEvaluation {
  id: string;
  policyId: string;
  policyName: string;
  status: 'pass' | 'fail' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  evaluatedAt: string;
}

export async function getSecurityStats() {
  return api.get<SecurityStats>('/v1/ai-security/stats');
}

export async function getPolicies() {
  return api.get<SecurityPolicy[]>('/v1/ai-security/policies');
}

export async function createPolicy(
  input: Omit<SecurityPolicy, 'id' | 'matchCount' | 'createdAt' | 'updatedAt'>
) {
  return api.post<SecurityPolicy>('/v1/ai-security/policies', input);
}

export async function updatePolicy(id: string, input: Partial<SecurityPolicy>) {
  return api.put<SecurityPolicy>(`/v1/ai-security/policies/${id}`, input);
}

export async function deletePolicy(id: string) {
  return api.delete<void>(`/v1/ai-security/policies/${id}`);
}

export async function togglePolicy(id: string, enabled: boolean) {
  return api.patch<SecurityPolicy>(`/v1/ai-security/policies/${id}/toggle`, {
    enabled,
  });
}

export async function getEvaluations(policyId?: string) {
  const qs = policyId ? `?policyId=${policyId}` : '';
  return api.get<PolicyEvaluation[]>(`/v1/ai-security/evaluations${qs}`);
}
