/**
 * API Key API Client
 *
 * Backend routes: orion-platform-service/src/api/api-key-routes.ts
 */

import { api } from './client';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  enabled: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ApiKeyInput {
  name: string;
  expiresAt?: string;
}

export interface ApiKeyStats {
  total: number;
  active: number;
  expired: number;
}

export async function getApiKeys() {
  return api.get<ApiKey[]>('/api/api-keys');
}

export async function createApiKey(input: ApiKeyInput) {
  return api.post<ApiKey>('/api/api-keys', input);
}

export async function revokeApiKey(id: string) {
  return api.delete<void>(`/api/api-keys/${id}`);
}

export async function getApiKeyStats() {
  return api.get<ApiKeyStats>('/api/api-keys/stats');
}
