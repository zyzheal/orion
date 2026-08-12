/**
 * CI Type Designer API
 * Phase 2 - Metadata-driven CMDB type management
 */
import apiClient from './client';

export interface CIType {
  id: string;
  tenantId: string;
  name: string;
  displayName: string | null;
  description: string | null;
  icon: string | null;
  category: string | null;
  version: number;
  enabled: boolean;
  status: string;
  attributes?: CIAttribute[];
  createdAt: string;
  updatedAt: string;
}

export interface CIAttribute {
  id: string;
  tenantId: string;
  typeId: string;
  attrKey: string;
  name: string;
  displayName: string | null;
  attrType: string;
  required: boolean;
  defaultValue: string | null;
  options: string | null;
  validationRule: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CITypeVersion {
  id: string;
  tenantId: string;
  typeId: string;
  version: string;
  attributesSnapshot?: string;
  changeSummary?: string | null;
  createdAt: string;
}

export interface CreateCITypeInput {
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  category?: string;
}

export interface UpdateCITypeInput {
  displayName?: string;
  description?: string;
  icon?: string;
  category?: string;
  enabled?: boolean;
}

export interface CreateCIAttributeInput {
  attrKey: string;
  displayName?: string;
  attrType: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'json';
  required?: boolean;
  defaultValue?: string;
  options?: string[];
  validationRule?: string;
  sortOrder?: number;
}

// CI Types
export const listCITypes = (params?: { category?: string; enabled?: boolean }) =>
  apiClient.get<CIType[]>('/ci-types', { params });

export const getCIType = (id: string) =>
  apiClient.get<CIType>(`/ci-types/${id}`);

export const createCIType = (data: CreateCITypeInput) =>
  apiClient.post<CIType>('/ci-types', data);

export const updateCIType = (id: string, data: UpdateCITypeInput) =>
  apiClient.put<CIType>(`/ci-types/${id}`, data);

export const deleteCIType = (id: string) =>
  apiClient.delete(`/ci-types/${id}`);

// Attributes
export const getCITypeAttributes = (typeId: string) =>
  apiClient.get<CIAttribute[]>(`/ci-types/${typeId}/attributes`);

export const setCITypeAttributes = (typeId: string, attributes: CreateCIAttributeInput[]) =>
  apiClient.put<CIAttribute[]>(`/ci-types/${typeId}/attributes`, { attributes });

// Validation
export const validateCIInstance = (typeId: string, data: Record<string, unknown>) =>
  apiClient.post<{ valid: boolean; errors: { field: string; message: string }[] }>(`/ci-types/${typeId}/validate`, data);

// Versions
export const createCITypeVersion = (typeId: string) =>
  apiClient.post<CITypeVersion>(`/ci-types/${typeId}/versions`);

export const getCITypeVersions = (typeId: string) =>
  apiClient.get<CITypeVersion[]>(`/ci-types/${typeId}/versions`);

export const rollbackCIType = (typeId: string, versionId: string) =>
  apiClient.post<CIType>(`/ci-types/${typeId}/versions/${versionId}/rollback`);
