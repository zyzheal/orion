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
  services: Array<{
    name: string;
    image: string;
    replicas: number;
    resources?: Record<string, unknown>;
  }>;
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

export interface EphemeralEnvParams {
  prId?: string;
  repoId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateEphemeralEnvInput {
  prId: string;
  repoId: string;
  branchName: string;
  templateId?: string;
  commitSha: string;
}

// ============================================================================
// Environment APIs — backend prefix: /ephemeral-env
// ============================================================================

export const getEphemeralEnvs = async (params?: EphemeralEnvParams) => {
  return api.get<EphemeralEnvironment[]>('/ephemeral-env', { params });
};

export const getEphemeralEnv = async (id: string) => {
  return api.get<EphemeralEnvironment>(`/ephemeral-env/${id}`);
};

export const createEphemeralEnv = async (data: CreateEphemeralEnvInput) => {
  return api.post<EphemeralEnvironment>('/ephemeral-env', data);
};

export const wakeEphemeralEnv = async (id: string) => {
  return api.post<EphemeralEnvironment>(`/ephemeral-env/${id}/extend`);
};

export const teardownEphemeralEnv = async (id: string) => {
  return api.delete<EphemeralEnvironment>(`/ephemeral-env/${id}`);
};

export const getEphemeralEnvCost = async (id: string) => {
  return api.get<EphemeralEnvCost>(`/ephemeral-env/${id}/logs`);
};

export const getEnvironmentTemplates = async () => {
  return api.get<EnvironmentTemplate[]>('/ephemeral-env');
};