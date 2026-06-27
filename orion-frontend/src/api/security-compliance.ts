/**
 * Security Compliance API Service
 *
 * Aligned with backend /api/v1/compliance/* and /api/v1/audit/* routes (security-compliance-routes.ts)
 * Covers: compliance policies, evaluation, reports, score, remediation, audit plans, findings, frameworks, evidence, gap analysis
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface CompliancePolicy {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  framework?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  enabled?: boolean;
  rules?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ComplianceEvaluation {
  policyId: string;
  resourceId?: string;
  resourceType?: string;
  result: 'compliant' | 'non-compliant' | 'partial';
  details?: Record<string, any>;
  evaluatedAt: string;
}

export interface ComplianceReport {
  policyId: string;
  policyName: string;
  totalChecks: number;
  passed: number;
  failed: number;
  score: number;
  findings: ComplianceFinding[];
  generatedAt: string;
}

export interface ComplianceScore {
  overall: number;
  byFramework: Record<string, number>;
  trend: Array<{ date: string; score: number }>;
  lastEvaluatedAt: string;
}

export interface RemediationResult {
  policyId: string;
  remediated: number;
  failed: number;
  details: Array<{ resourceId: string; status: string; message?: string }>;
}

export interface AuditPlan {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  scope?: string;
  scheduledAt?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditReport {
  id: string;
  planId: string;
  summary: string;
  findings: ComplianceFinding[];
  score?: number;
  completedAt: string;
}

export interface ComplianceFinding {
  id: string;
  auditId?: string;
  policyId?: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'closed' | 'waived';
  resourceType?: string;
  resourceId?: string;
  remediation?: string;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  description?: string;
  version?: string;
  categories?: string[];
  controlsCount?: number;
}

export interface Evidence {
  id: string;
  policyId: string;
  type: string;
  source: string;
  content: Record<string, any>;
  collectedAt: string;
}

export interface GapAnalysisResult {
  frameworkId: string;
  totalControls: number;
  covered: number;
  gaps: Array<{ controlId: string; description: string; severity: string }>;
  coverage: number;
}

// ==================== Compliance Policies ====================

export const defineCompliancePolicy = async (data: {
  name: string;
  description?: string;
  framework?: string;
  severity?: string;
  enabled?: boolean;
  rules?: Record<string, any>;
}): Promise<CompliancePolicy> => {
  const response = await api.post<{ data: CompliancePolicy }>('/v1/compliance/policies', data);
  return response.data.data;
};

export const listCompliancePolicies = async (params?: {
  framework?: string;
  severity?: string;
  enabled?: boolean;
}): Promise<CompliancePolicy[]> => {
  const response = await api.get<{ data: CompliancePolicy[] }>('/v1/compliance/policies', { params });
  return response.data.data;
};

// ==================== Compliance Evaluation ====================

export const evaluateCompliance = async (data: {
  policyId?: string;
  resourceId?: string;
  resourceType?: string;
  framework?: string;
}): Promise<ComplianceEvaluation> => {
  const response = await api.post<{ data: ComplianceEvaluation }>('/v1/compliance/evaluate', data);
  return response.data.data;
};

// ==================== Compliance Report ====================

export const getComplianceReport = async (policyId: string): Promise<ComplianceReport> => {
  const response = await api.get<{ data: ComplianceReport }>(`/v1/compliance/report/${policyId}`);
  return response.data.data;
};

// ==================== Compliance Score ====================

export const getComplianceScore = async (params?: {
  framework?: string;
}): Promise<ComplianceScore> => {
  const response = await api.get<{ data: ComplianceScore }>('/v1/compliance/score', { params });
  return response.data.data;
};

// ==================== Compliance Remediation ====================

export const autoRemediateCompliance = async (data: {
  policyId?: string;
  findingIds?: string[];
  dryRun?: boolean;
}): Promise<RemediationResult> => {
  const response = await api.post<{ data: RemediationResult }>('/v1/compliance/remediate', data);
  return response.data.data;
};

// ==================== Audit Plans ====================

export const createAuditPlan = async (data: {
  name: string;
  description?: string;
  scope?: string;
  scheduledAt?: string;
}): Promise<AuditPlan> => {
  const response = await api.post<{ data: AuditPlan }>('/v1/audit/plans', data);
  return response.data.data;
};

export const listAuditPlans = async (params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditPlan[]> => {
  const response = await api.get<{ data: AuditPlan[] }>('/v1/audit/plans', { params });
  return response.data.data;
};

// ==================== Audit Execution ====================

export const executeAudit = async (id: string): Promise<AuditReport> => {
  const response = await api.post<{ data: AuditReport }>(`/v1/audit/${id}/execute`);
  return response.data.data;
};

// ==================== Audit Report ====================

export const getAuditReport = async (id: string): Promise<AuditReport> => {
  const response = await api.get<{ data: AuditReport }>(`/v1/audit/${id}/report`);
  return response.data.data;
};

// ==================== Audit Findings ====================

export const getAuditFindings = async (id: string, params?: {
  severity?: string;
  status?: string;
}): Promise<ComplianceFinding[]> => {
  const response = await api.get<{ data: ComplianceFinding[] }>(`/v1/audit/${id}/findings`, { params });
  return response.data.data;
};

export const closeFinding = async (id: string, data?: {
  remediation?: string;
}): Promise<ComplianceFinding> => {
  const response = await api.post<{ data: ComplianceFinding }>(`/v1/audit/findings/${id}/close`, data);
  return response.data.data;
};

// ==================== Compliance Frameworks ====================

export const getComplianceFrameworks = async (): Promise<ComplianceFramework[]> => {
  const response = await api.get<{ data: ComplianceFramework[] }>('/v1/compliance/frameworks');
  return response.data.data;
};

export const getComplianceFramework = async (id: string): Promise<ComplianceFramework> => {
  const response = await api.get<{ data: ComplianceFramework }>(`/v1/compliance/frameworks/${id}`);
  return response.data.data;
};

// ==================== Evidence Collection ====================

export const collectEvidence = async (data: {
  policyId: string;
  type: string;
  source: string;
  content?: Record<string, any>;
}): Promise<Evidence> => {
  const response = await api.post<{ data: Evidence }>('/v1/compliance/evidence', data);
  return response.data.data;
};

export const getEvidence = async (policyId: string): Promise<Evidence[]> => {
  const response = await api.get<{ data: Evidence[] }>(`/v1/compliance/evidence/${policyId}`);
  return response.data.data;
};

export const generateEvidenceCollection = async (data: {
  policyId: string;
  frameworkId?: string;
  autoCollect?: boolean;
}): Promise<Evidence[]> => {
  const response = await api.post<{ data: Evidence[] }>('/v1/compliance/evidence/generate', data);
  return response.data.data;
};

// ==================== Gap Analysis ====================

export const performGapAnalysis = async (data: {
  frameworkId: string;
  scope?: string;
  resourceType?: string;
}): Promise<GapAnalysisResult> => {
  const response = await api.post<{ data: GapAnalysisResult }>('/v1/compliance/gap-analysis', data);
  return response.data.data;
};
