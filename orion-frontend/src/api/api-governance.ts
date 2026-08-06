/**
 * API Governance API Service
 * Contract management, governance rules, violations, compliance reports
 */
import { api } from './client';

export interface GovernanceContract {
  id: string;
  name: string;
  version: string;
  spec_type: string;
  status: 'active' | 'draft' | 'deprecated';
  compliance_score: number;
  violation_count: number;
  description?: string;
  path?: string;
  created_at: string;
  updated_at: string;
}

export interface GovernanceRule {
  id: string;
  name: string;
  category: string;
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  description?: string;
  created_at: string;
}

export interface GovernanceViolation {
  id: string;
  rule_name: string;
  contract_id: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  location: string;
  resolved: boolean;
  created_at: string;
}

export interface GovernanceReport {
  overall_score: number;
  compliance_rate: number;
  contract_count: number;
  violation_count: number;
  generated_at: string;
}

export interface VerifyContractParams {
  actualResponse: Record<string, unknown>;
  endpoint: string;
  method: string;
}

export interface RegisterVersionParams {
  apiName: string;
  version: string;
  status: string;
  changelog?: string;
}

export interface DeprecateVersionParams {
  replacementVersion?: string;
  retirementDate?: string;
}

export const apiGovernanceApi = {
  listContracts: () => api.get<GovernanceContract[]>('/governance/contracts'),
  getContract: (id: string) => api.get<GovernanceContract>('/governance/contracts/' + id),
  createContract: (data: Partial<GovernanceContract>) => api.post('/governance/contracts', data),

  listRules: () => api.get<GovernanceRule[]>('/governance/rules'),
  createRule: (data: Partial<GovernanceRule>) => api.post('/governance/rules', data),

  listViolations: () => api.get<GovernanceViolation[]>('/governance/violations'),

  getReport: () => api.get<GovernanceReport>('/governance/report'),
  evaluateContract: (contractId: string) =>
    api.post('/governance/contracts/' + contractId + '/evaluate'),

  verifyContract: (contractId: string, params: VerifyContractParams) =>
    api.post('/governance/contracts/' + contractId + '/verify', params),

  listVersions: (contractId: string) =>
    api.get('/governance/contracts/' + contractId + '/versions'),

  registerVersion: (data: RegisterVersionParams) => api.post('/governance/versions', data),
  deprecateVersion: (versionId: string, params: DeprecateVersionParams) =>
    api.put('/governance/versions/' + versionId + '/deprecate', params),
  retireVersion: (versionId: string) => api.delete('/governance/versions/' + versionId),
};
