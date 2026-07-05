/**
 * Developer Portal API Client
 *
 * API client for the Developer Portal backend endpoints.
 * Base path: /api/v1/developer-portal
 *
 * Supports: Document CRUD, Mock Rules, SDK Generation, API Subscriptions, Playground
 */

import apiClient from './client';

// ==================== Document Types ====================

export interface PortalDocument {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  content: string;
  contentFormat?: string;
  documentType: string;
  category?: string;
  tags: string[];
  version?: string;
  authorId: string;
  published: boolean;
  metadata?: Record<string, unknown>;
  helpfulCount?: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface PortalDocumentListResponse {
  data: PortalDocument[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PortalDocumentCreateRequest {
  title: string;
  slug: string;
  content: string;
  contentFormat?: string;
  documentType: string;
  category?: string;
  tags?: string[];
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface PortalDocumentUpdateRequest {
  title?: string;
  slug?: string;
  content?: string;
  contentFormat?: string;
  documentType?: string;
  category?: string;
  tags?: string[];
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface CategoryInfo {
  name: string;
  count: number;
}

export interface ListDocumentsParams {
  type?: string;
  category?: string;
  tags?: string;
  published?: boolean;
  page?: number;
  perPage?: number;
}

// ==================== Mock Types ====================

export interface MockRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  delay: number;
  enabled: boolean;
  priority: number;
  matchType: 'exact' | 'prefix' | 'regex';
  createdAt: string;
  updatedAt: string;
}

export interface MockRuleCreateRequest {
  name: string;
  description?: string;
  method: string;
  path: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  delay?: number;
  priority?: number;
  matchType?: 'exact' | 'prefix' | 'regex';
}

export interface MockRuleUpdateRequest {
  name?: string;
  description?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  delay?: number;
  enabled?: boolean;
  priority?: number;
  matchType?: 'exact' | 'prefix' | 'regex';
}

// ==================== SDK Types ====================

export type SDKLanguage = 'typescript' | 'python' | 'go' | 'java' | 'csharp';

export interface SDKGenerationTask {
  id: string;
  tenantId: string;
  name: string;
  language: SDKLanguage;
  packageName: string;
  version: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  output: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SDKGenerateRequest {
  name: string;
  apiSpec: string;
  language: SDKLanguage;
  packageName: string;
  version?: string;
}

// ==================== Subscription Types ====================

export type SubscriptionStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'cancelled';

export interface APISubscription {
  id: string;
  tenantId: string;
  userId: string;
  apiName: string;
  planName: string;
  quotaPerDay: number;
  quotaPerMonth: number;
  usedToday: number;
  usedThisMonth: number;
  status: SubscriptionStatus;
  reason: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  apiKey: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCreateRequest {
  apiName: string;
  planName?: string;
  quotaPerDay?: number;
  quotaPerMonth?: number;
  reason?: string;
}

// ==================== Playground Types ====================

export interface PlaygroundRequest {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  bodyType: 'json' | 'form' | 'raw' | 'none';
  createdAt: string;
}

export interface PlaygroundResponse {
  id: string;
  requestId: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  latencyMs: number;
  timestamp: string;
}

export interface PlaygroundExecuteRequest {
  name?: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  bodyType?: 'json' | 'form' | 'raw' | 'none';
}

// ==================== API Client ====================

export const developerPortalApi = {
  // ==================== Documents ====================

  listDocuments: async (params?: ListDocumentsParams) => {
    const response = await apiClient.get('/api/v1/developer-portal/documents', { params });
    return response.data as { success: boolean; data: PortalDocument[]; total: number; page: number; totalPages: number };
  },

  getDocument: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/documents/${id}`);
    return response.data as { success: boolean; data: PortalDocument };
  },

  createDocument: async (doc: PortalDocumentCreateRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/documents', doc);
    return response.data as { success: boolean; data: PortalDocument };
  },

  updateDocument: async (id: string, doc: PortalDocumentUpdateRequest) => {
    const response = await apiClient.put(`/api/v1/developer-portal/documents/${id}`, doc);
    return response.data as { success: boolean; data: PortalDocument };
  },

  deleteDocument: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/developer-portal/documents/${id}`);
    return response.data as { success: boolean; message: string };
  },

  searchDocuments: async (query: string, params?: { type?: string; category?: string }) => {
    const response = await apiClient.get('/api/v1/developer-portal/documents/search', {
      params: { q: query, ...params },
    });
    return response.data as { success: boolean; data: PortalDocument[]; total: number };
  },

  publishDocument: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/publish`);
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  unpublishDocument: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/unpublish`);
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  getCategories: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/categories');
    return response.data as { success: boolean; data: CategoryInfo[]; total: number };
  },

  getPopularDocuments: async (limit?: number) => {
    const response = await apiClient.get('/api/v1/developer-portal/popular', {
      params: { limit },
    });
    return response.data as { success: boolean; data: PortalDocument[]; total: number };
  },

  recordHelpful: async (id: string, isHelpful: boolean) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/helpful`, {
      isHelpful,
    });
    return response.data as { success: boolean; message: string };
  },

  // Version management
  getDocumentVersions: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/documents/${id}/versions`);
    return response.data as { success: boolean; data: PortalDocument[]; total: number };
  },

