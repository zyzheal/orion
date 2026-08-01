/**
 * IaC Management API Service
 * Infrastructure as Code workspaces, plans, state, and modules
 */
import { api } from './client';

// ---- Types ----

export interface IaCWorkspace {
  id: string;
  name: string;
  projectId: string;
  environment: 'development' | 'staging' | 'production';
  status: 'idle' | 'planning' | 'applying' | 'error' | 'locked';
  provider: 'terraform' | 'pulumi' | 'cloudformation';
  lockedBy?: string;
  lastAppliedAt?: string;
  createdAt: string;
}

export interface IaCResourceChange {
  address: string;
  type: string;
  action: 'create' | 'update' | 'delete' | 'replace' | 'read';
  name: string;
}

export interface IaCPlan {
  id: string;
  workspaceId: string;
  status: 'pending' | 'applied' | 'discarded';
  resourceChanges: IaCResourceChange[];
  costEstimate?: number;
  aiReview?: {
    score: number;
    suggestions: string[];
    risks: string[];
  };
  createdAt: string;
}

export interface IaCStateResource {
  address: string;
  type: string;
  name: string;
  provider: string;
  attributes: Record<string, unknown>;
}

export interface IaCStateVersion {
  id: string;
  workspaceId: string;
  version: number;
  serial: number;
  lineage: string;
  createdAt: string;
  createdBy: string;
  resourcesCount: number;
}

export interface IaCModule {
  id: string;
  name: string;
  description: string;
  provider: string;
  versions: string[];
  source: string;
  downloadCount: number;
  createdAt: string;
}

export interface WorkspaceInput {
  name: string;
  projectId: string;
  environment: string;
  provider: string;
  config?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  config?: string;
}

export interface PlanInput {
  variables?: Record<string, string>;
  target?: string[];
  destroy?: boolean;
}

export interface ApplyInput {
  planId?: string;
  autoApprove?: boolean;
  comment?: string;
}

export interface ModuleInput {
  name: string;
  description: string;
  provider: string;
  version: string;
  source: string;
  config?: string;
}

export interface WorkspaceListParams {
  projectId?: string;
  environment?: string;
  status?: string;
  provider?: string;
  page?: number;
  perPage?: number;
}

export interface ModuleListParams {
  provider?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

// ---- Workspaces ----

export function getWorkspaces(params?: WorkspaceListParams) {
  return api.get('/api/iac/workspaces', { params });
}

export function getWorkspace(id: string) {
  return api.get(`/api/iac/workspaces/${id}`);
}

export function createWorkspace(data: WorkspaceInput) {
  return api.post('/api/iac/workspaces', data);
}

export function updateWorkspace(id: string, data: UpdateWorkspaceInput) {
  return api.put(`/api/iac/workspaces/${id}`, data);
}

// ---- Plans ----

export function planWorkspace(id: string, data?: PlanInput) {
  return api.post(`/api/iac/workspaces/${id}/plan`, data);
}

export function applyWorkspace(id: string, data?: ApplyInput) {
  return api.post(`/api/iac/workspaces/${id}/apply`, data);
}

export function getWorkspacePlans(id: string) {
  return api.get(`/api/iac/workspaces/${id}/plans`);
}

export function getWorkspacePlan(workspaceId: string, planId: string) {
  return api.get(`/api/iac/workspaces/${workspaceId}/plans/${planId}`);
}

// ---- State ----

export function getWorkspaceState(id: string) {
  return api.get(`/api/iac/workspaces/${id}/state`);
}

export function getWorkspaceStateVersions(id: string) {
  return api.get(`/api/iac/workspaces/${id}/state/versions`);
}

export function getWorkspaceResources(id: string) {
  return api.get(`/api/iac/workspaces/${id}/resources`);
}

export function getStateDiff(workspaceId: string, versionA: number, versionB: number) {
  return api.get(`/api/iac/workspaces/${workspaceId}/state/diff`, {
    params: { versionA, versionB },
  });
}

// ---- Modules ----

export function getModules(params?: ModuleListParams) {
  return api.get('/api/iac/modules', { params });
}

export function getModule(id: string) {
  return api.get(`/api/iac/modules/${id}`);
}

export function createModule(data: ModuleInput) {
  return api.post('/api/iac/modules', data);
}

export function deleteModule(id: string) {
  return api.delete(`/api/iac/modules/${id}`);
}
