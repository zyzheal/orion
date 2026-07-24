/**
 * Runbook Management API
 * Phase 2 - Runbook definitions, execution, and execution history
 */
import apiClient from './client';

export interface RunbookStep {
  id: string;
  name: string;
  type: 'command' | 'script' | 'approval' | 'notification';
  config: Record<string, unknown>;
  order: number;
}

export interface RunbookDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  steps: RunbookStep[];
  variables: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RunbookExecution {
  id: string;
  tenantId: string;
  runbookId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: string;
  context: Record<string, unknown>;
  currentStepIndex: number;
  stepResults: {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    output: string | null;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  }[];
  startedAt: string;
  completedAt: string | null;
}

export interface CreateRunbookInput {
  name: string;
  description?: string;
  category: string;
  steps: RunbookStep[];
  variables?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateRunbookInput {
  name?: string;
  description?: string;
  category?: string;
  steps?: RunbookStep[];
  variables?: Record<string, unknown>;
  enabled?: boolean;
}

// Runbook Definitions
export const listRunbooks = (params?: { category?: string; enabled?: boolean }) =>
  apiClient.get<RunbookDefinition[]>('/runbooks', { params });

export const getRunbook = (id: string) =>
  apiClient.get<RunbookDefinition>(`/runbooks/${id}`);

export const createRunbook = (data: CreateRunbookInput) =>
  apiClient.post<RunbookDefinition>('/runbooks', data);

export const updateRunbook = (id: string, data: UpdateRunbookInput) =>
  apiClient.put<RunbookDefinition>(`/runbooks/${id}`, data);

export const deleteRunbook = (id: string) =>
  apiClient.delete(`/runbooks/${id}`);

// Runbook Execution
export const executeRunbook = (id: string, data?: { triggeredBy?: string; context?: Record<string, unknown> }) =>
  apiClient.post<RunbookExecution>(`/runbooks/${id}/execute`, data);

export const getExecutionHistory = (id: string, params?: { limit?: number }) =>
  apiClient.get<RunbookExecution[]>(`/runbooks/${id}/executions`, { params });

export const getExecutionDetails = (executionId: string) =>
  apiClient.get<RunbookExecution>(`/runbooks/executions/${executionId}`);
