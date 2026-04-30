/**
 * Knowledge API Client
 *
 * Backend routes: orion-platform-service/src/api/knowledge-routes.ts
 */

import { api } from './client';

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
