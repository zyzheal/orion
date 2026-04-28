/**
 * Environment Management API Service
 * Environment CRUD operations and status management for deployment targets
 */
import { api } from './client';

// ---- Types ----

export type EnvironmentType =
  | 'dev'
  | 'staging'
  | 'prod'
  | 'testing'
  | 'pre-prod'
  | 'production'
  | 'development';
export type EnvironmentStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated';

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  type: EnvironmentType;
  cluster?: string;
  namespace?: string;
  config?: Record<string, any>;
  status: EnvironmentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEnvironmentInput {
  projectId: string;
  name: string;
  type: EnvironmentType;
  cluster?: string;
  namespace?: string;
  config?: Record<string, any>;
}

export interface UpdateEnvironmentInput {
  name?: string;
  type?: EnvironmentType;
  cluster?: string;
  namespace?: string;
  config?: Record<string, any>;
  status?: EnvironmentStatus;
}

export interface UpdateStatusInput {
  status: EnvironmentStatus;
}

// ---- CRUD ----

export function getEnvironments(params?: { projectId?: string }) {
  return api.get<Environment[]>('/v1/environments', { params });
}

export function getEnvironment(id: string) {
  return api.get<Environment>(`/v1/environments/${id}`);
}

export function createEnvironment(data: CreateEnvironmentInput) {
  return api.post<Environment>('/v1/environments', data);
}

export function updateEnvironment(id: string, data: UpdateEnvironmentInput) {
  return api.put<Environment>(`/v1/environments/${id}`, data);
}

export function deleteEnvironment(id: string) {
  return api.delete(`/v1/environments/${id}`);
}

// ---- Status ----

export function updateEnvironmentStatus(id: string, data: UpdateStatusInput) {
  return api.post<Environment>(`/v1/environments/${id}/status`, data);
}
