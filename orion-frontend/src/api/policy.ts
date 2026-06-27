/**
 * OPA Policy Engine API Service
 *
 * Aligned with backend /api/v1/policies/* routes (policy-routes.ts)
 * Covers: policy CRUD, evaluation, violations, overrides, bundles, exemptions, testing, toggle
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface Policy {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type?: string;
  rego?: string;
  enabled?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  resources?: string[];
  created_at: string;
  updated_at: string;
}

export interface PolicyEvaluation {
  id: string;
  policyId: string;
  resourceId?: string;
  resourceType?: string;
  result: 'allow' | 'deny' | 'error';
  details?: Record<string, any>;
  evaluatedAt: string;
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  policyName?: string;
  resourceId: string;
  resourceType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'waived' | 'resolved';
  message?: string;
  detectedAt: string;
  waivedAt?: string;
  waivedBy?: string;
  resolvedAt?: string;
}

export interface PolicyOverride {
  id: string;
  policyId: string;
  resourceId: string;
  resourceType: string;
  reason: string;
  approvedBy: string;
  expiresAt?: string;
  createdAt: string;
}

export interface PolicyBundle {
  id: string;
  name: string;
  description?: string;
  sourceUrl?: string;
  policyCount: number;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface Exemption {
  id: string;
  violationId: string;
  policyId?: string;
  runId?: string;
  reason: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  requestedBy: string;
  reviewedBy?: string;
  reviewComment?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface PolicyTestResult {
  testId: string;
  passed: number;
  failed: number;
  results: Array<{ testCase: string; passed: boolean; actual?: any; expected?: any }>;
}

// ==================== Policy Definitions CRUD ====================

export const listPolicies = async (params?: {
  type?: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ policies: Policy[]; total: number }> => {
  const response = await api.get<{ data: Policy[]; total?: number }>('/v1/policies', { params });
  return { policies: response.data.data, total: response.data.total ?? response.data.data.length };
};

export const getPolicy = async (id: string): Promise<Policy> => {
  const response = await api.get<{ data: Policy }>(`/v1/policies/${id}`);
  return response.data.data;
};

export const createPolicy = async (data: {
  name: string;
  description?: string;
  type?: string;
  rego?: string;
  enabled?: boolean;
  severity?: string;
  resources?: string[];
}): Promise<Policy> => {
  const response = await api.post<{ data: Policy }>('/v1/policies', data);
  return response.data.data;
};

export const updatePolicy = async (id: string, data: Partial<Policy>): Promise<Policy> => {
  const response = await api.put<{ data: Policy }>(`/v1/policies/${id}`, data);
  return response.data.data;
};

export const deletePolicy = async (id: string): Promise<void> => {
  await api.delete(`/v1/policies/${id}`);
};

// ==================== Evaluation Endpoints ====================

export const evaluatePolicy = async (data: {
  policyId: string;
  resourceId?: string;
  resourceType?: string;
  input?: Record<string, any>;
}): Promise<PolicyEvaluation> => {
  const response = await api.post<{ data: PolicyEvaluation }>('/v1/policies/evaluate-policy', data);
  return response.data.data;
};

export const getEvaluationHistory = async (params?: {
  policyId?: string;
  limit?: number;
  offset?: number;
}): Promise<PolicyEvaluation[]> => {
  const response = await api.get<{ data: PolicyEvaluation[] }>('/v1/policies/evaluations', { params });
  return response.data.data;
};

export const evaluatePolicyForRun = async (data: {
  policyId: string;
  runId: string;
}): Promise<PolicyEvaluation> => {
  const response = await api.post<{ data: PolicyEvaluation }>('/v1/policies/evaluate', data);
  return response.data.data;
};

export const listEvaluations = async (params?: {
  policyId?: string;
  runId?: string;
  limit?: number;
  offset?: number;
}): Promise<PolicyEvaluation[]> => {
  const response = await api.get<{ data: PolicyEvaluation[] }>('/v1/policies/evaluations/runs', { params });
  return response.data.data;
};

export const evaluateGate = async (gateId: string, data?: {
  runId?: string;
  context?: Record<string, any>;
}): Promise<PolicyEvaluation> => {
  const response = await api.post<{ data: PolicyEvaluation }>(`/v1/policies/gate/${gateId}/evaluate`, data);
  return response.data.data;
};

// ==================== Violations ====================

export const listViolations = async (params?: {
  policyId?: string;
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ violations: PolicyViolation[]; total: number }> => {
  const response = await api.get<{ data: PolicyViolation[]; total?: number }>('/v1/policies/violations', { params });
  return { violations: response.data.data, total: response.data.total ?? response.data.data.length };
};

export const getViolation = async (id: string): Promise<PolicyViolation> => {
  const response = await api.get<{ data: PolicyViolation }>(`/v1/policies/violations/${id}`);
  return response.data.data;
};

export const waiveViolation = async (id: string, data: {
  reason: string;
  waivedBy: string;
}): Promise<PolicyViolation> => {
  const response = await api.post<{ data: PolicyViolation }>(`/v1/policies/violations/${id}/waive`, data);
  return response.data.data;
};

export const resolveViolation = async (id: string, data?: {
  resolution?: string;
}): Promise<PolicyViolation> => {
  const response = await api.post<{ data: PolicyViolation }>(`/v1/policies/violations/${id}/resolve`, data);
  return response.data.data;
};

// ==================== Overrides ====================

export const listOverrides = async (params?: {
  policyId?: string;
  limit?: number;
  offset?: number;
}): Promise<PolicyOverride[]> => {
  const response = await api.get<{ data: PolicyOverride[] }>('/v1/policies/overrides', { params });
  return response.data.data;
};

export const createOverride = async (data: {
  policyId: string;
  resourceId: string;
  resourceType: string;
  reason: string;
  expiresAt?: string;
}): Promise<PolicyOverride> => {
  const response = await api.post<{ data: PolicyOverride }>('/v1/policies/overrides', data);
  return response.data.data;
};

// ==================== Bundle Management ====================

export const listBundles = async (): Promise<PolicyBundle[]> => {
  const response = await api.get<{ data: PolicyBundle[] }>('/v1/policies/bundles');
  return response.data.data;
};

export const getBundle = async (id: string): Promise<PolicyBundle> => {
  const response = await api.get<{ data: PolicyBundle }>(`/v1/policies/bundles/${id}`);
  return response.data.data;
};

export const syncBundles = async (sourceUrl?: string): Promise<{ synced: number; errors: number }> => {
  const response = await api.post<{ data: { synced: number; errors: number } }>('/v1/policies/bundles/sync', { sourceUrl });
  return response.data.data;
};

// ==================== Policy Testing ====================

export const testPolicy = async (data: {
  rego: string;
  testCases: Array<Record<string, unknown>>;
}): Promise<PolicyTestResult> => {
  const response = await api.post<{ data: PolicyTestResult }>('/v1/policies/test', data);
  return response.data.data;
};

// ==================== Toggle Policy ====================

export const togglePolicy = async (id: string): Promise<Policy> => {
  const response = await api.patch<{ data: Policy }>(`/v1/policies/${id}/toggle`);
  return response.data.data;
};

// ==================== Exemption Management ====================

export const submitExemption = async (data: {
  violationId: string;
  policyId?: string;
  runId?: string;
  reason: string;
  category: string;
  requestedBy: string;
  expiresAt?: string;
}): Promise<Exemption> => {
  const response = await api.post<{ data: Exemption }>('/v1/policies/exemptions', data);
  return response.data.data;
};

export const listExemptions = async (params?: {
  status?: string;
  policyId?: string;
  requestedBy?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ exemptions: Exemption[]; total: number }> => {
  const response = await api.get<{ data: Exemption[]; total?: number }>('/v1/policies/exemptions', { params });
  return { exemptions: response.data.data, total: response.data.total ?? response.data.data.length };
};

export const getExemption = async (id: string): Promise<Exemption> => {
  const response = await api.get<{ data: Exemption }>(`/v1/policies/exemptions/${id}`);
  return response.data.data;
};

export const reviewExemption = async (id: string, data: {
  action: 'approve' | 'reject';
  comment?: string;
  reviewer: string;
}): Promise<Exemption> => {
  const response = await api.post<{ data: Exemption }>(`/v1/policies/exemptions/${id}/review`, data);
  return response.data.data;
};

export const revokeExemption = async (id: string): Promise<Exemption> => {
  const response = await api.delete<{ data: Exemption }>(`/v1/policies/exemptions/${id}`);
  return response.data.data;
};
