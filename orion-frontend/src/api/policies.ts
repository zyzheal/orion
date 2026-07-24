/**
 * OPA Policy Engine API Service
 * Policy definitions, violations, overrides, and evaluation
 */
import { api } from './client';

// ---- Types ----

export interface PolicyDefinition {
  id: string;
  name: string;
  description?: string;
  category: 'security' | 'cost' | 'quality' | 'governance';
  regoPath: string;
  gateId?: string;
  severity: 'block' | 'warning' | 'info';
  enabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyViolation {
  id: string;
  evaluationId?: string;
  policyId?: string;
  policyName?: string;
  severity: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  status: 'open' | 'waived' | 'resolved';
  createdAt: string;
}

export interface PolicyOverride {
  id: string;
  policyId?: string;
  violationId?: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  scope: 'global' | 'project' | 'environment';
}

export interface PolicyBundle {
  id: string;
  bundleName: string;
  gitRef: string;
  regoContent: Record<string, string>;
  testResults?: Record<string, unknown>;
  deployedAt: string;
  deployedBy?: string;
  status: 'active' | 'deprecated' | 'failed';
}

export interface PolicyEvaluation {
  id: string;
  policyId?: string;
  runId: string;
  inputContext: Record<string, unknown>;
  result: Record<string, unknown>;
  evaluatedAt: string;
  evaluationMs?: number;
}

// ---- Params ----

export interface PolicyListParams {
  category?: string;
  severity?: string;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PolicyInput {
  name: string;
  description?: string;
  category: 'security' | 'cost' | 'quality' | 'governance';
  regoPath: string;
  gateId?: string;
  severity: 'block' | 'warning' | 'info';
  enabled?: boolean;
}

export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  category?: string;
  regoPath?: string;
  gateId?: string;
  severity?: string;
  enabled?: boolean;
}

export interface PolicyEvaluateInput {
  policyId: string;
  input: Record<string, unknown>;
}

export interface PolicyViolationListParams {
  status?: string;
  severity?: string;
  policyId?: string;
  page?: number;
  pageSize?: number;
}

export interface ViolationWaiveInput {
  reason: string;
  expiresAt: string;
  scope?: string;
}

export interface PolicyTestInput {
  rego: string;
  testCases: Array<Record<string, unknown>>;
}

// ---- Policy Management ----

export function getPolicies(params?: PolicyListParams) {
  return api.get('/api/v1/policies', { params });
}

export function getPolicy(id: string) {
  return api.get(`/api/v1/policies/${id}`);
}

export function createPolicy(data: PolicyInput) {
  return api.post('/api/v1/policies', data);
}

export function updatePolicy(id: string, data: UpdatePolicyInput) {
  return api.put(`/api/v1/policies/${id}`, data);
}

export function deletePolicy(id: string) {
  return api.delete(`/api/v1/policies/${id}`);
}

export function togglePolicy(id: string) {
  return api.patch(`/api/v1/policies/${id}/toggle`);
}

// ---- Bundle Sync ----

export function syncPolicyBundles() {
  return api.post('/api/v1/policies/bundles/sync');
}

export function getPolicyBundles() {
  return api.get('/api/v1/policies/bundles');
}

export function getPolicyBundle(id: string) {
  return api.get(`/api/v1/policies/bundles/${id}`);
}

// ---- Policy Evaluation ----

export function evaluatePolicy(data: PolicyEvaluateInput) {
  return api.post('/api/v1/policies/evaluate', data);
}

export function getPolicyEvaluations(params?: { runId?: string }) {
  return api.get('/api/v1/policies/evaluations', { params });
}

export function evaluateGate(gateId: string, data?: Record<string, unknown>) {
  return api.post(`/api/v1/policies/gate/${gateId}/evaluate`, data);
}

// ---- Violations ----

export function getPolicyViolations(params?: PolicyViolationListParams) {
  return api.get('/api/v1/policies/violations', { params });
}

export function getPolicyViolation(id: string) {
  return api.get(`/api/v1/policies/violations/${id}`);
}

export function waiveViolation(id: string, data: ViolationWaiveInput) {
  return api.post(`/api/v1/policies/violations/${id}/waive`, data);
}

export function resolveViolation(id: string) {
  return api.post(`/api/v1/policies/violations/${id}/resolve`);
}

// ---- Overrides ----

export function getPolicyOverrides(params?: { scope?: string }) {
  return api.get('/api/v1/policies/overrides', { params });
}

export function createPolicyOverride(data: {
  policyId?: string;
  violationId?: string;
  reason: string;
  expiresAt: string;
  scope?: string;
}) {
  return api.post('/api/v1/policies/overrides', data);
}

// ---- Policy Test ----

export function testPolicy(data: PolicyTestInput) {
  return api.post('/api/v1/policies/test', data);
}

export function getPolicyTestResults(testId: string) {
  return api.get(`/api/v1/policies/test/results/${testId}`);
}
