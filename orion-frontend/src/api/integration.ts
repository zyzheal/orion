/**
 * Integration API Client
 *
 * Aligned with backend /api/v1/integration/* routes (integration-routes.ts)
 * Covers: integration CRUD, connector registry, connection testing, actions, mappings
 */
import { api } from './client';

export interface Integration {
  id: string;
  tenant_id: string;
  provider: string;
  name: string;
  config: Record<string, unknown>;
  status?: 'active' | 'inactive' | 'error';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectorInfo {
  type: string;
  name: string;
  description?: string;
  capabilities?: string[];
}

export interface ResourceMapping {
  id: string;
  integration_id: string;
  resource_type: string;
  resource_id: string;
  external_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ConnectionTestResult {
  connected: boolean;
  message?: string;
  latency?: number;
}

// ==================== Integration CRUD ====================

export const createIntegration = async (data: {
  provider: string;
  name: string;
  config: Record<string, unknown>;
  tenantId?: string;
  createdBy?: string;
}): Promise<Integration> => {
  const response = await api.post<{ integration: Integration }>('/api/v1/integration', data);
  return (response.data as { integration: Integration }).integration ?? response.data;
};

export const listIntegrations = async (params?: {
  tenantId?: string;
  provider?: string;
}): Promise<{ integrations: Integration[]; total: number }> => {
  const response = await api.get<{ integrations: Integration[]; total: number }>('/api/v1/integration', { params });
  return response.data;
};

export const getIntegration = async (id: string): Promise<Integration> => {
  const response = await api.get<{ integration: Integration }>(`/api/v1/integration/${id}`);
  return  (response.data as { integration: Integration }).integration ?? response.data;
};

export const updateIntegration = async (id: string, data: {
  name?: string;
  config?: Record<string, unknown>;
  status?: string;
}): Promise<Integration> => {
  const response = await api.put<{ integration: Integration }>(`/api/v1/integration/${id}`, data);
  return  (response.data as { integration: Integration }).integration ?? response.data;
};

export const deleteIntegration = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/integration/${id}`);
};

// ==================== Connectors ====================

export const listConnectors = async (): Promise<{ connectors: ConnectorInfo[]; providers: string[] }> => {
  const response = await api.get<{ connectors: ConnectorInfo[]; providers: string[] }>('/api/v1/integration/connectors');
  return response.data;
};

// ==================== Connection & Actions ====================

export const testConnection = async (id: string): Promise<ConnectionTestResult> => {
  const response = await api.post<{ connected: ConnectionTestResult }>(`/api/v1/integration/${id}/test`);
  return  (response.data as { connected: ConnectionTestResult }).connected ?? response.data;
};

export const executeConnectorAction = async (id: string, data: {
  action: string;
  params?: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const response = await api.post<{ result: Record<string, unknown> }>(`/api/v1/integration/${id}/execute`, data);
  return  (response.data as { result: Record<string, unknown> }).result ?? response.data;
};

// ==================== Mappings ====================

export const createMapping = async (integrationId: string, data: {
  resourceType: string;
  resourceId: string;
  externalId: string;
  metadata?: Record<string, unknown>;
}): Promise<ResourceMapping> => {
  const response = await api.post<{ mapping: ResourceMapping }>(`/api/v1/integration/${integrationId}/mappings`, data);
  return  (response.data as { mapping: ResourceMapping }).mapping ?? response.data;
};

export const getMappings = async (integrationId: string, params: {
  resourceType?: string;
  resourceId?: string;
  externalId?: string;
}): Promise<ResourceMapping> => {
  const response = await api.get<{ mapping: ResourceMapping }>(`/api/v1/integration/${integrationId}/mappings`, { params });
  return  (response.data as { mapping: ResourceMapping }).mapping ?? response.data;
};
