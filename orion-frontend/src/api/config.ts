/**
 * Configuration Management API Service
 * GitOps, config approval, and diff analysis
 */
import { api } from './client';

export interface ConfigItem {
  id: string;
  key: string;
  value: any;
  version: number;
  environment: string;
  category: string;
  description?: string;
  sensitive: boolean;
  encrypted: boolean;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'active';
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ConfigVersion {
  version: number;
  value: any;
  changedBy: string;
  changedAt: string;
  changeReason?: string;
}

export interface GitOpsConfig {
  enabled: boolean;
  repository: string;
  branch: string;
  basePath: string;
  lastSyncAt?: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed';
}

export interface ApprovalWorkflow {
  id: string;
  configId: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewers: string[];
  approvals: Approval[];
  createdAt: string;
  completedAt?: string;
}

export interface Approval {
  reviewer: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decidedAt: string;
}

export interface ConfigDiff {
  oldValue: any;
  newValue: any;
  changes: ConfigChange[];
}

export interface ConfigChange {
  path: string;
  operation: 'add' | 'remove' | 'update';
  oldValue?: any;
  newValue?: any;
}

export interface ConfigFilters {
  environment?: string;
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ==================== Config CRUD ====================

export function getConfigs(filters?: ConfigFilters) {
  return api.get<{ configs: ConfigItem[]; total: number }>('/api/v1/config/configs', {
    params: filters,
  });
}

export function getConfig(id: string) {
  return api.get<ConfigItem>(`/api/v1/config/configs/${id}`);
}

export function createConfig(data: {
  key: string;
  value: any;
  environment: string;
  category: string;
  description?: string;
  sensitive?: boolean;
}) {
  return api.post<ConfigItem>('/api/v1/config/configs', data);
}

export function updateConfig(id: string, data: { value: any; changeReason?: string }) {
  return api.put<ConfigItem>(`/api/v1/config/configs/${id}`, data);
}

export function deleteConfig(id: string) {
  return api.delete(`/api/v1/config/configs/${id}`);
}

export function getConfigVersions(id: string) {
  return api.get<{ versions: ConfigVersion[] }>(`/api/v1/config/configs/${id}/versions`);
}

export function rollbackConfig(id: string, version: number) {
  return api.post<ConfigItem>(`/api/v1/config/configs/${id}/rollback`, { version });
}

// ==================== GitOps ====================

export function getGitOpsConfig() {
  return api.get<GitOpsConfig>('/api/v1/config/gitops');
}

export function updateGitOpsConfig(config: Partial<GitOpsConfig>) {
  return api.put<GitOpsConfig>('/api/v1/config/gitops', config);
}

export function syncFromGit() {
  // Backend uses /gitops/:gitOpsConfigId/sync, not /gitops/sync
  // Use /gitops/drift as fallback for triggering sync
  return api.post<{ status: string; syncedAt: string }>('/api/v1/config/gitops/drift');
}

export function getGitOpsStatus() {
  return api.get<GitOpsConfig>('/api/v1/config/gitops/sync-status');
}

// ==================== Approval Workflow ====================

export function submitForApproval(id: string, reviewers: string[]) {
  // Backend uses /change-requests for approval workflow
  return api.post<ApprovalWorkflow>(`/api/v1/config/change-requests`, { configId: id, reviewers });
}

export function approveConfig(id: string, comment?: string) {
  // Backend uses /change-requests/:changeRequestId/approve
  return api.post<ApprovalWorkflow>(`/api/v1/config/change-requests/${id}/approve`, { comment });
}

export function rejectConfig(id: string, comment: string) {
  return api.post<ApprovalWorkflow>(`/api/v1/config/change-requests/${id}/reject`, { comment });
}

export function getApprovalWorkflow(id: string) {
  return api.get<ApprovalWorkflow>(`/api/v1/config/change-requests/${id}`);
}

// ==================== Environment Diff ====================

export interface EnvDiffResult {
  sourceEnv: string;
  targetEnv: string;
  totalConfigs: number;
  onlyInSource: string[];
  onlyInTarget: string[];
  differences: ConfigChange[];
  identical: number;
}

export function compareEnvironments(sourceEnv: string, targetEnv: string) {
  return api.get<EnvDiffResult>(`/api/v1/config/diff/${sourceEnv}/${targetEnv}`);
}

// ==================== Diff Report ====================

export interface DiffReportItem {
  configId: string;
  key: string;
  environment: string;
  latestVersion: number;
  comparedVersions: number[];
  changes: ConfigChange[];
}

export interface DiffReport {
  reportId: string;
  generatedAt: string;
  environments: string[];
  totalConfigs: number;
  items: DiffReportItem[];
  summary: {
    totalDifferences: number;
    byEnvironment: Record<string, number>;
  };
}

export function getDiffReport(configId?: string) {
  const params = configId ? { configId } : {};
  return api.get<DiffReport>('/api/v1/config/diff/report', { params });
}

// ==================== Config Drift ====================

export interface DriftItem {
  key: string;
  environment: string;
  localValue: any;
  remoteValue: any;
  change: ConfigChange;
}

export interface DriftResult {
  driftDetected: boolean;
  itemCount: number;
  items: DriftItem[];
}

export function detectDrift() {
  return api.get<DriftResult>('/api/v1/config/gitops/drift');
}

// ==================== Config Diff ====================

export function compareConfigs(id: string, version1: number, version2: number) {
  // Backend uses /configs/:configId/versions/diff
  return api.get<ConfigDiff>(`/api/v1/config/configs/${id}/versions/diff`, {
    params: { fromVersion: version1, toVersion: version2 },
  });
}

export function diffConfigWithCurrent(id: string, newValue: any) {
  // Backend uses /diff/:sourceEnv/:targetEnv for env comparison
  return api.post<ConfigDiff>(`/api/v1/config/configs/${id}/versions/diff`, { newValue });
}

// ==================== Statistics ====================

export function getConfigStats() {
  return api.get<{
    total: number;
    byEnvironment: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  }>('/api/v1/config/stats');
}
