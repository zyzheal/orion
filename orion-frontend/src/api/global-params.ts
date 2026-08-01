/**
 * Global Param API Client
 *
 * Backend routes: orion-platform-service/src/api/global-param-routes.ts
 * Backend service: GlobalParamService
 */

import { api } from './client';

// ==================== 类型定义 ====================

export type GlobalParamScope = 'tenant' | 'pipeline' | 'global';

export interface GlobalParam {
  id: string;
  tenantId: string;
  key: string;
  value: string;
  description?: string;
  isSecret: boolean;
  scope: GlobalParamScope;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGlobalParamInput {
  key: string;
  value: string;
  description?: string;
  isSecret?: boolean;
  scope?: GlobalParamScope;
  expiresAt?: string;
}

export interface UpdateGlobalParamInput {
  value?: string;
  description?: string;
  isSecret?: boolean;
  scope?: GlobalParamScope;
  expiresAt?: string;
}

export interface ResolveKeysInput {
  keys: Record<string, string>;
}

export interface ResolvedKeysResult {
  [key: string]: string;
}

// ==================== API 方法 ====================

// POST /api/global-params — 创建参数
export function createGlobalParam(data: CreateGlobalParamInput) {
  return api.post<GlobalParam>('/api/global-params', data);
}

// GET /api/global-params — 列表查询
export function getGlobalParams(params?: { scope?: string }) {
  return api.get<GlobalParam[]>('/api/global-params', { params });
}

// GET /api/global-params/:id — 获取详情
export function getGlobalParam(id: string) {
  return api.get<GlobalParam>(`/api/global-params/${id}`);
}

// PUT /api/global-params/:id — 更新
export function updateGlobalParam(id: string, data: UpdateGlobalParamInput) {
  return api.put<GlobalParam>(`/api/global-params/${id}`, data);
}

// DELETE /api/global-params/:id — 删除
export function deleteGlobalParam(id: string) {
  return api.delete(`/api/global-params/${id}`);
}

// POST /api/global-params/resolve — 批量解析
export function resolveGlobalParams(data: ResolveKeysInput) {
  return api.post<ResolvedKeysResult>('/api/global-params/resolve', data);
}
