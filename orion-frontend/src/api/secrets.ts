/**
 * Secrets API Service
 * Pipeline secrets management — create, list, update, delete secrets.
 *
 * Security: Secret values are NEVER returned in list responses (masked as '***').
 * All secret values are encrypted at rest with AES-256-GCM on the backend.
 */
import { api } from './client';

export type SecretScope = 'org' | 'project' | 'environment';

/** A secret entry returned by the list/get endpoints (value is always masked). */
export interface Secret {
  id: string;
  name: string;
  scope: SecretScope;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/** Request body for creating a new secret. */
export interface CreateSecretInput {
  name: string;
  value: string;
  scope: SecretScope;
  description?: string;
}

/** Request body for updating a secret value. */
export interface UpdateSecretInput {
  value: string;
  description?: string;
}

// ---- CRUD Operations ----

/**
 * List all secrets for a tenant (values are masked).
 * Optional scope filter to narrow results.
 */
export function getSecrets(tenantId: string, scope?: SecretScope) {
  const params: Record<string, string> = {};
  if (scope) params.scope = scope;
  return api.get<Secret[]>(`/api/tenants/${tenantId}/secrets`, { params });
}

/**
 * Create a new encrypted secret.
 * The value is encrypted server-side with AES-256-GCM.
 */
export function createSecret(tenantId: string, data: CreateSecretInput) {
  return api.post<Secret>(`/api/tenants/${tenantId}/secrets`, data);
}

/**
 * Delete a secret by ID.
 */
export function deleteSecret(tenantId: string, id: string) {
  return api.delete(`/api/tenants/${tenantId}/secrets/${id}`);
}

/**
 * Update a secret's value (re-encrypts) and optionally description.
 */
export function updateSecret(tenantId: string, id: string, data: UpdateSecretInput) {
  return api.put<Secret>(`/api/tenants/${tenantId}/secrets/${id}`, data);
}
