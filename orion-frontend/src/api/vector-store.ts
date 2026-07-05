/**
 * Vector Store API Service
 * Semantic search and vector document management
 */
import { api } from './client';

// ---- Types ----

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
}

export interface SearchInput {
  query: string;
  collection?: string;
  topK?: number;
  filter?: Record<string, any>;
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
  return api.post<{ id: string }>('/api/v1/vector-store/documents', data);
}

export function deleteDocument(id: string) {
  return api.delete(`/api/v1/vector-store/documents/${id}`);
}

// ---- Search ----

export function searchVectors(data: SearchInput) {
  return api.post<SearchHit[]>('/api/v1/vector-store/search', data);
}

// ---- Collections ----

export function getCollections() {
  return api.get<VectorCollection[]>('/api/v1/vector-store/collections');
}

export function createCollection(data: CreateCollectionInput) {
  return api.post<VectorCollection>('/api/v1/vector-store/collections', data);
}

export function deleteCollection(name: string) {
  return api.delete(`/api/v1/vector-store/collections/${name}`);
}

export function getCollectionDocuments(name: string) {
  return api.get<VectorDocument[]>(`/api/v1/vector-store/collections/${name}/documents`);
}

// ---- Stats ----

export function getVectorStats() {
  return api.get<VectorStats>('/api/v1/vector-store/stats');
}
