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
  return api.get<ApiKey[]>('/v1/api-keys');
}

export async function createApiKey(input: ApiKeyInput) {
  return api.post<ApiKey>('/v1/api-keys', input);
}

export async function revokeApiKey(id: string) {
  return api.delete<void>(`/v1/api-keys/${id}`);
}

export async function getApiKeyStats() {
  return api.get<ApiKeyStats>('/v1/api-keys/stats');
}
