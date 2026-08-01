/**
 * Project Management API Service
 * Project CRUD and resource association (M7)
 */
import { api } from './client';

// ---- Types ----

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  status: 'active' | 'archived' | 'suspended';
  teamLead?: string;
  teamMembers?: string[];
  productLineId?: string;
  environments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  tenantId: string;
  description?: string;
  teamLead?: string;
  teamMembers?: string[];
  productLineId?: string;
  environments?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  teamLead?: string;
  teamMembers?: string[];
  productLineId?: string;
  environments?: string[];
  status?: 'active' | 'archived' | 'suspended';
}

export interface ProjectListResponse {
  data: Project[];
  total: number;
}

export interface ProjectResource {
  id: string;
  projectId: string;
  type: string;
  name: string;
  externalId: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectStats {
  total: number;
  byStatus: Record<string, number>;
  totalEnvironments: number;
  totalMembers: number;
}

// ---- CRUD ----

export function getProjects(params?: { tenantId?: string }) {
  return api.get<ProjectListResponse>('/api/projects', { params });
}

export function getProject(id: string) {
  return api.get<Project>(`/api/projects/${id}`);
}

export function createProject(data: CreateProjectInput) {
  return api.post<Project>('/api/projects', data);
}

export function updateProject(id: string, data: UpdateProjectInput) {
  return api.put<Project>(`/api/projects/${id}`, data);
}

export function deleteProject(id: string) {
  return api.delete(`/api/projects/${id}`);
}

// ---- Resources ----

export function getProjectResources(projectId: string) {
  return api.get<ProjectResource[]>(`/api/projects/${projectId}/resources`);
}

// ---- Stats ----

export function getProjectStats(params?: { tenantId?: string }) {
  return api.get<ProjectStats>('/api/projects/stats', { params });
}
