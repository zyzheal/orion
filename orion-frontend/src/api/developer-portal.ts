/**
 * Developer Portal API Service
 * API documents, mock rules, SDK generation, subscriptions, playground
 */

import apiClient from './client';

export type SDKLanguage = 'typescript' | 'python' | 'go' | 'java' | 'csharp';

export interface PortalDocument {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentFormat: 'markdown' | 'html';
  documentType: string;
  category?: string;
  tags: string[];
  version: string;
  status: 'published' | 'draft';
  published: boolean;
  views: number;
  helpful: number;
  viewCount: number;
  helpfulCount: number;
  authorId: string;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  count?: number;
}

export interface PortalDocumentCreateRequest {
  title: string;
  slug: string;
  content: string;
  contentFormat: string;
  documentType: string;
  category?: string;
  tags?: string[];
  version?: string;
}

export interface PortalDocumentUpdateRequest {
  title?: string;
  slug?: string;
  content?: string;
  contentFormat?: string;
  documentType?: string;
  category?: string;
  tags?: string[];
}

export interface MockRule {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  delay: number;
  priority: number;
  matchType: 'exact' | 'prefix' | 'regex';
  enabled: boolean;
  hits: number;
  created_at: string;
}

export interface MockRuleCreateRequest {
  name: string;
  description: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  delay: number;
  priority: number;
  matchType: 'exact' | 'prefix' | 'regex';
}

export interface SDKGenerationTask {
  id: string;
  name: string;
  apiSpec: string;
  language: SDKLanguage;
  packageName: string;
  version: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  output?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface SDKGenerateRequest {
  name: string;
  apiSpec: string;
  language: SDKLanguage;
  packageName: string;
  version: string;
}

export interface APISubscription {
  id: string;
  apiName: string;
  planName: string;
  quotaPerDay: number;
  quotaPerMonth: number;
  usedQuotaDay: number;
  usedQuotaMonth: number;
  usedToday: number;
  usedThisMonth: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'cancelled';
  rejectionReason?: string;
  rejectReason?: string;
  user: string;
  userId?: string;
  apiKey?: string;
  approvedBy?: string;
  expiresAt?: string;
  created_at: string;
  createdAt?: string;
}

export interface SubscriptionCreateRequest {
  apiName: string;
  planName: string;
  quotaPerDay: number;
  quotaPerMonth: number;
  reason: string;
}

export interface PlaygroundRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  bodyType: 'json' | 'form' | 'raw' | 'none';
  saved: boolean;
  created_at: string;
}

export interface PlaygroundExecuteRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: string;
  bodyType: 'json' | 'form' | 'raw' | 'none';
}

interface PaginatedParams {
  page?: number;
  perPage?: number;
  pageSize?: number;
}

