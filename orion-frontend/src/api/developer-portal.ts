/**
 * Developer Portal API Client
 *
 * API client for the Developer Portal (PortalDocument) backend endpoints.
 * Base path: /api/v1/developer-portal
 */

import apiClient from './client';

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

export const developerPortalApi = {
  // List documents with filtering and pagination
  listDocuments: async (params?: ListDocumentsParams) => {
    const response = await apiClient.get('/api/v1/developer-portal/documents', { params });
    return response.data as { success: boolean; data: PortalDocument[]; total: number; page: number; totalPages: number };
  },

  // Get document by ID
  getDocument: async (id: string) => {
    const response = await apiClient.get(`/api/v1/developer-portal/documents/${id}`);
    return response.data as { success: boolean; data: PortalDocument };
  },

  // Create document
  createDocument: async (doc: PortalDocumentCreateRequest) => {
    const response = await apiClient.post('/api/v1/developer-portal/documents', doc);
    return response.data as { success: boolean; data: PortalDocument };
  },

  // Update document
  updateDocument: async (id: string, doc: PortalDocumentUpdateRequest) => {
    const response = await apiClient.put(`/api/v1/developer-portal/documents/${id}`, doc);
    return response.data as { success: boolean; data: PortalDocument };
  },

  // Delete document
  deleteDocument: async (id: string) => {
    const response = await apiClient.delete(`/api/v1/developer-portal/documents/${id}`);
    return response.data as { success: boolean; message: string };
  },

  // Search documents
  searchDocuments: async (query: string, params?: { type?: string; category?: string }) => {
    const response = await apiClient.get('/api/v1/developer-portal/documents/search', {
      params: { q: query, ...params },
    });
    return response.data as { success: boolean; data: PortalDocument[]; total: number };
  },

  // Publish document
  publishDocument: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/publish`);
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  // Unpublish document
  unpublishDocument: async (id: string) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/unpublish`);
    return response.data as { success: boolean; data: PortalDocument; message: string };
  },

  // Get categories
  getCategories: async () => {
    const response = await apiClient.get('/api/v1/developer-portal/categories');
    return response.data as { success: boolean; data: CategoryInfo[]; total: number };
  },

  // Get popular documents
  getPopularDocuments: async (limit?: number) => {
    const response = await apiClient.get('/api/v1/developer-portal/popular', {
      params: { limit },
    });
    return response.data as { success: boolean; data: PortalDocument[]; total: number };
  },

  // Record helpful feedback
  recordHelpful: async (id: string, isHelpful: boolean) => {
    const response = await apiClient.post(`/api/v1/developer-portal/documents/${id}/helpful`, {
      isHelpful,
    });
    return response.data as { success: boolean; message: string };
  },
};

export default developerPortalApi;
