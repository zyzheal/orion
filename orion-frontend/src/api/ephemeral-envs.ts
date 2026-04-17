/**
 * Ephemeral Dev Environments API Service
 * Environment lifecycle, templates, and cost tracking
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface EphemeralEnvironment {
  id: string;
  prId: string;
  repoId: string;
  branchName: string;
  namespace: string;
  templateId?: string;
  status: 'provisioning' | 'running' | 'idle' | 'tearing_down' | 'destroyed';
  previewUrl?: string;
  commitSha: string;
  resources?: { cpu: string; memory: string; storage: string };
  createdBy?: string;
  createdAt: string;
  idleSince?: string;
  autoDestroyAt?: string;
  destroyedAt?: string;
}

export interface EnvironmentTemplate {
  id: string;
  name: string;
  description?: string;
  services: Array<{ name: string; image: string; replicas: number; resources?: Record<string, any> }>;
  resourceLimits?: { cpuLimit: string; memoryLimit: string; storageLimit: string };
  createdAt: string;
  updatedAt: string;
}

export interface EphemeralEnvCost {
  cpuCost: number;
  memoryCost: number;
  storageCost: number;
  networkCost: number;
  totalCost: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// Environment APIs
// ============================================================================

export interface EphemeralEnvParams {
  prId?: string;
  repoId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function getEphemeralEnvs(params?: EphemeralEnvParams) {
  return api.get<EphemeralEnvironment[]>('/v1/ephemeral-envs', { params });
}

export function getEphemeralEnv(id: string) {
  return api.get<EphemeralEnvironment>(`/v1/ephemeral-envs/${id}`);
}

export interface CreateEphemeralEnvInput {
  prId: string;
  repoId: string;
  branchName: string;
  templateId?: string;
  commitSha: string;
}

export function createEphemeralEnv(data: CreateEphemeralEnvInput) {
  return api.post<EphemeralEnvironment>('/v1/ephemeral-envs', data);
}

export function wakeEphemeralEnv(id: string) {
  return api.post<EphemeralEnvironment>(`/v1/ephemeral-envs/${id}/wake`);
}

export function teardownEphemeralEnv(id: string) {
  return api.post<EphemeralEnvironment>(`/v1/ephemeral-envs/${id}/teardown`);
}

export function getEphemeralEnvCost(id: string) {
  return api.get<EphemeralEnvCost>(`/v1/ephemeral-envs/${id}/cost`);
}

// ============================================================================
// Template APIs
// ============================================================================

export function getEnvironmentTemplates() {
  return api.get<EnvironmentTemplate[]>('/v1/ephemeral-envs/templates');
}
