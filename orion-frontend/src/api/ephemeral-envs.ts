/**
 * Ephemeral Dev Environments API Service
 * Environment lifecycle, templates, and cost tracking
 */

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
    resources?: Record<string, any>;
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

// Note: Backend doesn't have ephemeral-envs routes yet.
// These functions return empty results until the backend endpoints are implemented.

export function getEphemeralEnvs(_params?: EphemeralEnvParams) {
  console.warn('getEphemeralEnvs: backend /ephemeral-envs endpoint not available');
  return Promise.resolve([] as EphemeralEnvironment[]);
}

export function getEphemeralEnv(_id: string) {
  console.warn('getEphemeralEnv: backend /ephemeral-envs/:id endpoint not available');
  return Promise.resolve({} as EphemeralEnvironment);
}

export interface CreateEphemeralEnvInput {
  prId: string;
  repoId: string;
  branchName: string;
  templateId?: string;
  commitSha: string;
}

export function createEphemeralEnv(_data: CreateEphemeralEnvInput) {
  console.warn('createEphemeralEnv: backend /ephemeral-envs endpoint not available');
  return Promise.resolve({} as EphemeralEnvironment);
}

export function wakeEphemeralEnv(_id: string) {
  console.warn('wakeEphemeralEnv: backend /ephemeral-envs/:id/wake endpoint not available');
  return Promise.resolve({} as EphemeralEnvironment);
}

export function teardownEphemeralEnv(_id: string) {
  console.warn('teardownEphemeralEnv: backend /ephemeral-envs/:id/teardown endpoint not available');
  return Promise.resolve({} as EphemeralEnvironment);
}

export function getEphemeralEnvCost(_id: string) {
  console.warn('getEphemeralEnvCost: backend /ephemeral-envs/:id/cost endpoint not available');
  return Promise.resolve({} as EphemeralEnvCost);
}

// ============================================================================
// Template APIs
// ============================================================================

export function getEnvironmentTemplates() {
  console.warn('getEnvironmentTemplates: backend /ephemeral-envs/templates endpoint not available');
  return Promise.resolve([] as EnvironmentTemplate[]);
}
