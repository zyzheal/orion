/**
 * Runner Pool API Service (GAP-CN-07)
 * Runner pool CRUD and monitoring operations.
 */
import { api } from './client';

export type RunnerStatus = 'online' | 'offline' | 'busy' | 'draining';

export interface RunnerMetadata {
  os?: string;
  arch?: string;
  version?: string;
  [key: string]: unknown;
}

export interface Runner {
  id: string;
  tenantId: string;
  name: string;
  status: RunnerStatus;
  labels: string[];
  maxConcurrent: number;
  currentJobs: number;
  lastHeartbeat: string;
  metadata: RunnerMetadata;
  endpoint?: string;
  createdAt: string;
}

export type RunnerJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunnerJob {
  id: string;
  runnerId: string;
  taskId: string;
  stageId?: string;
  runId?: string;
  tenantId: string;
  status: RunnerJobStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RegisterRunnerInput {
  name: string;
  labels: string[];
  maxConcurrent: number;
  metadata?: RunnerMetadata;
  endpoint?: string;
}

// ---- Runner CRUD ----

export function getRunners(tenantId?: string) {
  const params = tenantId ? { tenantId } : undefined;
  return api.get<Runner[]>('/api/v1/runners', { params });
}

export function getRunner(id: string) {
  return api.get<Runner>(`/api/v1/runners/${id}`);
}

export function registerRunner(data: RegisterRunnerInput) {
  return api.post<Runner>('/api/v1/runners', data);
}

export function deregisterRunner(id: string) {
  return api.delete(`/api/v1/runners/${id}`);
}

export function updateRunner(id: string, data: Partial<Runner>) {
  return api.put<Runner>(`/api/v1/runners/${id}`, data);
}

// ---- Runner Jobs ----

export function getRunnerJobs(id: string) {
  return api.get<RunnerJob[]>(`/api/v1/runners/${id}/jobs`);
}