export const developerPortalApi = {
  // Documents
  searchDocuments: async (query: string) => {
    const res = await apiClient.get('/api/v1/developer-portal/documents', { params: { q: query } });
    return res.data;
  },
  getCategories: async () => {
    const res = await apiClient.get('/api/v1/developer-portal/categories');
    return res.data as CategoryInfo[];
  },
  getPopularDocuments: async (limit: number = 5) => {
    const res = await apiClient.get('/api/v1/developer-portal/documents/popular', { params: { limit } });
    return res.data as PortalDocument[];
  },
  listDocuments: async (params?: PaginatedParams) => {
    const res = await apiClient.get('/api/v1/developer-portal/documents', { params });
    return res.data;
  },
  getDocument: async (id: string) => {
    const res = await apiClient.get(`/api/v1/developer-portal/documents/${id}`);
    return res.data as PortalDocument;
  },
  createDocument: async (data: PortalDocumentCreateRequest) => {
    const res = await apiClient.post('/api/v1/developer-portal/documents', data);
    return res.data as PortalDocument;
  },
  updateDocument: async (id: string, data: PortalDocumentUpdateRequest) => {
    const res = await apiClient.put(`/api/v1/developer-portal/documents/${id}`, data);
    return res.data;
  },
  deleteDocument: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/developer-portal/documents/${id}`);
    return res.data;
  },
  publishDocument: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/documents/${id}/publish`);
    return res.data;
  },
  unpublishDocument: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/documents/${id}/unpublish`);
    return res.data;
  },
  getDocumentVersions: async (id: string) => {
    const res = await apiClient.get(`/api/v1/developer-portal/documents/${id}/versions`);
    return res.data;
  },
  createDocumentVersion: async (id: string, version: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/documents/${id}/versions`, { version });
    return res.data;
  },
  getDocumentStats: async () => {
    const res = await apiClient.get('/api/v1/developer-portal/documents/stats');
    return res.data;
  },

  // Mock Rules
  listMockRules: async (params?: PaginatedParams) => {
    const res = await apiClient.get('/api/v1/developer-portal/mock-rules', { params });
    return res.data;
  },
  createMockRule: async (data: MockRuleCreateRequest) => {
    const res = await apiClient.post('/api/v1/developer-portal/mock-rules', data);
    return res.data as MockRule;
  },
  updateMockRule: async (id: string, data: Partial<MockRuleCreateRequest>) => {
    const res = await apiClient.put(`/api/v1/developer-portal/mock-rules/${id}`, data);
    return res.data;
  },
  deleteMockRule: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/developer-portal/mock-rules/${id}`);
    return res.data;
  },
  toggleMockRule: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/mock-rules/${id}/toggle`);
    return res.data;
  },
  getMockStats: async () => {
    const res = await apiClient.get('/api/v1/developer-portal/mock-rules/stats');
    return res.data;
  },

  // SDK
  listSDKTasks: async (params?: PaginatedParams) => {
    const res = await apiClient.get('/api/v1/developer-portal/sdk-tasks', { params });
    return res.data;
  },
  generateSDK: async (data: SDKGenerateRequest) => {
    const res = await apiClient.post('/api/v1/developer-portal/sdk-tasks', data);
    return res.data as SDKGenerationTask;
  },
  deleteSDKTask: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/developer-portal/sdk-tasks/${id}`);
    return res.data;
  },
  regenerateSDK: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/sdk-tasks/${id}/regenerate`);
    return res.data;
  },
  getSDKStats: async () => {
    const res = await apiClient.get('/api/v1/developer-portal/sdk-tasks/stats');
    return res.data;
  },

  // Subscriptions
  listSubscriptions: async (params?: PaginatedParams) => {
    const res = await apiClient.get('/api/v1/developer-portal/subscriptions', { params });
    return res.data;
  },
  createSubscription: async (data: SubscriptionCreateRequest) => {
    const res = await apiClient.post('/api/v1/developer-portal/subscriptions', data);
    return res.data as APISubscription;
  },
  approveSubscription: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/approve`);
    return res.data;
  },
  rejectSubscription: async (id: string, reason: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/reject`, { reason });
    return res.data;
  },
  suspendSubscription: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/suspend`);
    return res.data;
  },
  cancelSubscription: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/subscriptions/${id}/cancel`);
    return res.data;
  },
  getSubscriptionStats: async () => {
    const res = await apiClient.get('/api/v1/developer-portal/subscriptions/stats');
    return res.data;
  },

  // Playground
  listPlaygroundRequests: async (params?: PaginatedParams) => {
    const res = await apiClient.get('/api/v1/developer-portal/playground/requests', { params });
    return res.data;
  },
  executePlaygroundRequest: async (data: PlaygroundExecuteRequest) => {
    const res = await apiClient.post('/api/v1/developer-portal/playground/execute', data);
    return res.data;
  },
  deletePlaygroundRequest: async (id: string) => {
    const res = await apiClient.delete(`/api/v1/developer-portal/playground/requests/${id}`);
    return res.data;
  },
  executeSavedPlaygroundRequest: async (id: string) => {
    const res = await apiClient.post(`/api/v1/developer-portal/playground/requests/${id}/execute`);
    return res.data;
  },
  getPlaygroundHistory: async (requestId: string) => {
    const res = await apiClient.get(`/api/v1/developer-portal/playground/requests/${requestId}/history`);
    return res.data;
  },
  getPlaygroundStats: async () => {
    const res = await apiClient.get('/api/v1/developer-portal/playground/stats');
    return res.data;
  },
};

export default developerPortalApi;
