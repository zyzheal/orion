/**
 * Dependency Coordination API Client
 *
 * Aligned with backend /api/v1/pipelines/:id/dependencies/* routes (dependency-coordination-routes.ts)
 * Covers: dependency registration, graph, resolution, cycle detection, topological sort
 */
import { api } from './client';

export interface PipelineDependency {
  pipelineId: string;
  dependsOn: string[];
  requiredInputs?: Record<string, unknown>;
  blockingStatus?: ('success' | 'failed' | 'any')[];
}

export interface DependencyGraph {
  nodes: Array<{ id: string; label?: string }>;
  edges: Array<{ from: string; to: string; type?: string }>;
}

export interface DependencyResolution {
  pipelineId: string;
  status: 'blocked' | 'unblocked' | 'partial';
  satisfied: string[];
  pending: string[];
  failed: string[];
  resolvedInputs?: Record<string, unknown>;
}

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: string[][];
}

// ==================== Dependency CRUD ====================

export const registerDependency = async (pipelineId: string, data: {
  dependsOn: string[];
  requiredInputs?: Record<string, unknown>;
  blockingStatus?: ('success' | 'failed' | 'any')[];
}): Promise<PipelineDependency> => {
  const response = await api.post<PipelineDependency>(`/v1/pipelines/${pipelineId}/dependencies`, data);
  return response.data;
};

export const getDependency = async (pipelineId: string): Promise<PipelineDependency> => {
  const response = await api.get<PipelineDependency>(`/v1/pipelines/${pipelineId}/dependencies`);
  return response.data;
};

export const unregisterDependency = async (pipelineId: string): Promise<{ message: string }> => {
  const response = await api.delete<{ message: string }>(`/v1/pipelines/${pipelineId}/dependencies`);
  return response.data;
};

// ==================== Graph & Resolution ====================

export const getDependencyGraph = async (): Promise<DependencyGraph> => {
  const response = await api.get<DependencyGraph>('/v1/pipelines/dependencies/graph');
  return response.data;
};

export const resolveDependencies = async (pipelineId: string, pipelineResults: Record<string, { status: string; outputs: Record<string, unknown> }>): Promise<DependencyResolution> => {
  const response = await api.post<DependencyResolution>(`/v1/pipelines/dependencies/resolve/${pipelineId}`, { pipelineResults });
  return response.data;
};

export const findCycles = async (): Promise<CycleDetectionResult> => {
  const response = await api.get<CycleDetectionResult>('/v1/pipelines/dependencies/cycles');
  return response.data;
};

export const getTopologicalOrder = async (): Promise<{ order: string[] }> => {
  const response = await api.get<{ order: string[] }>('/v1/pipelines/dependencies/topological');
  return response.data;
};

export const resolveAllDependencies = async (pipelineResults: Record<string, { status: string; outputs: Record<string, unknown> }>): Promise<Record<string, DependencyResolution>> => {
  const response = await api.post<Record<string, DependencyResolution>>('/v1/pipelines/dependencies/resolve-all', { pipelineResults });
  return response.data;
};
