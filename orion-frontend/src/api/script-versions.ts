/**
 * ScriptVersion API Client
 *
 * Backend routes: orion-platform-service/src/api/script-version-routes.ts
 * Backend service: ScriptVersionService
 */

import { api } from './client';

// ==================== 类型定义 ====================

export interface ScriptVersion {
  id: string;
  tenantId: string;
  scriptId: string;
  version: string;
  content: string;
  contentHash: string;
  parameters: Record<string, unknown>;
  changeDescription?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateScriptVersionInput {
  version: string;
  content: string;
  parameters?: Record<string, unknown>;
  changeDescription?: string;
  createdBy?: string;
}

export interface ScriptVersionDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
  summary: string;
}

// ==================== API 方法 ====================

// POST /v1/script-versions/:scriptId/versions — 创建版本
export function createScriptVersion(scriptId: string, data: CreateScriptVersionInput) {
  return api.post<ScriptVersion>(`/v1/script-versions/${scriptId}/versions`, data);
}

// GET /v1/script-versions/:scriptId/versions — 列表
export function getScriptVersions(scriptId: string, params?: { latest?: string }) {
  return api.get<ScriptVersion[]>(`/v1/script-versions/${scriptId}/versions`, { params });
}

// GET /v1/script-versions/:scriptId/versions/latest — 最新版本
export function getLatestScriptVersion(scriptId: string) {
  return api.get<ScriptVersion>(`/v1/script-versions/${scriptId}/versions/latest`);
}

// GET /v1/script-versions/:scriptId/versions/:version — 指定版本
export function getScriptVersion(scriptId: string, version: string) {
  return api.get<ScriptVersion>(`/v1/script-versions/${scriptId}/versions/${version}`);
}

// GET /v1/script-versions/:scriptId/versions/:v1/diff/:v2 — 版本对比
export function diffScriptVersions(scriptId: string, v1: string, v2: string) {
  return api.get<ScriptVersionDiff>(
    `/v1/script-versions/${scriptId}/versions/${encodeURIComponent(v1)}/diff/${encodeURIComponent(v2)}`
  );
}

// DELETE /v1/script-versions/:scriptId/versions/:version — 删除版本
export function deleteScriptVersion(scriptId: string, version: string) {
  return api.delete(`/v1/script-versions/${scriptId}/versions/${version}`);
}
