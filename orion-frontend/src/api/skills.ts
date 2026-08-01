/**
 * Skill Management API Service
 * Skill marketplace, installed skills, and skill submissions
 */
import { api } from './client';

// ---- Types ----

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  installCount: number;
  rating: number;
  createdAt: string;
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: string;
  changelog: string;
  createdAt: string;
}

export interface SkillRating {
  score: number;
  comment?: string;
}

export interface SkillPackageInput {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
  content?: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export interface SkillListParams {
  category?: string;
  tag?: string;
  search?: string;
  sortBy?: string;
  page?: number;
  perPage?: number;
}

// ---- Skill Marketplace ----

export function getSkills(params?: SkillListParams) {
  return api.get('/api/skills', { params });
}

export function getSkill(id: string) {
  return api.get(`/api/skills/${id}`);
}

export function createSkill(data: SkillPackageInput) {
  return api.post('/api/skills', data);
}

export function updateSkill(id: string, data: UpdateSkillInput) {
  return api.put(`/api/skills/${id}`, data);
}

export function deleteSkill(id: string) {
  return api.delete(`/api/skills/${id}`);
}

// ---- Skill Versions ----

export function getSkillVersions(id: string) {
  return api.get(`/api/skills/${id}/versions`);
}

// ---- Install / Uninstall ----

export function installSkill(id: string) {
  return api.post(`/api/skills/${id}/install`);
}

export function uninstallSkill(id: string) {
  return api.post(`/api/skills/${id}/uninstall`);
}

// ---- Rating ----

export function rateSkill(id: string, data: SkillRating) {
  return api.post(`/api/skills/${id}/rate`, data);
}

// ---- My Skills ----
// Note: Backend skill-routes.ts doesn't have /my endpoints.
// Use query params on /skills to filter by installed status.

export function getMySkills() {
  return api.get('/api/skills', { params: { installed: 'true' } });
}

export function getInstalledSkill(id: string) {
  return api.get(`/api/skills/${id}`);
}

// ---- Instance Management ----

export interface SkillInstance {
  id: string;
  skillId: string;
  tenantId: string;
  projectId?: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  bindings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  isDefault: boolean;
  status: string;
  createdBy?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstanceInput {
  name: string;
  description?: string;
  projectId?: string;
  config?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
  version?: string;
}

export interface UpdateInstanceInput {
  name?: string;
  description?: string;
  projectId?: string;
  config?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
  status?: string;
}

export async function getSkillInstances(skillId: string) {
  const res = await api.get(`/api/skills/${skillId}/instances`);
  const body = res.data as { data?: SkillInstance[] };
  return { data: { data: body?.data || [] } };
}

export async function createSkillInstance(skillId: string, data: CreateInstanceInput) {
  const res = await api.post(`/api/skills/${skillId}/instances`, data);
  const body = res.data as { data?: SkillInstance };
  return { data: { data: body?.data } };
}

export async function updateSkillInstance(skillId: string, instanceId: string, data: UpdateInstanceInput) {
  const res = await api.put(`/api/skills/${skillId}/instances/${instanceId}`, data);
  const body = res.data as { data?: SkillInstance };
  return { data: { data: body?.data } };
}

export async function deleteSkillInstance(skillId: string, instanceId: string) {
  const res = await api.delete(`/api/skills/${skillId}/instances/${instanceId}`);
  const body = res.data as { message?: string };
  return { data: { message: body?.message } };
}

// ---- Direct Execution ----

export interface SkillExecution {
  id: string;
  skillId: string;
  instanceId?: string;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  capability?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout';
  duration?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ExecuteSkillInput {
  tenantId?: string;
  projectId?: string;
  capability?: string;
  instanceId?: string;
  input?: Record<string, unknown>;
  sync?: boolean;
  timeout?: number;
}

export async function executeSkill(skillId: string, data: ExecuteSkillInput) {
  const res = await api.post(`/api/skills/${skillId}/execute`, data);
  const body = res.data as { data?: SkillExecution };
  return { data: { data: body?.data } };
}

export async function getSkillExecutions(skillId: string, params?: { page?: number; limit?: number }) {
  const res = await api.get(`/api/skills/${skillId}/executions`, { params });
  const body = res.data as { data?: { executions?: Array<{ id: string; skill_id: string; instance_id?: string; tenant_id?: string; triggered_by?: string; capability?: string; input?: Record<string, unknown>; output?: Record<string, unknown>; status?: string; duration_ms?: number; error_message?: string; started_at?: string; created_at?: string; completed_at?: string; }>; total?: number; page?: number } };
  const rawExecutions = body?.data?.executions || [];
  // Map snake_case backend fields to camelCase frontend types
  const executions: SkillExecution[] = (rawExecutions as Array<{ id: string; skill_id: string; instance_id?: string; tenant_id?: string; triggered_by?: string; capability?: string; input?: Record<string, unknown>; output?: Record<string, unknown>; status?: string; duration_ms?: number; error_message?: string; started_at?: string; created_at?: string; completed_at?: string; }>).map((e) => ({
    id: e.id,
    skillId: e.skill_id,
    instanceId: e.instance_id,
    tenantId: e.tenant_id ?? '',
    userId: e.triggered_by,
    capability: e.capability,
    input: e.input ?? {},
    output: e.output ?? {},
    status: (e.status as SkillExecution['status']) ?? 'pending',
    duration: e.duration_ms,
    errorMessage: e.error_message,
    createdAt: e.started_at ?? e.created_at ?? '',
    completedAt: e.completed_at,
  }));
  return { data: { data: { executions, total: body?.data?.total ?? 0, page: body?.data?.page ?? 1 } } };
}

// ---- Review Workflow ----

export async function submitSkillForReview(skillId: string) {
  const res = await api.post(`/api/skills/${skillId}/submit`);
  const body = res.data as { data?: SkillPackage };
  return { data: { data: body?.data } };
}

export async function approveSkill(skillId: string, reason?: string) {
  const res = await api.post(`/api/skills/${skillId}/approve`, { reason });
  const body = res.data as { data?: SkillPackage };
  return { data: { data: body?.data } };
}

export async function rejectSkill(skillId: string, reason: string) {
  const res = await api.post(`/api/skills/${skillId}/reject`, { reason });
  const body = res.data as { data?: SkillPackage };
  return { data: { data: body?.data } };
}

export async function archiveSkill(skillId: string, reason?: string) {
  const res = await api.post(`/api/skills/${skillId}/archive`, { reason });
  const body = res.data as { data?: SkillPackage };
  return { data: { data: body?.data } };
}

export async function getPendingReviews(params?: { page?: number; limit?: number; category?: string }) {
  const res = await api.get('/api/skills/pending-review', { params });
  const body = res.data as { data?: { skills?: SkillPackage[]; total?: number; page?: number } };
  const rawSkills = body?.data?.skills || [];
  return { data: { data: { skills: rawSkills, total: body?.data?.total || 0, page: body?.data?.page || 1 } } };
}

// ---- Audit Log ----

export interface SkillAuditEntry {
  id: string;
  skillId: string;
  skillName?: string;
  action: string;
  actor: string;
  reason?: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
}

export async function getSkillAuditLog(skillId: string, params?: { page?: number; limit?: number }) {
  const res = await api.get(`/api/skills/${skillId}/audit`, { params });
  const body = res.data as { data?: { items?: SkillAuditEntry[]; total?: number; page?: number } };
  return { data: { data: body?.data || { items: [], total: 0, page: 1 } } };
}

export async function getAllAuditHistory(params?: { page?: number; limit?: number; action?: string }) {
  const res = await api.get('/api/skills/audit', { params });
  const body = res.data as { data?: { logs?: Array<{ id: string; skill_id: string; skill_name?: string; action: string; actor_name?: string; actor_id?: string; reason?: string; old_status?: string; new_status?: string; created_at?: string }>; total?: number } };
  const rawLogs = body?.data?.logs || [];
  // Map snake_case backend fields to camelCase
  const logs: SkillAuditEntry[] = rawLogs.map((log) => ({
    id: log.id,
    skillId: log.skill_id,
    skillName: log.skill_name ?? undefined,
    action: log.action,
    actor: log.actor_name ?? log.actor_id ?? '',
    reason: log.reason ?? undefined,
    oldStatus: log.old_status ?? undefined,
    newStatus: log.new_status ?? undefined,
    createdAt: log.created_at ?? '',
  }));
  return { data: { data: { logs, total: body?.data?.total ?? 0 } } };
}
