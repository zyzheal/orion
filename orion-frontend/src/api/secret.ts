/**
 * Secret Management API Service
 *
 * Aligned with backend /v1/tenants/:tenantId/secrets/* routes (secret-routes.ts)
 * Extends the existing secrets.ts with resolve and references endpoints.
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface Secret {
  id: string;
  tenant_id: string;
  name: string;
  scope?: 'org' | 'project' | 'environment';
  description?: string;
  value?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateSecretInput {
  name: string;
  value: string;
  scope?: 'org' | 'project' | 'environment';
  description?: string;
}

export interface UpdateSecretInput {
  value: string;
  description?: string;
}

export interface SecretReference {
  id: string;
  secretId: string;
  resourceType: string;
  resourceId: string;
  referencePath: string;
  createdAt: string;
}

export interface ResolveSecretResult {
  resolved: Record<string, string>;
  unresolved: string[];
}

// ==================== CRUD Operations ====================

export const getSecrets = async (tenantId: string, params?: {
  scope?: string;
}): Promise<Secret[]> => {
  const response = await api.get<{ data: Secret[] }>(`/v1/tenants/${tenantId}/secrets`, { params });
  return response.data.data;
};

export const getSecret = async (tenantId: string, id: string): Promise<Secret> => {
  const response = await api.get<{ data: Secret }>(`/v1/tenants/${tenantId}/secrets/${id}`);
  return response.data.data;
};

export const createSecret = async (tenantId: string, data: CreateSecretInput): Promise<Secret> => {
  const response = await api.post<{ data: Secret }>(`/v1/tenants/${tenantId}/secrets`, data);
  return response.data.data;
};

export const updateSecret = async (tenantId: string, id: string, data: UpdateSecretInput): Promise<Secret> => {
  const response = await api.put<{ data: Secret }>(`/v1/tenants/${tenantId}/secrets/${id}`, data);
  return response.data.data;
};

export const deleteSecret = async (tenantId: string, id: string): Promise<void> => {
  await api.delete(`/v1/tenants/${tenantId}/secrets/${id}`);
};

// ==================== Resolve ====================

export const resolveSecrets = async (tenantId: string, data: {
  references: string[];
}): Promise<ResolveSecretResult> => {
  const response = await api.post<{ data: ResolveSecretResult }>(`/v1/tenants/${tenantId}/secrets/resolve`, data);
  return response.data.data;
};

// ==================== References ====================

export const getSecretReferences = async (tenantId: string, id: string): Promise<SecretReference[]> => {
  const response = await api.get<{ data: SecretReference[] }>(`/v1/tenants/${tenantId}/secrets/${id}/references`);
  return response.data.data;
};
