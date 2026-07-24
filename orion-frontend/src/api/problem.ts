/**
 * Problem Management API Service
 *
 * Aligned with backend /api/v1/problems/* routes (problem-routes.ts)
 * Covers: problem CRUD, lifecycle, incident/change linking, KEDB, statistics
 */
import { api } from './client';

export interface Problem {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'known' | 'investigating' | 'resolved' | 'closed';
  category?: string;
  root_cause?: string;
  workaround?: string;
  resolution?: string;
  related_incidents: string[];
  related_changes: string[];
  assigned_to?: string;
  created_by?: string;
  resolved_at?: string;
  closed_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnownError {
  id: string;
  tenant_id: string;
  problem_id?: string;
  title: string;
  description?: string;
  symptoms?: string;
  root_cause?: string;
  workaround?: string;
  keywords: string[];
  status: 'active' | 'resolved' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProblemStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
}

// ==================== Problem CRUD ====================

export const getProblems = async (params?: {
  status?: string;
  severity?: string;
  assignedTo?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Problem[]; total: number }> => {
  const response = await api.get<{ data: Problem[]; total: number }>('/api/v1/problems', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getProblem = async (id: string): Promise<Problem> => {
  const response = await api.get<{ data: Problem }>(`/api/v1/problems/${id}`);
  return response.data.data;
};

export const createProblem = async (data: {
  title: string;
  description?: string;
  severity: string;
  category?: string;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}): Promise<Problem> => {
  const response = await api.post<{ data: Problem }>('/api/v1/problems', data);
  return response.data.data;
};

export const updateProblem = async (id: string, data: Partial<Problem>): Promise<Problem> => {
  const response = await api.put<{ data: Problem }>(`/api/v1/problems/${id}`, data);
  return response.data.data;
};

export const deleteProblem = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/problems/${id}`);
};

// ==================== Status Lifecycle ====================

export const updateProblemStatus = async (id: string, status: string): Promise<Problem> => {
  const response = await api.patch<{ data: Problem }>(`/api/v1/problems/${id}/status`, { status });
  return response.data.data;
};

// ==================== Incident/Change Linking ====================

export const linkIncident = async (problemId: string, incidentId: string): Promise<Problem> => {
  const response = await api.post<{ data: Problem }>(`/api/v1/problems/${problemId}/incidents`, { incidentId });
  return response.data.data;
};

export const linkChange = async (problemId: string, changeId: string): Promise<Problem> => {
  const response = await api.post<{ data: Problem }>(`/api/v1/problems/${problemId}/changes`, { changeId });
  return response.data.data;
};

// ==================== Known Error Database (KEDB) ====================

export const getKnownErrors = async (params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: KnownError[]; total: number }> => {
  const response = await api.get<{ data: KnownError[]; total: number }>('/api/v1/problems/known-errors', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createKnownError = async (data: {
  title: string;
  description?: string;
  symptoms?: string;
  root_cause?: string;
  workaround?: string;
  keywords?: string[];
  problem_id?: string;
}): Promise<KnownError> => {
  const response = await api.post<{ data: KnownError }>('/api/v1/problems/known-errors', data);
  return response.data.data;
};

export const updateKnownError = async (id: string, data: Partial<KnownError>): Promise<KnownError> => {
  const response = await api.put<{ data: KnownError }>(`/api/v1/problems/known-errors/${id}`, data);
  return response.data.data;
};

export const deleteKnownError = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/problems/known-errors/${id}`);
};

export const searchKnownErrors = async (q: string): Promise<KnownError[]> => {
  const response = await api.get<{ data: KnownError[] }>('/api/v1/problems/known-errors/search', { params: { q } });
  return response.data.data;
};

// ==================== Statistics ====================

export const getProblemStats = async (): Promise<ProblemStats> => {
  const response = await api.get<{ data: ProblemStats }>('/api/v1/problems/stats');
  return response.data.data;
};
