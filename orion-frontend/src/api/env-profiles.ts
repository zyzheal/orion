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

// POST /v1/env-profiles — 创建
export function createEnvProfile(data: CreateEnvProfileInput) {
  return api.post<EnvProfile>('/v1/env-profiles', data);
}

// GET /v1/env-profiles — 列表查询
export function getEnvProfiles(params?: { name?: string; environment?: string }) {
  return api.get<EnvProfile[]>('/v1/env-profiles', { params });
}

// GET /v1/env-profiles/:id — 获取详情
export function getEnvProfile(id: string) {
  return api.get<EnvProfile>(`/v1/env-profiles/${id}`);
}

// PUT /v1/env-profiles/:id — 更新
export function updateEnvProfile(id: string, data: UpdateEnvProfileInput) {
  return api.put<EnvProfile>(`/v1/env-profiles/${id}`, data);
}

// DELETE /v1/env-profiles/:id — 删除
export function deleteEnvProfile(id: string) {
  return api.delete(`/v1/env-profiles/${id}`);
}

// GET /v1/env-profiles/:name/environments — 列出环境
export function getEnvironmentsForProfile(name: string) {
  return api.get<string[]>(`/v1/env-profiles/${encodeURIComponent(name)}/environments`);
}

// POST /v1/env-profiles/resolve — 解析变量
export function resolveEnvVariables(data: ResolveVariablesInput) {
  return api.post<ResolvedVariablesResult>('/v1/env-profiles/resolve', data);
}
