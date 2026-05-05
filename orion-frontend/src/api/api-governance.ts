/**
 * API Governance API
 * Phase 4 - Contract management, version control, governance rules, compliance reports
 */

import apiClient from './client';

export interface GovernanceContract {
  id: string;
  tenant_id: string;
  name: string;
  version: string;
  description: string | null;
  spec_type: 'openapi' | 'graphql' | 'grpc' | 'custom';
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  compliance_score: number;
  violation_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiVersion {
  id: string;
  contract_id: string;
  version: string;
  changelog: string | null;
  breaking_changes: boolean;
  status: 'active' | 'deprecated' | 'archived';
  created_at: string;
}

export interface GovernanceRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: 'naming' | 'versioning' | 'security' | 'performance' | 'documentation';
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  created_at: string;
}

export interface GovernanceViolation {
  id: string;
  contract_id: string;
  rule_id: string;
  rule_name: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  location: string;
  resolved: boolean;
  created_at: string;
}

export interface GovernanceReport {
  overall_score: number;
  contract_count: number;
  violation_count: number;
  compliance_rate: number;
  trend: 'improving' | 'stable' | 'degrading';
  generated_at: string;
}

export const apiGovernanceApi = {
  // Contracts
  listContracts: async (params?: { status?: string; search?: string }) => {
    const response = await apiClient.get('/api/v1/api-governance/contracts', { params });
    return response.data;
  },

  getContract: async (contractId: string) => {
    const response = await apiClient.get(`/api/v1/api-governance/contracts/${contractId}`);
    return response.data as GovernanceContract;
  },

  createContract: async (data: { name: string; version: string; spec_type: string; description?: string }) => {
    const response = await apiClient.post('/api/v1/api-governance/contracts', data);
    return response.data as GovernanceContract;
  },

  evaluateContract: async (contractId: string) => {
    const response = await apiClient.post(`/api/v1/api-governance/contracts/${contractId}/evaluate`);
    return response.data;
  },

  // Versions
  listVersions: async (contractId: string) => {
    const response = await apiClient.get(`/api/v1/api-governance/contracts/${contractId}/versions`);
    return response.data as ApiVersion[];
  },

  createVersion: async (data: { contract_id: string; version: string; changelog?: string }) => {
    const response = await apiClient.post('/api/v1/api-governance/versions', data);
    return response.data as ApiVersion;
  },

  checkCompatibility: async (data: { from_version: string; to_version: string }) => {
    const response = await apiClient.post('/api/v1/api-governance/compatibility', data);
    return response.data;
  },

  // Rules
  listRules: async () => {
    const response = await apiClient.get('/api/v1/api-governance/rules');
    return response.data as GovernanceRule[];
  },

  createRule: async (data: { name: string; category: string; severity: string; description?: string }) => {
    const response = await apiClient.post('/api/v1/api-governance/rules', data);
    return response.data as GovernanceRule;
  },

  // Violations
  listViolations: async (params?: { contractId?: string; severity?: string; resolved?: boolean }) => {
    const response = await apiClient.get('/api/v1/api-governance/violations', { params });
    return response.data as GovernanceViolation[];
  },

  // Reports
  getReport: async (params?: { period?: string }) => {
    const response = await apiClient.get('/api/v1/api-governance/report', { params });
    return response.data as GovernanceReport;
  },
};

export default apiGovernanceApi;
