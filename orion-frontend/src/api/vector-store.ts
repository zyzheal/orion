/**
 * Vector Store API Service
 * Semantic search and vector document management
 */
import { api } from './client';

// ---- Types ----

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  collection: string;
  dimensions: number;
  status: 'active' | 'processing' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface VectorCollection {
  name: string;
  displayName: string;
  description?: string;
  documentCount: number;
  dimensions: number;
  indexType: 'flat' | 'ivf_flat' | 'hnsw' | 'annoy';
  distanceMetric: 'cosine' | 'euclidean' | 'dot_product';
  status: 'active' | 'creating' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface SearchHit {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  collection: string;
}

export interface VectorStats {
  documentCount: number;
  collectionCount?: number;
  totalEmbeddings?: number;
  avgDimensions?: number;
}

export interface AddDocumentInput {
  content: string;
  collection?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchInput {
  query: string;
  collection?: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

export interface CreateCollectionInput {
  name: string;
  displayName: string;
  description?: string;
  dimensions: number;
  indexType?: 'flat' | 'ivf_flat' | 'hnsw' | 'annoy';
  distanceMetric?: 'cosine' | 'euclidean' | 'dot_product';
}

// ---- Documents ----

export function addDocument(data: AddDocumentInput) {
  return api.post<{ id: string }>('/vector-store/documents', data);
}

export function deleteDocument(id: string) {
  return api.delete(`/vector-store/documents/${id}`);
}

// ---- Search ----

export function searchVectors(data: SearchInput) {
  return api.post<SearchHit[]>('/vector-store/search', data);
}

// ---- Collections ----

export function getCollections() {
  return api.get<VectorCollection[]>('/vector-store/collections');
}

export function createCollection(data: CreateCollectionInput) {
  return api.post<VectorCollection>('/vector-store/collections', data);
}

export function deleteCollection(name: string) {
  return api.delete(`/vector-store/collections/${name}`);
}

export function getCollectionDocuments(name: string) {
  return api.get<VectorDocument[]>(`/vector-store/collections/${name}/documents`);
}

// ---- Stats ----

export function getVectorStats() {
  return api.get<VectorStats>('/vector-store/stats');
}
