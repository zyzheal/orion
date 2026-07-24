/**
 * Process Step Engine API Client
 * Workflow definition CRUD + instance management + step advancement
 */
import apiClient from './client';

export interface ProcessDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  version: number;
  entityType: string;
  enabled: boolean;
  steps: ProcessStepDef[];
  transitions: ProcessTransition[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessStepDef {
  id: string;
  name: string;
  type?: string;
  handler?: string;
  config?: Record<string, unknown>;
}

export interface ProcessTransition {
  from: string;
  to: string;
  condition?: string;
}

export interface ProcessInstance {
  id: string;
  tenantId: string;
  definitionId: string;
  definitionSnapshot: Record<string, unknown>;
  entityType: string;
  entityId: string;
  status: string;
  currentStepId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ProcessStepInstance {
  id: string;
  tenantId: string;
  instanceId: string;
  stepId: string;
  stepName: string;
  stepType: string;
  handlerKey: string | null;
  status: string;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  operator: string | null;
  comment: string | null;
  createdAt: string;
}

export interface CreateDefinitionInput {
  name: string;
  description?: string;
  entityType: string;
  steps?: ProcessStepDef[];
  transitions?: ProcessTransition[];
  enabled?: boolean;
}

export interface UpdateDefinitionInput {
  name?: string;
  description?: string;
  entityType?: string;
  steps?: ProcessStepDef[];
  transitions?: ProcessTransition[];
  enabled?: boolean;
}

export interface StartInstanceInput {
  definitionId: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
}

export interface AdvanceStepInput {
  action: string;
  comment?: string;
  data?: Record<string, unknown>;
}

// Definitions
export const listDefinitions = (params?: { entityType?: string; enabled?: boolean; limit?: number; offset?: number }) =>
  apiClient.get<{ data: ProcessDefinition[]; total: number }>('/process-steps/definitions', { params });

export const getDefinition = (id: string) =>
  apiClient.get<{ data: ProcessDefinition }>(`/process-steps/definitions/${id}`);

export const createDefinition = (data: CreateDefinitionInput) =>
  apiClient.post<{ data: ProcessDefinition }>('/process-steps/definitions', data);

export const updateDefinition = (id: string, data: UpdateDefinitionInput) =>
  apiClient.put<{ data: ProcessDefinition }>(`/process-steps/definitions/${id}`, data);

export const deleteDefinition = (id: string) =>
  apiClient.delete(`/process-steps/definitions/${id}`);

// Instances
export const listInstances = (params?: { definitionId?: string; entityType?: string; entityId?: string; status?: string; limit?: number; offset?: number }) =>
  apiClient.get<{ data: ProcessInstance[]; total: number }>('/process-steps/instances', { params });

export const getInstance = (id: string) =>
  apiClient.get<{ data: ProcessInstance }>(`/process-steps/instances/${id}`);

export const startInstance = (data: StartInstanceInput) =>
  apiClient.post<{ data: ProcessInstance }>('/process-steps/instances', data);

export const getStepHistory = (instanceId: string) =>
  apiClient.get<{ data: ProcessStepInstance[] }>(`/process-steps/instances/${instanceId}/history`);

export const advanceStep = (instanceId: string, stepId: string, data: AdvanceStepInput) =>
  apiClient.post<{ data: ProcessStepInstance }>(`/process-steps/instances/${instanceId}/steps/${stepId}/advance`, data);
