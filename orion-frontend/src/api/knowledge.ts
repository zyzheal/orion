/**
 * Knowledge API Client
 *
 * 复用知识库 API，通过 type 参数区分官方文档和用户知识库
 * - type=docs: 官方文档 (/docs)
 * - type=knowledge: 用户知识库 (/knowledge)
 *
 * Backend routes: orion-platform-service/src/api/knowledge-routes.ts
 */

import { api } from './client';

// =============================================================================
// Types - 复用后端类型
// =============================================================================

/** Space 类型 */
export type SpaceType = 'public' | 'internal' | 'private' | 'docs';

/** 内容来源 */
export type ContentSource = 'manual' | 'synced';

/** Space 实体 */
export interface KnowledgeSpace {
  id: string;
  tenant_id: string;
  name: string;
  type: SpaceType;
  source?: ContentSource;
  owner_id: string;
  team_id: string | null;
  description: string | null;
  doc_count: number;
  created_at: string;
  updated_at: string;
}

/** Document 状态 */
export type DocStatus = 'draft' | 'published' | 'archived';

/** Document 实体 */
export interface KnowledgeDoc {
  id: string;
  tenant_id: string;
  space_id: string;
  title: string;
  content: string;
  type: string;
  source?: ContentSource;
  tags: string[];
  status: DocStatus;
  version: number;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  // 前端扩展字段
  spaceName?: string;
}

/** 同步日志 */
export interface SyncLog {
  id: string;
  file_path: string;
  space_id: string;
  doc_id: string;
  status: 'success' | 'failed' | 'skipped';
  error_message?: string;
  sync_type: 'full' | 'incremental';
  created_at: string;
}

/** 同步结果 */
export interface SyncResult {
  success: boolean;
  totalFiles: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  logs: SyncLog[];
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * 获取官方文档列表 (type=docs)
 */
export async function getDocs(params?: {
  spaceId?: string;
  tag?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: KnowledgeDoc[]; total: number }> {
  const queryParams = new URLSearchParams();
  queryParams.append('type', 'docs');
  if (params?.spaceId) queryParams.append('spaceId', params.spaceId);
  if (params?.tag) queryParams.append('tag', params.tag);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

  const res = await api.get<{ data: KnowledgeDoc[]; meta: { total: number } }>(
    `/v1/knowledge/v1/docs?${queryParams.toString()}`
  );
  return {
    data: res.data?.data || [],
    total: res.data?.meta?.total || 0,
  };
}

/**
 * 获取单个文档详情
 */
export async function getDoc(id: string): Promise<KnowledgeDoc> {
  const res = await api.get<{ data: KnowledgeDoc }>(`/v1/knowledge/v1/docs/${id}`);
  return res.data?.data;
}

/**
 * 获取文档分类列表 (按 tag 聚合)
 */
export async function getDocTags(): Promise<string[]> {
  const res = await api.get<{ data: string[] }>('/v1/knowledge/v1/docs/tags?type=docs');
  return res.data?.data || [];
}

/**
 * 获取文档目录结构 (Space + tag 树形结构)
 */
export async function getDocToc(): Promise<{
  spaces: KnowledgeSpace[];
  tags: string[];
}> {
  const res = await api.get<{ data: { spaces: KnowledgeSpace[]; tags: string[] } }>(
    '/v1/knowledge/v1/docs/toc?type=docs'
  );
  return res.data?.data || { spaces: [], tags: [] };
}

/**
 * 获取 Space 列表 (type=docs)
 */
export async function getDocSpaces(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: KnowledgeSpace[]; total: number }> {
  const queryParams = new URLSearchParams();
  queryParams.append('type', 'docs');
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

  const res = await api.get<{ data: KnowledgeSpace[]; meta: { total: number } }>(
    `/v1/knowledge/v1/spaces?${queryParams.toString()}`
  );
  return {
    data: res.data?.data || [],
    total: res.data?.meta?.total || 0,
  };
}

/**
 * 触发文档同步 (仅 admin)
 */
export async function triggerDocSync(
  syncType: 'full' | 'incremental'
): Promise<SyncResult> {
  const res = await api.post<{ data: SyncResult }>(
    `/v1/knowledge/v1/sync?type=${syncType}`
  );
  return res.data?.data;
}

/**
 * 获取同步日志
 */
export async function getSyncLogs(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ data: SyncLog[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

  const res = await api.get<{ data: SyncLog[]; meta: { total: number } }>(
    `/v1/knowledge/v1/sync/logs?${queryParams.toString()}`
  );
  return {
    data: res.data?.data || [],
    total: res.data?.meta?.total || 0,
  };
}

/**
 * 文档语义检索 (RAG)
 */
export async function searchDocs(
  query: string,
  spaceId?: string,
  topK: number = 10
): Promise<{
  results: Array<{
    docId: string;
    title: string;
    snippet: string;
    score: number;
  }>;
}> {
  const res = await api.post<{ data: { results: any[]; total: number } }>(
    '/v1/knowledge/v1/rag/retrieve',
    {
      query,
      spaceId,
      topK,
    }
  );
  return {
    results: res.data?.data?.results || [],
  };
}

// =============================================================================
// Legacy API - 保留兼容
// =============================================================================

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeInput {
  title: string;
  content: string;
  category: string;
  tags?: string[];
}

export async function searchKnowledge(query: string) {
  return api.get<{ items: KnowledgeItem[] }>(`/v1/knowledge/search?q=${encodeURIComponent(query)}`);
}

export async function getKnowledge(id: string) {
  return api.get<{ item: KnowledgeItem }>(`/v1/knowledge/${id}`);
}

export async function createKnowledge(input: KnowledgeInput) {
  return api.post<{ item: KnowledgeItem }>('/v1/knowledge', input);
}

export async function updateKnowledge(id: string, input: Partial<KnowledgeInput>) {
  return api.put<{ item: KnowledgeItem }>(`/v1/knowledge/${id}`, input);
}

export async function deleteKnowledge(id: string) {
  return api.delete<void>(`/v1/knowledge/${id}`);
}
