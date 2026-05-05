/**
 * API Governance API
 * Phase 4 - Contract testing and version management
 */

import apiClient from './client';

export interface APIContract {
  id: string;
  tenant_id: string;
  service_name: string;
  version: string;
  spec: Record<string, unknown>;
  status: 'active' | 'deprecated' | 'retired';
  created_at: string;
}

export interface ContractVerificationResult {
  contract_id: string;
  passed: boolean;
  total: number;
  passed_count: number;
  failed_count: number;
  warnings: string[];
  verified_at: string;
}

export interface CompatibilityCheckResult {
  compatible: boolean;
  breaking_changes: BreakingChange[];
  non_breaking_changes: string[];
}

export interface BreakingChange {
  endpoint: string;
  type: 'field_removed' | 'type_changed' | 'required_added' | 'path_changed';
  description: string;
  severity: 'high' | 'medium';
}

export const governanceApi = {
  // Contracts
  listContracts: async (params?: { service?: string; status?: string }) => {
    const response = await apiClient.get('/api/v1/governance/contracts', { params });
    return response.data;
  },

  getContract: async (contractId: string) => {
    const response = await apiClient.get(`/api/v1/governance/contracts/${contractId}`);
    return response.data as APIContract;
  },

  uploadContract: async (data: { service_name: string; version: string; spec: Record<string, unknown> }) => {
    const response = await apiClient.post('/api/v1/governance/contracts/upload', data);
    return response.data as APIContract;
  },

  verifyContract: async (contractId: string, scope?: 'provider' | 'consumer') => {
    const response = await apiClient.post(`/api/v1/governance/contracts/${contractId}/verify`, { scope });
    return response.data as ContractVerificationResult;
  },

  getContractChanges: async (contractId: string) => {
    const response = await apiClient.get(`/api/v1/governance/contracts/${contractId}/changes`);
    return response.data;
  },

  // Versions
  listVersions: async (params?: { service?: string }) => {
    const response = await apiClient.get('/api/v1/governance/versions', { params });
    return response.data;
  },

  updateVersionStatus: async (versionId: string, status: 'active' | 'deprecated' | 'retired') => {
    const response = await apiClient.put(`/api/v1/governance/versions/${versionId}/status`, { status });
    return response.data;
  },

  checkCompatibility: async (contractId: string, newSpec: Record<string, unknown>) => {
    const response = await apiClient.post(`/api/v1/governance/versions/${contractId}/compatibility-check`, { newSpec });
    return response.data as CompatibilityCheckResult;
  },

  // Impact Analysis
  analyzeImpact: async (data: { contract_id: string; changes: Array<{ endpoint: string; change_type: string }> }) => {
    const response = await apiClient.post('/api/v1/governance/impact-analysis', data);
    return response.data;
  },
};

export default governanceApi;