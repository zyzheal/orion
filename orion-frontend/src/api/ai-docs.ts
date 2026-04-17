/**
 * AI Doc Management API Service
 * Knowledge base spaces, documents, RAG query, and knowledge graph
 */
import { api } from './client';

// ---- Types ----

export interface Space {
  id: string;
  name: string;
  type: 'public' | 'internal' | 'private';
  ownerId: string;
  teamId?: string;
  documentCount: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface SpaceInput {
  name: string;
  type: string;
  description?: string;
  teamId?: string;
}

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

export interface SpaceListParams {
  type?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface DocListParams {
  spaceId?: string;
  status?: string;
  tag?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

// ---- Spaces ----

export function getSpaces(params?: SpaceListParams) {
  return api.get('/v1/ai-docs/spaces', { params });
}

export function getSpace(id: string) {
  return api.get(`/v1/ai-docs/spaces/${id}`);
}

export function createSpace(data: SpaceInput) {
  return api.post('/v1/ai-docs/spaces', data);
}

export function updateSpace(id: string, data: Partial<SpaceInput>) {
  return api.put(`/v1/ai-docs/spaces/${id}`, data);
}

export function deleteSpace(id: string) {
  return api.delete(`/v1/ai-docs/spaces/${id}`);
}

// ---- Documents ----

export function getDocs(params?: DocListParams) {
  return api.get('/v1/ai-docs/docs', { params });
}

export function getDoc(id: string) {
  return api.get(`/v1/ai-docs/docs/${id}`);
}

export function createDoc(data: DocumentInput) {
  return api.post('/v1/ai-docs/docs', data);
}

export function updateDoc(id: string, data: UpdateDocumentInput) {
  return api.put(`/v1/ai-docs/docs/${id}`, data);
}

export function deleteDoc(id: string) {
  return api.delete(`/v1/ai-docs/docs/${id}`);
}

export function getDocVersions(id: string) {
  return api.get(`/v1/ai-docs/docs/${id}/versions`);
}

// ---- RAG ----

export function ragQuery(data: { query: string; spaceId?: string; topK?: number }) {
  return api.post('/v1/ai-docs/rag/query', data);
}

export function ragRetrieve(data: { query: string; spaceId?: string; topK?: number }) {
  return api.post('/v1/ai-docs/rag/retrieve', data);
}

// ---- Knowledge Graph ----

export function getKnowledgeGraph(params?: { spaceId?: string }) {
  return api.get('/v1/ai-docs/graph', { params });
}
