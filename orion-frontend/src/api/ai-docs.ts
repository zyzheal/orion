/**
 * AI Docs / Knowledge API Service
 * - Space CRUD (knowledge base spaces)
 * - Document CRUD (docs within spaces)
 * - RAG retrieve & query (for future use)
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Space {
  id: string;
  name: string;
  type: 'public' | 'internal' | 'private';
  ownerId: string;
  teamId?: string;
  documentCount?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceInput {
  name: string;
  type: 'public' | 'internal' | 'private';
  description?: string;
  teamId?: string;
}

export interface Doc {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  tags?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended Document type used by DocumentList and DocumentEditor pages.
 * Includes status, author, and richer metadata fields.
 */
export interface Document {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  tags: string[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocInput {
  title: string;
  content: string;
  spaceId: string;
  tags?: string[];
}

/**
 * Document input used by DocumentList page (includes spaceId at top level).
 */
export interface DocumentInput {
  spaceId: string;
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  tags?: string[];
  status?: string;
}

export interface GetDocsParams {
  spaceId?: string;
  page?: number;
  tag?: string;
}

export interface RagRetrieveResponse {
  results: Array<{
    docId: string;
    title: string;
    snippet: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  total: number;
}

export interface RagQueryResponse {
  answer: string;
  sources: Array<{
    docId: string;
    title: string;
    relevance: number;
  }>;
}

/**
 * RAGResult type used by RAGQuery page for rendering source snippets.
 */
export interface RAGResult {
  documentId: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  spaceId: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGResult[];
  confidence: number;
}

// ============================================================================
// Space CRUD
// ============================================================================

export const getSpaces = async (params?: {
  type?: string;
  search?: string;
  page?: number;
  perPage?: number;
}) => {
  return api.get<Space[]>('/api/v1/knowledge/api/v1/spaces', { params });
};

export const getSpace = async (id: string) => {
  return api.get<Space>(`/api/v1/knowledge/api/v1/spaces/${id}`);
};

export const createSpace = async (input: SpaceInput) => {
  return api.post<Space>('/api/v1/knowledge/api/v1/spaces', input);
};

export const updateSpace = async (id: string, input: Partial<SpaceInput>) => {
  return api.put<Space>(`/api/v1/knowledge/api/v1/spaces/${id}`, input);
};

export const deleteSpace = async (id: string) => {
  return api.delete(`/api/v1/knowledge/api/v1/spaces/${id}`);
};

// ============================================================================
// Document CRUD
// ============================================================================

export const getDocs = async (params?: {
  spaceId?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  tag?: string;
  search?: string;
  perPage?: number;
}) => {
  return api.get<Document[]>('/api/v1/knowledge/api/v1/docs', { params });
};

export const getDoc = async (id: string) => {
  return api.get<Document>(`/api/v1/knowledge/api/v1/docs/${id}`);
};

export const createDoc = async (input: DocInput | DocumentInput) => {
  return api.post<Document>('/api/v1/knowledge/api/v1/docs', input);
};

export const updateDoc = async (id: string, input: Partial<DocInput> | UpdateDocumentInput) => {
  return api.put<Document>(`/api/v1/knowledge/api/v1/docs/${id}`, input);
};

export const deleteDoc = async (id: string) => {
  return api.delete(`/api/v1/knowledge/api/v1/docs/${id}`);
};

export const getDocVersions = async (id: string) => {
  return api.get(`/api/v1/knowledge/api/v1/docs/${id}/versions`);
};

// ============================================================================
// RAG API (for future use)
// ============================================================================

export const ragRetrieve = async (data: { query: string; spaceId?: string; topK?: number }) => {
  return api.post<RagRetrieveResponse>('/api/v1/knowledge/api/v1/rag/retrieve', data);
};

export const ragQuery = async (data: { query: string; spaceId?: string; topK?: number }) => {
  return api.post<RAGResponse>('/api/v1/knowledge/api/v1/rag/query', data);
};

// ============================================================================
// Knowledge Graph
// ============================================================================

export const getKnowledgeGraph = async (params?: { spaceId?: string }) => {
  return api.get('/api/v1/knowledge/api/v1/graph', { params });
};
