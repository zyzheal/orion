/**
 * Script Library API
 * Phase 2 - Script management with versioning and parameterized execution
 */
import apiClient from './client';

export interface ScriptEntry {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  scriptType: 'shell' | 'python' | 'powershell' | 'ansible';
  category: string | null;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptVersion {
  id: string;
  tenantId: string;
  scriptId: string;
  version: number;
  content: string;
  changelog: string | null;
  checksum: string;
  createdAt: string;
}

export interface ScriptParameter {
  id: string;
  tenantId: string;
  scriptId: string;
  paramKey: string;
  paramType: 'string' | 'number' | 'boolean' | 'secret';
  required: boolean;
  defaultValue: string | null;
  description: string | null;
  createdAt: string;
}

export interface ScriptExecution {
  id: string;
  tenantId: string;
  scriptId: string;
  version: number;
  targets: Record<string, unknown>;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string | null;
  error: string | null;
  durationMs: number | null;
  executedBy: string | null;
  createdAt: string;
}

export interface CreateScriptInput {
  name: string;
  description?: string;
  scriptType: 'shell' | 'python' | 'powershell' | 'ansible';
  category?: string;
  tags?: string[];
}

export interface UpdateScriptInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface CreateVersionInput {
  content: string;
  changelog?: string;
}

export interface CreateParameterInput {
  paramKey: string;
  paramType: 'string' | 'number' | 'boolean' | 'secret';
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface ExecuteScriptInput {
  version?: number;
  params?: Record<string, unknown>;
  targets?: Record<string, unknown>;
}

// Scripts
export const listScripts = (params?: { category?: string; scriptType?: string }) =>
  apiClient.get<ScriptEntry[]>('/scripts', { params });

export const getScript = (id: string) =>
  apiClient.get<ScriptEntry>(`/scripts/${id}`);

export const createScript = (data: CreateScriptInput) =>
  apiClient.post<ScriptEntry>('/scripts', data);

export const updateScript = (id: string, data: UpdateScriptInput) =>
  apiClient.put<ScriptEntry>(`/scripts/${id}`, data);

export const deleteScript = (id: string) =>
  apiClient.delete(`/scripts/${id}`);

// Versions
export const listVersions = (scriptId: string) =>
  apiClient.get<ScriptVersion[]>(`/scripts/${scriptId}/versions`);

export const createVersion = (scriptId: string, data: CreateVersionInput) =>
  apiClient.post<ScriptVersion>(`/scripts/${scriptId}/versions`, data);

export const rollbackVersion = (scriptId: string, version: number) =>
  apiClient.post(`/scripts/${scriptId}/versions/${version}/rollback`);

// Parameters
export const listParameters = (scriptId: string) =>
  apiClient.get<ScriptParameter[]>(`/scripts/${scriptId}/parameters`);

export const setParameters = (scriptId: string, params: CreateParameterInput[]) =>
  apiClient.put(`/scripts/${scriptId}/parameters`, { params });

// Execution
export const executeScript = (scriptId: string, data: ExecuteScriptInput) =>
  apiClient.post<ScriptExecution>(`/scripts/${scriptId}/execute`, data);

export const getExecutionHistory = (scriptId: string, limit?: number) =>
  apiClient.get<ScriptExecution[]>(`/scripts/${scriptId}/executions`, { params: { limit } });