  createDocumentVersion: async (id: string, version: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/versions`, { version });
    return response.data as { success: boolean; data: PortalDocument };
  },

  // Review workflow
  submitForReview: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/review/submit`);
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  approveReview: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/review/approve`);
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  rejectReview: async (id: string, reason: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/review/reject`, { reason });
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  getDocumentStats: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/documents/stats');
    return response.data as { success: boolean; data: { total: number; published: number; draft: number; inReview: number; totalViews: number; totalHelpful: number } };
  },

  // ==================== Mock Rules ====================

  listMockRules: async (params?: { enabled?: boolean; method?: string; page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/api/v1/developer-portal/mock-rules', { params });
    return response.data as { success: boolean; data: MockRule[]; total: number; page: number; totalPages: number };
  },

  getMockRule: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/mock-rules/${id}`);
    return response.data as { success: boolean; data: MockRule };
  },

  createMockRule: async (rule: MockRuleCreateRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/mock-rules', rule);
    return response.data as { success: boolean; data: MockRule };
  },

  updateMockRule: async (id: string, rule: MockRuleUpdateRequest) => {
    const response = await apiClient.put(`/api/v1/developer-portal/mock-rules/${id}`, rule);
    return response.data as { success: boolean; data: MockRule };
  },

  deleteMockRule: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/developer-portal/mock-rules/${id}`);
    return response.data as { success: boolean; message: string };
  },

  toggleMockRule: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/mock-rules/${id}/toggle`);
    return response.data as { success: boolean; data: MockRule };
  },

  getMockStats: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/mock-rules/stats');
    return response.data as { success: boolean; data: { total: number; enabled: number; disabled: number } };
  },

  simulateMock: async (method: string, path: string) => {
    const response = await apiClient.post('/api/v1/developer-portal/mock-simulate', { method, path });
    return response.data as { success: boolean; data: { matched: boolean; statusCode: number; body: unknown } };
  },

  // ==================== SDK Generator ====================

  getSDKLanguages: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/sdk/languages');
    return response.data as { success: boolean; data: Array<{ language: string; fileExtension: string; packageManager: string; httpClient: string; typeSystem: string }> };
  },

  listSDKTasks: async (params?: { language?: string; status?: string; page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/api/v1/developer-portal/sdk/tasks', { params });
    return response.data as { success: boolean; data: SDKGenerationTask[]; total: number; page: number; totalPages: number };
  },

  getSDKTask: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/sdk/tasks/${id}`);
    return response.data as { success: boolean; data: SDKGenerationTask };
  },

  generateSDK: async (input: SDKGenerateRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/sdk/generate', input);
    return response.data as { success: boolean; data: SDKGenerationTask };
  },

  deleteSDKTask: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/developer-portal/sdk/tasks/${id}`);
    return response.data as { success: boolean; message: string };
  },

  regenerateSDK: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/sdk/tasks/${id}/regenerate`);
    return response.data as { success: boolean; data: SDKGenerationTask };
  },

  getSDKStats: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/sdk/tasks/stats');
    return response.data as { success: boolean; data: { total: number; completed: number; failed: number; pending: number } };
  },

  // ==================== Subscriptions ====================

  listSubscriptions: async (params?: { userId?: string; apiName?: string; status?: string; page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/api/v1/developer-portal/subscriptions', { params });
    return response.data as { success: boolean; data: APISubscription[]; total: number; page: number; totalPages: number };
  },

  getSubscription: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/subscriptions/${id}`);
    return response.data as { success: boolean; data: APISubscription };
  },

  createSubscription: async (input: SubscriptionCreateRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/subscriptions', input);
    return response.data as { success: boolean; data: APISubscription };
  },

  approveSubscription: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/approve`);
    return response.data as { success: boolean; data: APISubscription; message: string };
  },

  rejectSubscription: async (id: string, reason: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/reject`, { reason });
    return response.data as { success: boolean; data: APISubscription; message: string };
  },

  suspendSubscription: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/suspend`);
    return response.data as { success: boolean; data: APISubscription; message: string };
  },

  cancelSubscription: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/cancel`);
    return response.data as { success: boolean; data: APISubscription; message: string };
  },

  getSubscriptionUsage: async (id: string, params?: { page?: number; pageSize?: number }) => {
    const response = await apiClient.get(`/api/v1/developer-portal/subscriptions/${id}/usage`, { params });
    return response.data as { success: boolean; data: Array<{ id: string; endpoint: string; method: string; statusCode: number; latencyMs: number; timestamp: string }>; total: number };
  },

  getSubscriptionStats: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/subscriptions/stats');
    return response.data as { success: boolean; data: { totalSubscriptions: number; approved: number; pending: number; rejected: number; suspended: number } };
  },

  // ==================== Playground ====================

  executePlaygroundRequest: async (input: PlaygroundExecuteRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/playground/execute', input);
    return response.data as { success: boolean; data: { request: PlaygroundRequest; response: PlaygroundResponse } };
  },

  listPlaygroundRequests: async (params?: { method?: string; page?: number; pageSize?: number }) => {
    const response = await apiClient.get('/api/v1/developer-portal/playground/requests', { params });
    return response.data as { success: boolean; data: PlaygroundRequest[]; total: number; page: number; totalPages: number };
  },

  savePlaygroundRequest: async (input: PlaygroundExecuteRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/playground/requests', input);
    return response.data as { success: boolean; data: PlaygroundRequest };
  },

  getPlaygroundRequest: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/playground/requests/${id}`);
    return response.data as { success: boolean; data: PlaygroundRequest };
  },

  updatePlaygroundRequest: async (id: string, input: Partial<PlaygroundExecuteRequest>) => {
    const response = await apiClient.put(`/api/v1/developer-portal/playground/requests/${id}`, input);
    return response.data as { success: boolean; data: PlaygroundRequest };
  },

  deletePlaygroundRequest: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/developer-portal/playground/requests/${id}`);
    return response.data as { success: boolean; message: string };
  },

  executeSavedPlaygroundRequest: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/playground/requests/${id}/execute`);
    return response.data as { success: boolean; data: { request: PlaygroundRequest; response: PlaygroundResponse } };
  },

  getPlaygroundHistory: async (requestId: string, params?: { page?: number; pageSize?: number }) => {
    const response = await apiClient.get(`/api/v1/developer-portal/playground/requests/${requestId}/history`, { params });
    return response.data as { success: boolean; data: PlaygroundResponse[]; total: number };
  },

  clearPlaygroundHistory: async (requestId: string) => {
    const response = await apiClient.delete(`/api/v1/developer-portal/playground/requests/${requestId}/history`);
    return response.data as { success: boolean; message: string };
  },

  getPlaygroundStats: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/playground/stats');
    return response.data as { success: boolean; data: { totalRequests: number; totalExecutions: number; avgLatency: number } };
  },
};

export default developerPortalApi;
