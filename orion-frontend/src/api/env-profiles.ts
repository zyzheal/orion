/**
 * EnvProfile API Client
 *
 * Backend routes: orion-platform-service/src/api/env-profile-routes.ts
 * Backend service: EnvProfileService
 */

import { api } from './client';

// ==================== 类型定义 ====================

export interface EnvProfile {
  id: string;
  tenantId: string;
  name: string;
  environment: string;
  variables: Record<string, string>;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvProfileInput {
  name: string;
  environment: string;
  variables?: Record<string, string>;
  description?: string;
}

export interface UpdateEnvProfileInput {
  name?: string;
  environment?: string;
  variables?: Record<string, string>;
  description?: string;
}

export interface ResolveVariablesInput {
  name: string;
  environment: string;
  overrides?: Record<string, string>;
}

export interface ResolvedVariablesResult {
  [key: string]: string;
}

// ==================== API 方法 ====================

// POST /api/env-profiles — 创建
export function createEnvProfile(data: CreateEnvProfileInput) {
  return api.post<EnvProfile>('/api/env-profiles', data);
}

// GET /api/env-profiles — 列表查询
export function getEnvProfiles(params?: { name?: string; environment?: string }) {
  return api.get<EnvProfile[]>('/api/env-profiles', { params });
}

// GET /api/env-profiles/:id — 获取详情
export function getEnvProfile(id: string) {
  return api.get<EnvProfile>(`/api/env-profiles/${id}`);
}

// PUT /api/env-profiles/:id — 更新
export function updateEnvProfile(id: string, data: UpdateEnvProfileInput) {
  return api.put<EnvProfile>(`/api/env-profiles/${id}`, data);
}

// DELETE /api/env-profiles/:id — 删除
export function deleteEnvProfile(id: string) {
  return api.delete(`/api/env-profiles/${id}`);
}

// GET /api/env-profiles/:name/environments — 列出环境
export function getEnvironmentsForProfile(name: string) {
  return api.get<string[]>(`/api/env-profiles/${encodeURIComponent(name)}/environments`);
}

// POST /api/env-profiles/resolve — 解析变量
export function resolveEnvVariables(data: ResolveVariablesInput) {
  return api.post<ResolvedVariablesResult>('/api/env-profiles/resolve', data);
}
