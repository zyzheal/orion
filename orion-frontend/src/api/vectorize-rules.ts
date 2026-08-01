/**
 * Vectorize Rules API Service
 * Automatic vectorization rule management
 */
import { api } from './client';

export interface VectorizeRule {
  id: string;
  name: string;
  source_type: 'upload' | 'git' | 'api' | 'database';
  file_types: string[];
  chunk_size: number;
  chunk_overlap: number;
  embedding_model: string;
  target_collection: string;
  enabled: boolean;
  last_run: string | null;
  processed_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVectorizeRuleInput {
  name: string;
  source_type: string;
  file_types: string[];
  chunk_size?: number;
  chunk_overlap?: number;
  embedding_model?: string;
  target_collection: string;
}

export function listVectorizeRules() {
  return api.get<{ data: VectorizeRule[] }>('/api/vectorize-rules');
}

export function createVectorizeRule(data: CreateVectorizeRuleInput) {
  return api.post<{ data: VectorizeRule }>('/api/vectorize-rules', data);
}

export function updateVectorizeRule(id: string, data: Partial<VectorizeRule>) {
  return api.put<{ data: VectorizeRule }>(`/api/vectorize-rules/${id}`, data);
}

export function deleteVectorizeRule(id: string) {
  return api.delete(`/api/vectorize-rules/${id}`);
}

export function toggleVectorizeRule(id: string, enabled: boolean) {
  return api.patch<{ data: VectorizeRule }>(`/api/vectorize-rules/${id}/toggle`, { enabled });
}
