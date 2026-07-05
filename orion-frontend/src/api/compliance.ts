/**
 * Security Compliance API
 * Phase 3 - Compliance policies, evaluation, audit management
 */
import apiClient from './client';
import { API_PATHS } from '@/constants/api-paths';

export interface CompliancePolicy {
  id: string;
  name: string;
  framework: string;
  description: string;
  rules: ComplianceRule[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceEvaluation {
  id: string;
  policyId: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  score: number;
  violations: ComplianceViolation[];
  evaluatedAt: string;
}

export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  severity: string;
  description: string;
  resource: string;
}

export interface ComplianceReport {
  policyId: string;
  evaluationId: string;
  score: number;
  status: string;
  violations: ComplianceViolation[];
  generatedAt: string;
}

export interface ComplianceScore {
  overall: number;
  byFramework: Record<string, number>;
  trend: 'improving' | 'stable' | 'degrading';
  lastEvaluatedAt: string;
}

export interface AuditPlan {
  id: string;
  name: string;
  scope: string[];
  schedule: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
}

export interface AuditReport {
  auditId: string;
  status: string;
  findings: AuditFinding[];
  completedAt: string;
}

export interface AuditFinding {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  createdAt: string;
}

export const complianceApi = {
  // Compliance Policies
  definePolicy: async (data: { name: string; framework: string; description: string; rules: ComplianceRule[] }) => {
    const response = await apiClient.post(API_PATHS.COMPLIANCE.POLICIES, data);
    return response.data as CompliancePolicy;
  },

  listPolicies: async (params?: { framework?: string; status?: string }) => {
    const response = await apiClient.get(API_PATHS.COMPLIANCE.POLICIES, { params });
    return response.data as CompliancePolicy[];
  },

  // Compliance Evaluation
  evaluateCompliance: async (data: { policyId: string; scope?: string[] }) => {
    const response = await apiClient.post(API_PATHS.COMPLIANCE.EVALUATE, data);
    return response.data as ComplianceEvaluation;
  },

  // Compliance Reports
  getComplianceReport: async (policyId: string) => {
    const response = await apiClient.get(API_PATHS.COMPLIANCE.REPORT(policyId));
    return response.data as ComplianceReport;
  },

  getComplianceScore: async () => {
    const response = await apiClient.get(API_PATHS.COMPLIANCE.SCORE);
    return response.data as ComplianceScore;
  },

  autoRemediateCompliance: async (data: { policyId?: string; violations?: string[] }) => {
    const response = await apiClient.post(API_PATHS.COMPLIANCE.REMEDIATE, data);
    return response.data;
  },

  // Audit Plans
  createAuditPlan: async (data: { name: string; scope: string[]; schedule: string }) => {
    const response = await apiClient.post(API_PATHS.COMPLIANCE.AUDIT_PLANS, data);
    return response.data as AuditPlan;
  },

  listAuditPlans: async (params?: { status?: string }) => {
    const response = await apiClient.get(API_PATHS.COMPLIANCE.AUDIT_PLANS, { params });
    return response.data as AuditPlan[];
  },

  // Audit Execution
  executeAudit: async (auditId: string) => {
    const response = await apiClient.post(API_PATHS.COMPLIANCE.AUDIT_EXECUTE(auditId));
    return response.data;
  },

  getAuditReport: async (auditId: string) => {
    const response = await apiClient.get(API_PATHS.COMPLIANCE.AUDIT_REPORT(auditId));
    return response.data as AuditReport;
  },

  getAuditFindings: async (auditId: string) => {
    const response = await apiClient.get(API_PATHS.COMPLIANCE.AUDIT_FINDINGS(auditId));
    return response.data as AuditFinding[];
  },

  closeFinding: async (findingId: string, data?: { resolution?: string }) => {
    const response = await apiClient.post(API_PATHS.COMPLIANCE.FINDING_CLOSE(findingId), data);
    return response.data;
  },
};

export default complianceApi;
