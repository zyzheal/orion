/**
 * PandaWiki Knowledge Base API Service
 * Space and document management with search
 */
import { api } from './client';

export interface WikiSpace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export interface WikiDocument {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
}

export interface CreateDocumentInput {
  title: string;
  content: string;
  parentId?: string;
}

export interface SearchResult {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  score: number;
}

// ---- Spaces ----

export function listSpaces() {
  return api.get<WikiSpace[]>('/api/knowledge/spaces');
}

export function createSpace(data: CreateSpaceInput) {
  return api.post('/api/knowledge/spaces', data);
}

export function getSpace(id: string) {
  return api.get(`/api/knowledge/spaces/${id}`);
}

export function deleteSpace(id: string) {
  return api.delete(`/api/knowledge/spaces/${id}`);
}

// ---- Documents ----

export function listDocuments(spaceId: string) {
  return api.get<WikiDocument[]>(`/api/knowledge/spaces/${spaceId}/documents`);
}

export function createDocument(spaceId: string, data: CreateDocumentInput) {
  return api.post(`/api/knowledge/spaces/${spaceId}/documents`, data);
}

export function getDocument(spaceId: string, docId: string) {
  return api.get(`/api/knowledge/spaces/${spaceId}/documents/${docId}`);
}

export function deleteDocument(spaceId: string, docId: string) {
  return api.delete(`/api/knowledge/spaces/${spaceId}/documents/${docId}`);
}

// ---- Search ----

export function searchDocuments(query: string, spaceId?: string) {
  return api.get<SearchResult[]>('/api/knowledge/search', {
    params: { q: query, spaceId },
  });
}
