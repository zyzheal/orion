/**
 * Product Line Management API Service
 * Multi-branch product lines, ReleaseTrains, and HotfixChannels
 */
import { api } from './client';

// ---- Types ----

export type BranchMode = 'gitflow' | 'github-flow' | 'trunk-based';
export type PatternType = 'exact' | 'glob' | 'regex';
export type EnvironmentName = 'dev' | 'test' | 'staging' | 'preprod' | 'prod';
export type ProductLinePhase = 'Pending' | 'Active' | 'Suspended' | 'Error' | 'Terminating';

export interface GitRepoConfig {
  url: string;
  provider?: string;
  defaultBranch?: string;
  credentialRef?: { name: string; namespace?: string };
}

export interface ProtectedBranch {
  pattern: string;
  patternType?: PatternType;
  requirePullRequest?: boolean;
  requiredReviewers?: number;
}

export interface BranchPolicies {
  mode: BranchMode;
  protectedBranches?: ProtectedBranch[];
}

export interface BranchEnvironmentMapping {
  branch: string;
  patternType: PatternType;
  environment: EnvironmentName;
  priority?: number;
  autoDeploy?: boolean;
  requireApproval?: boolean;
}

export interface EnvironmentMappings {
  defaultEnvironment?: EnvironmentName;
  mappings: BranchEnvironmentMapping[];
}

export interface ProductLine {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  gitRepo: GitRepoConfig;
  branchPolicies: BranchPolicies;
  environmentMappings: EnvironmentMappings;
  status: {
    phase: ProductLinePhase;
    conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>;
    statistics?: {
      totalPipelines?: number;
      activePipelines?: number;
      successfulPipelines?: number;
      failedPipelines?: number;
      totalDeployments?: number;
    };
    gitStatus?: {
      lastSyncTime?: string;
      lastCommit?: { sha: string; message: string; author: string; time: string };
      branches?: Array<{ name: string; lastCommit: string; protected: boolean }>;
    };
    environments?: Array<{
      name: string;
      phase: string;
      lastDeployment?: { version: string; time: string; status: string };
    }>;
  };
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
}

export interface ProductLineCreateInput {
  name: string;
  displayName: string;
  description?: string;
  gitRepo: GitRepoConfig;
  branchPolicies: BranchPolicies;
  environmentMappings: EnvironmentMappings;
  tenantId?: string;
}

export interface ProductLineUpdateInput {
  displayName?: string;
  description?: string;
  branchPolicies?: BranchPolicies;
  environmentMappings?: EnvironmentMappings;
}

export interface ReleaseTrain {
  id: string;
  productLineId: string;
  name: string;
  schedule: string;
  targetBranch?: string;
  sourceBranch?: string;
  autoPromote?: boolean;
  approvalRequired?: boolean;
  approvers?: string[];
  preChecks?: Array<{ name: string; type: string; required?: boolean }>;
  postActions?: Array<{ name: string; type: string; config?: Record<string, unknown> }>;
  status: {
    lastRun?: string;
    nextRun?: string;
    state: 'Idle' | 'Running' | 'Completed' | 'Failed' | 'Skipped';
    lastRelease?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseTrainInput {
  name: string;
  schedule: string;
  targetBranch?: string;
  sourceBranch?: string;
  autoPromote?: boolean;
  approvalRequired?: boolean;
  approvers?: string[];
  preChecks?: Array<{ name: string; type: string; required?: boolean }>;
  postActions?: Array<{ name: string; type: string; config?: Record<string, unknown> }>;
}

export interface HotfixChannel {
  id: string;
  productLineId: string;
  name: string;
  enabled?: boolean;
  branchPattern?: string;
  skipStages?: string[];
  requiredStages?: string[];
  approvalRequired?: boolean;
  approvalTimeout?: number;
  autoMerge?: boolean;
  notifyOnCall?: boolean;
  maxDuration?: number;
  status: {
    activeHotfixes?: number;
    lastHotfix?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HotfixChannelInput {
  name: string;
  enabled?: boolean;
  branchPattern?: string;
  skipStages?: string[];
  requiredStages?: string[];
  approvalRequired?: boolean;
  approvalTimeout?: number;
  autoMerge?: boolean;
  notifyOnCall?: boolean;
  maxDuration?: number;
}

// ---- ProductLine CRUD ----

export function getProductLines(params?: { tenantId?: string; phase?: ProductLinePhase }) {
  return api.get<ProductLine[]>('/api/product-lines', { params });
}

export function getProductLine(id: string) {
  return api.get<ProductLine>(`/api/product-lines/${id}`);
}

export function getProductLineByName(name: string) {
  return api.get<ProductLine>(`/api/product-lines/name/${name}`);
}

export function createProductLine(data: ProductLineCreateInput) {
  return api.post<ProductLine>('/api/product-lines', data);
}

export function updateProductLine(id: string, data: ProductLineUpdateInput) {
  return api.put<ProductLine>(`/api/product-lines/${id}`, data);
}

export function deleteProductLine(id: string) {
  return api.delete(`/api/product-lines/${id}`);
}

export function activateProductLine(id: string) {
  return api.post<ProductLine>(`/api/product-lines/${id}/activate`);
}

export function suspendProductLine(id: string) {
  return api.post<ProductLine>(`/api/product-lines/${id}/suspend`);
}

// ---- Branch-Environment Mapping ----

export function resolveEnvironment(productLineId: string, branch: string) {
  return api.get<EnvironmentName>(`/api/product-lines/${productLineId}/resolve-environment`, {
    params: { branch },
  });
}

export function requiresApproval(productLineId: string, branch: string) {
  return api.get<{ requiresApproval: boolean }>(
    `/api/product-lines/${productLineId}/requires-approval`,
    { params: { branch } }
  );
}

export function isHotfix(productLineId: string, branch: string) {
  return api.get<{ isHotfix: boolean }>(`/api/product-lines/${productLineId}/is-hotfix`, {
    params: { branch },
  });
}

// ---- ReleaseTrain ----

export function getReleaseTrains(productLineId: string) {
  return api.get<ReleaseTrain[]>(`/api/product-lines/${productLineId}/release-trains`);
}

export function createReleaseTrain(productLineId: string, data: ReleaseTrainInput) {
  return api.post<ReleaseTrain>(`/api/product-lines/${productLineId}/release-trains`, data);
}

// ---- HotfixChannel ----

export function getHotfixChannels(productLineId: string) {
  return api.get<HotfixChannel[]>(`/api/product-lines/${productLineId}/hotfix-channels`);
}

export function createHotfixChannel(productLineId: string, data: HotfixChannelInput) {
  return api.post<HotfixChannel>(`/api/product-lines/${productLineId}/hotfix-channels`, data);
}
