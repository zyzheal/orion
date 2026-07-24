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
  config?: Record<string, unknown>;
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
  config?: Record<string, unknown>;
}

export interface UpdateEnvironmentInput {
  name?: string;
  type?: EnvironmentType;
  cluster?: string;
  namespace?: string;
  config?: Record<string, unknown>;
  status?: EnvironmentStatus;
}

export interface UpdateStatusInput {
  status: EnvironmentStatus;
}

export interface LockEnvironmentInput {
  reason: string;
  lockedBy?: string;
}

export interface EnvironmentLockInfo {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  reason?: string;
}

export interface EnvironmentWithLock extends Environment {
  locked?: boolean;
  locked_by?: string;
  locked_at?: string;
  locked_reason?: string;
}

// ---- CRUD ----

export function getEnvironments(params?: { projectId?: string }) {
  return api.get<Environment[]>('/api/v1/environments', { params });
}

export function getEnvironment(id: string) {
  return api.get<Environment>(`/api/v1/environments/${id}`);
}

export function createEnvironment(data: CreateEnvironmentInput) {
  return api.post<Environment>('/api/v1/environments', data);
}

export function updateEnvironment(id: string, data: UpdateEnvironmentInput) {
  return api.put<Environment>(`/api/v1/environments/${id}`, data);
}

export function deleteEnvironment(id: string) {
  return api.delete(`/api/v1/environments/${id}`);
}

// ---- Status ----

export function updateEnvironmentStatus(id: string, data: UpdateStatusInput) {
  return api.post<Environment>(`/api/v1/environments/${id}/status`, data);
}

// ---- Lock ----

export function lockEnvironment(id: string, data: LockEnvironmentInput) {
  return api.post<EnvironmentLockInfo>(`/api/v1/environments/${id}/lock`, data);
}

export function unlockEnvironment(id: string) {
  return api.post<EnvironmentLockInfo>(`/api/v1/environments/${id}/unlock`);
}

export function getEnvironmentLockStatus(id: string) {
  return api.get<EnvironmentLockInfo>(`/api/v1/environments/${id}/lock-status`);
}

export function checkDeploymentAllowed(id: string) {
  return api.get<{ allowed: boolean; reason?: string }>(`/api/v1/environments/${id}/deployment-allowed`);
}
