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

// POST /global-params — 创建参数
export function createGlobalParam(data: CreateGlobalParamInput) {
  return api.post<GlobalParam>('/global-params', data);
}

// GET /global-params — 列表查询
export function getGlobalParams(params?: { scope?: string }) {
  return api.get<GlobalParam[]>('/global-params', { params });
}

// GET /global-params/:id — 获取详情
export function getGlobalParam(id: string) {
  return api.get<GlobalParam>(`/global-params/${id}`);
}

// PUT /global-params/:id — 更新
export function updateGlobalParam(id: string, data: UpdateGlobalParamInput) {
  return api.put<GlobalParam>(`/global-params/${id}`, data);
}

// DELETE /global-params/:id — 删除
export function deleteGlobalParam(id: string) {
  return api.delete(`/global-params/${id}`);
}

// POST /global-params/resolve — 批量解析
export function resolveGlobalParams(data: ResolveKeysInput) {
  return api.post<ResolvedKeysResult>('/global-params/resolve', data);
}
